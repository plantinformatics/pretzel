import { next } from '@ember/runloop';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

import {
  tabActive, inputRangeValue,
  expRangeBase, expRange, expRangeInitial,
  setCssVariable
} from '../../utils/domElements';

import { toBool } from '../../utils/common/strings';

import { stacks } from '../../utils/stacks';

import { subInterval, overlapInterval, inRange } from '../../utils/draw/zoomPanCalcs';


/* global d3 */
/* global DocumentTimeline */

/*--------------------------------------------------------------------------*/

const dLog = console.debug;

/** values for titleTextSize, font-size:  */
const fontSizes = [
  'xx-small', 'x-small', 'smaller', 'small',
  // inherit is the neutral value, array index === 4, which is initial default in hbs : value=4
  'inherit',
  // larger seems to be smaller than large.
  'larger', 'large', 'x-large', 'xx-large', 'xxx-large'];

/*--------------------------------------------------------------------------*/

/** On Firefox, an axis vertical bar <path> is sometimes invisible if
 * stroke-width is 1px; this may be caused by scaling caused by the
 * viewbox.
 * A solution is to set stroke-width 2px, via initial --axisWidth value.
 * Since this is seen on Firefox but not Chrome, and may be solved
 * later by a browser change, it is currently handled by setting
 * stroke-width 2px only if isFirefox().
 *
 * isFirefox() is from :
 * https://github.com/astronomersiva/ember-display-in-browser/blob/master/addon/utils/browser-checks.js
*/
// Firefox 1.0+
export const isFirefox = () => typeof InstallTrigger !== 'undefined';

const sbSizeThresholdInitial = 20;
const sbSizeThresholdMax = 1e9;

const axisLayerModulusInitial = 5;
const axisLayerModulusMax = 100;


/** can be replaced by Math.clamp() when that is available
 * refn : https://stackoverflow.com/questions/11409895/whats-the-most-elegant-way-to-cap-a-number-to-a-segment
 */
function Math_clamp(x, lower, upper) {
  return Math.max(lower, Math.min(x, upper) );
}

/*--------------------------------------------------------------------------*/




export default Component.extend({
  tagName: 'div',
  // attributes
  // classes

  feed: service(),

  /*--------------------------------------------------------------------------*/
  /** paths are calculated in the backend if both blocks of block-adj are from
   * the same server;  otherwise they may be calculated in the frontend (client)
   * and / or in the backend via localiseBlocks().
  */
  pathJoinClient : false,
  pathJoinRemote : true,

  /*--------------------------------------------------------------------------*/

  /** if false, axis title text and axis ticks and text are hidden with display : none,
   * via a class .hideAxisText added on svgContainer.FeatureMapViewer
   */
  showAxisText : true,

  /** if true, show only (reference) Block name (i.e. chromosome scope) in axis title. */
  axisTitleChrOnly : false,

  /** if true, axis title text and axis ticks and text are shown on the right
   * side of the axis for the rightmost axis.
   */
  axisTicksOutside : true,

  /** number of ticks in y axis when axis is not stacked.  reduce this
   * proportionately when axis is stacked. */
  axisTicks : 10,

  /*--------------------------------------------------------------------------*/

  /** Toggle axis-charts / Chart1 between showing the ChartLine-s as <rect> bars or lines   */
  chartBarLine : true,

  /*--------------------------------------------------------------------------*/

  /** time in milliseconds;   group events into discrete times.
   * Applies to various high-bandwidth events, e.g. axis-position : zoom,
   * axis-1d : updateAxis, draw/block-adj updatePathsPositionDebounced
   */
  debounceTime : 400,
  throttleTime : 40,

  // ---------------------------------------------------------------------------

  /** time of last change by user of a GUI slider which may require redraw; if
   * redrawing from a user adjustment such as a slider, then don't use a
   * transition.  This gives the effect of the rendered elements moving directly
   * with the user's adjustment.  In the other case, e.g. change of a checkbox
   * or toggle, a transition is used.
   */
  sliderChangeTime : undefined,
  aSliderHasChanged() {
    let
    documentTimeline = new (DocumentTimeline || window.DocumentTimeline)();
    this.set('sliderChangeTime', documentTimeline.currentTime);
  },
  get timeSinceASliderHasChanged() {
    let
    documentTimeline = new (DocumentTimeline || window.DocumentTimeline)(),
    sliderChangeTime = this.get('sliderChangeTime'),
    since = sliderChangeTime && (documentTimeline.currentTime - sliderChangeTime);
    return since;
  },

  /*--------------------------------------------------------------------------*/

  /** The input slider has an integer value, so pathGradientInt / 100 is the real value. */
  pathGradientInt : 100,
  /** true means use pathGradient threshold as an upper limit. */
  pathGradientUpper : true,
  pathGradient : computed('pathGradientInt', function () {
    let
     pathGradient = +this.get('pathGradientInt'),
        gradient = (pathGradient / 100);
    // dLog('pathControlGradient', pathGradient, gradient);
    return gradient;
   }),

  /*--------------------------------------------------------------------------*/

  featureIntervalOverlap : true,
  featureIntervalContain : true,

  featureIntervalOverlapChanged() {
    this.updateSyntenyBlocksPosition();
  },
  featureIntervalContainChanged() {
    this.updateSyntenyBlocksPosition();
  },

  tickOrPath : 'tick',
  /** user has clicked tick/path/nothing radio. */
  tickOrPathChanged(value) {
    dLog('tickOrPathChanged', value);
    this.updateSyntenyBlocksPosition();
  },

  /*--------------------------------------------------------------------------*/

  /** Return a function for deciding if a feature is in an interval, configured by the user controls.
   * @return fn (value, interval) returning true or false, which has params :
   * @param value Feature.value[], which may be one end of a path or synteny block
   * @param interval [start, end], which may be a brush or zoom scope.
   */
  valueInInterval : computed('featureIntervalOverlap', 'featureIntervalContain', function () {
    /** 
     * Overlap  Contain function
     * true     true    overlapInterval
     * true     false   overlapInterval && ! subInterval(interval, feature)
     * false    true    subInterval || subInterval(interval, feature)
     * false    false   subInterval && ! subInterval(interval, feature)
     *
     * For the case 'true false', i.e. the requirement is to not select .value
     * when interval is a sub-interval of .value, overlapInterval1() could be used in
     * place of overlapInterval && ! subInterval( )
     */
    const
    overlap = this.get('featureIntervalOverlap'),
    contain = this.get('featureIntervalContain'),
    fn = (value, interval) => {
      let ok;
      if (! value.length) {
        /* easy to support non-array value atm; may not be required;
         * for typescript may declare value as array.
         */
        ok = (typeof value === "number") && inRange(value, interval);
      } else if (interval.length !== 2) {
        dLog('valueInInterval', 'invalid interval', interval);
        ok = false;
      } else if (value.length == 1) {
        /** for .length === 1 : overlap and contain don't apply, and subInterval() works. */
        ok = subInterval(value, interval);
      } else {
        ok = (overlap ? overlapInterval : subInterval)(value, interval)
          && (contain || ! subInterval(interval, value));
        ok ||= ((! overlap && contain) && subInterval(interval, value));
      };
      return ok;
    };
    return fn;
  }),
  /*--------------------------------------------------------------------------*/
  /** showSynteny() / updateSyntenyBlocksPosition will move to a component, replacing this link via stacks.oa.axisApi */
  stacks,
  updateSyntenyBlocksPosition() {
    let fn = stacks?.oa?.axisApi?.updateSyntenyBlocksPosition;
    fn && next(fn);
  },

  /** sbSizeThreshold is the minimum size for synteny blocks / trapezoids to be displayed.
   * The user has 2 controls for changing the value of sbSizeThreshold : text input and a range slider.
   * For each input this component has an attribute value and a change action function : sbSizeThreshold{Text,Linear}{,Changed}
   * The change functions set .sbSizeThreshold and the other attribute value,
   * and call updateSyntenyBlocksPosition().
   *
   * The initial / default value of sbSizeThreshold is set in these 3 fields, in their respective formats.
   */
  sbSizeThreshold : sbSizeThresholdInitial,
  sbSizeThresholdLinear : expRangeInitial(sbSizeThresholdInitial, expRangeBase(50, sbSizeThresholdMax)),
  sbSizeThresholdText : "" + sbSizeThresholdInitial,
  sbSizeThresholdTextChanged(value) {
    /* {{input value=sbSizeThresholdText ... }} sets
     * this.sbSizeThresholdText, and (action ...  value=target.value)
     * passes the same value to this function.  */
    if (this.sbSizeThresholdText !== value) {
      dLog('sbSizeThresholdTextChanged', this.sbSizeThresholdText, value);
    }
    /** value is a string. */
    value = +value;
    if ((value < 1) || (value > sbSizeThresholdMax)) {
      /* Could clamp the value (and would have to set .sbSizeThresholdText to
       * the clamped value, but probably better to not accept the input, and let
       * the user fix it.
       *   value = Math_clamp(value, 1, sbSizeThresholdMax);
       */
      return;
    }
    if (value !== this.set('sbSizeThreshold')) {
      let linear = expRangeInitial(value, expRangeBase(50, sbSizeThresholdMax));
      dLog('sbSizeThresholdTextChanged', this.sbSizeThresholdText, value, linear);
      /* setting this.sbSizeThresholdLinear updates the range slider because of value= :
       * <input value={{sbSizeThresholdLinear}} ...
       */
      this.set('sbSizeThresholdLinear', linear);
      this.set('sbSizeThreshold', value);
      this.updateSyntenyBlocksPosition();
    }
  },
  sbSizeThresholdLinearChanged(linear) {
    /**
     * (comment from updateSbSizeThresh() )
     * Size is normally measured in base pairs so round to integer;
     * this may be OK for centiMorgans also; genetic map markers
     * have a single position not a range so 'size' will be 0, and
     * synteny-block representation (trapezoid) would only be used
     * if aligning GM to physical.
     *
     * <input range {{action ... value="target.value"}} >
     * gives the param linear a string value.
     */
    let value = Math.round(expRange(+linear, 50, sbSizeThresholdMax));
    // dLog('sbSizeThresholdLinearChanged', linear, value);
    /* setting this.sbSizeThresholdText updates the text input because of :
     * {{input ... value=sbSizeThresholdText
     * The range slider does not change this.sbSizeThresholdLinear
     */
    this.set('sbSizeThresholdText', value);
    this.set('sbSizeThreshold', value);
    this.updateSyntenyBlocksPosition();
  },

  // ---------------------------------------------------------------------------
  /* copied, with sbSizeThreshold → axisLayerModulus; factor as a sub-component - no time now.
   * sbSizeThreshold comments apply similarly here.
   */
  
  axisLayerModulus : axisLayerModulusInitial,
  axisLayerModulusLinear : expRangeInitial(axisLayerModulusInitial, expRangeBase(50, axisLayerModulusMax)),
  axisLayerModulusText : "" + axisLayerModulusInitial,
  axisLayerModulusTextChanged(value) {
    /* {{input value=axisLayerModulusText ... }} sets
     * this.axisLayerModulusText, and (action ...  value=target.value)
     * passes the same value to this function.  */
    if (this.axisLayerModulusText !== value) {
      dLog('axisLayerModulusTextChanged', this.axisLayerModulusText, value);
    }
    /** value is a string. */
    value = +value;
    if ((value < 1) || (value > axisLayerModulusMax)) {
      return;
    }
    if (value !== this.set('axisLayerModulus')) {
      let linear = expRangeInitial(value, expRangeBase(50, axisLayerModulusMax));
      dLog('axisLayerModulusTextChanged', this.axisLayerModulusText, value, linear);
      this.set('axisLayerModulusLinear', linear);
      this.set('axisLayerModulus', value);
      this.updateSyntenyBlocksPosition();
    }
  },
  axisLayerModulusLinearChanged(linear) {
    let value = Math.round(expRange(+linear, 50, axisLayerModulusMax));
    // dLog('axisLayerModulusLinearChanged', linear, value);
    this.set('axisLayerModulusText', value);
    this.set('axisLayerModulus', value);
    this.updateSyntenyBlocksPosition();
  },


  /*--------------------------------------------------------------------------*/

  /** may be set via URL param - @see readParsedOptions(). */
  pathsViaStream : true,

  /** This slider value is mapped via an exponential (computed) function and
   * available as :
   * controls.view.pathControlActiveDensity
   *
   * Calculation of initial / default value :
   * Some explanation in see comment in @expRange()
   * and @see updateSbSizeThresh() (draw-map.js)
   */
  pathDensity : expRangeInitial(100, expRangeBase(100/2, 1000)),
  /** ditto, 
   * controls.view.pathControlActiveSample
   */
  pathSample : expRangeInitial(400, expRangeBase(100, 10000)),

  pathControlActiveDensity : computed('pathDensityActive', 'pathDensity', function () {
    let active = this.get('pathDensityActive'),
     pathDensity = +this.get('pathDensity'),
      density = active && expRange(pathDensity, 100/2, 1000);
    if (density) {
      let digits = Math.log10(density),
      decimals =  (digits > 2) ? 0 : ((digits > 1) ? 1 : 2);
      density = +density.toFixed(decimals);
    }
    let value = inputRangeValue('range-pathDensity');
    next(function () {
      let value2 = inputRangeValue('range-pathDensity');
      if (value !== value2)
        dLog('range-pathDensity',  value, value2);
    });

    dLog('pathControlActiveDensity', pathDensity, density);
    return density;
   }),

  pathControlActiveSample : computed('pathSampleActive', 'pathSample', function () {
    let active = this.get('pathSampleActive'),
     pathSample = +this.get('pathSample'),
     sample = active && expRange(pathSample, 100, 10000);
    if (sample) {
      sample = Math.round(sample);
    }
    let value = inputRangeValue('range-pathSample');
    next(function () {
      let value2 = inputRangeValue('range-pathSample');
      if (value !== value2)
        dLog('range-pathSample',  value, value2);
    });
    dLog('pathControlActiveSample', pathSample, sample);
    return sample;
   }),

  /** ditto, 
   * controls.view.pathControlActiveNFeatures
   */
  pathNFeatures : expRangeInitial(1000, expRangeBase(100, 10000)),

  pathControlNFeatures : computed('pathNFeatures', 'pathNFeatures', function () {
    /** May make nFeatures display and range slider sensitive only when
     * pathsViaStream, or perhaps it will be a limit applicable also to other
     * (non-streaming) request modes.
     */
    let active = this.get('pathsViaStream'),
     pathNFeatures = +this.get('pathNFeatures'),
     nFeatures = active && expRange(pathNFeatures, 100, 10000);
    if (nFeatures) {
      nFeatures = Math.round(nFeatures);
    }
    dLog('pathControlNFeatures', pathNFeatures, nFeatures);
    return nFeatures;
   }),

  pathsDensityParams : computed(
    'pathControlActiveSample', 'pathControlActiveDensity', 'pathControlNFeatures',
    function () {
      let params = {};

      let nSamples = this.get('pathControlActiveSample');
      if (nSamples) {
        params.nSamples = nSamples;
      }
      let densityFactor = this.get('pathControlActiveDensity');
      if (densityFactor) {
        params.densityFactor = densityFactor;
      }
      let nFeatures = this.get('pathControlNFeatures');
      if (nFeatures) {
        params.nFeatures = nFeatures;
      }
      return params;
    }),

  featuresCountsNBinsLinear : expRangeInitial(100, expRangeBase(100, 500)),

  featuresCountsNBins : computed('featuresCountsNBinsLinear', function () {
    let
     thresholdLinear = +this.get('featuresCountsNBinsLinear'),
     threshold = expRange(thresholdLinear, 100, 500);
    if (threshold) {
      threshold = Math.round(threshold);
    }
    dLog('featuresCountsNBins', thresholdLinear, threshold);
    return threshold;
   }),

  featuresCountsThresholdLinear : expRangeInitial(500, expRangeBase(100, 10000)),

  /** Threshold between showing featuresCounts charts and features tracks :
   *  - if (count <= featuresCountsThreshold) show features (axis-tracks)
   *  - if  (count > featuresCountsThreshold) show featuresCounts (axis-charts)
   */
  featuresCountsThreshold : computed('featuresCountsThresholdLinear', function () {
    let
     thresholdLinear = +this.get('featuresCountsThresholdLinear'),
     threshold = expRange(thresholdLinear, 100, 10000);
    if (threshold) {
      threshold = Math.round(threshold);
    }
    dLog('featuresCountsThreshold', thresholdLinear, threshold);
    return threshold;
   }),

  /*--------------------------------------------------------------------------*/

  /** factor to increase QTL diamond width from base track width.
   * This initial default value is coordinated with hbs : <input ... value=20 ... diamondWidthInput >
   */
  diamondWidth : 2,
  /** Horizontal pixel offset for QTL diamond.
   * This initial default value is coordinated with hbs : <input ... value=0 ... diamondOffsetInput >
   */
  diamondOffset : 0,


  /*--------------------------------------------------------------------------*/

  didInsertElement() {
    dLog("components/draw-controls didInsertElement()", this.drawActions);
    this._super(...arguments);

    this.drawActions.trigger("drawControlsLife", true);
    // initially 'Paths - Sample' tab is active.
    // To change the initial active tab, change this and also change .active
    // class of .active-detail and .tab-pane, and .in class of the latter.
    this.send('pathTabActive', 'sample');
    this.readParsedOptions();
    this.set('controls.view', this);

    /* inherit browser default (1px) as an initial default, except for
     * Firefox, as commented above.
     */
    setCssVariable ('--axisWidth', isFirefox() ? '2px' : 'inherit');
  },
  readParsedOptions() {
    /** this can be passed in from model.params.parsedOptions and then access pathsViaStream as 
     * this.get('parsedOptions.pathsViaStream');
     */
    let parsedOptions = this.drawActions.model.params.parsedOptions;

    /** default to true if not given as URL query param e.g. options=pathsViaStream=false  */
    let pathsViaStream = parsedOptions && parsedOptions.pathsViaStream;
      // this.get('parsedOptions.pathsViaStream');
    if (pathsViaStream !== undefined)
      this.set('pathsViaStream', toBool(pathsViaStream));
  },
  willDestroyElement() {
    dLog("components/draw-controls willDestroyElement()");
    this.drawActions.trigger("drawControlsLife", false);

    this._super.apply(this, arguments);
  },

  actions : {
    pathTabActive : function(tabName) {
      let active;
      active = tabName === 'density';
      dLog('pathDensityActive', active, tabName);
      this.set('pathDensityActive', active);

      active = tabName === 'sample';
      dLog('pathSampleActive', active);
      this.set('pathSampleActive', active);
    },

    flipRegion : function () {
      this.get('feed').trigger('flipRegion', undefined);
    },

    clearScaffoldColours  : function () {
      dLog("clearScaffoldColours", "selected-markers.js");
      this.get('feed').trigger('clearScaffoldColours');
    },

    resetZooms : function () {
      this.get('feed').trigger('resetZooms');
    },

  },

  /** @return d3 selection of the top-most <g> within the <svg> of the draw-map graph.
   * This is equivalent to oa.svgContainer
   */
  svgContainer : computed( function() {
    /** i.e. <svg><g  transform="translate(0,1)"> ... */
    let g = d3.selectAll('svg.FeatureMapViewer > g');
    return g;
  }),
  /** Called when input checkbox 'Show Axis Text' is clicked.  */
  hideAxisTextClass(input) {
    let svgContainer = this.get('svgContainer');
    let
    show = input.target.checked,
    hide = ! show;
    dLog('hideAxisTextClass', hide, svgContainer.node());
    svgContainer
      .classed('hideAxisText', hide);
    this.set('showAxisText', show);
  },
  axisWidthInput(event) {
    const varName = '--axisWidth';
    /** input range is [0,100];  desired output values are [0, 10].  */
    const factor = 100 / 10;
    let value = event.target.value / factor;
    // dLog('axisWidthInput', varName, value, event.target.value);
    setCssVariable(varName, value);
    // not used.
    this.set('axisWidth', value);
  },
  diamondWidthInput(event) {
    /** default is 2 * factor : value=20 in hbs */
    /** input range is [0,100];  desired output values are [0, 10].
     * event.target.value is a string; / converts to a number.
     */
    const factor = 100 / 10;
    let value = event.target.value / factor;
    // dLog('diamondWidthInput', varName, value, event.target.value);
    this.set('diamondWidth', value);
  },
  diamondOffsetInput(event) {
    /** default is 0 + xOffset : value=0 in hbs
     * event.target.value is a string; convert to a number.
     */
    let value = +event.target.value;
    // dLog('diamondOffsetInput', value, event.target.value);
    this.set('diamondOffset', value);
  },
  qtlUncolouredOpacityInput(event) {
    /** default is 100% : range [0, 15] - single hex digit : value=15 in hbs
     * event.target.value is a string; convert to a number.
     */
    let value = +event.target.value;
     dLog('qtlUncolouredOpacityInput', value, event.target.value);
    this.set('qtlUncolouredOpacity', value);
  },
  titleTextSizeInput(event) {
    const attrName = 'font-size';
    /** values are [0, 9] (min="0" max="9" in .hbs).  */
    let value = fontSizes[event.target.value];
    dLog('titleTextSizeInput', attrName, value, event.target.value);
    // setCssVariable() does d3 .style() which can set variable or style attribute.
    setCssVariable(attrName, value);
    this.set('titleTextSize', (value === 'inherit') ? '' : value);
  },



});
