import { later, next, once as run_once, throttle } from '@ember/runloop';
import { A } from '@ember/array';
import { computed, observer } from '@ember/object';
import { alias } from '@ember/object/computed';
import Evented from '@ember/object/evented';
import Component from '@ember/component';
import { inject as service } from '@ember/service';


import { sum } from 'lodash/math';
import { isEqual } from 'lodash/lang';


import { contentOf } from '../../utils/common/promises';
import AxisEvents from '../../utils/draw/axis-events';
import AxisPosition from '../../mixins/axis-position';
import {
  /* Block,
  */ Stacked,
  /*Stack,
  */ stacks /*,
  xScaleExtend,
  axisRedrawText,
  axisId2Name*/
} from '../../utils/stacks';
import {
  noDomain,
  /* Axes, yAxisTextScale,  yAxisTicksScale,*/  yAxisBtnScale,
  /* yAxisTitleTransform, eltId,*/ axisEltId /*, eltIdAll, highlightId*/,
  axisEltIdClipPath,
  axisTitleColour,
  eltId,
  featureTraitColour,
} from '../../utils/draw/axis';
import {
  DragTransition,
  dragTransitionTime,
  dragTransitionNew,
  dragTransition
} from '../../utils/stacks-drag';
import { selectAxis } from '../../utils/draw/stacksAxes';
import { selectGroup, nowOrAfterTransition } from '../../utils/draw/d3-svg';
import { breakPoint } from '../../utils/breakPoint';
import { configureHover } from '../../utils/hover';
import { getAttrOrCP } from '../../utils/ember-devel';
import { intervalExtent, intervalOverlap }  from '../../utils/interval-calcs';
import { inRange } from '../../utils/draw/zoomPanCalcs';
import { updateDomain } from '../../utils/stacksLayout';


/* global d3 */
/* global require */

/*------------------------------------------------------------------------*/

const trace_stack = 0;

const dLog = console.debug;

/* milliseconds duration of transitions in which axis ticks are drawn / changed.
 * Match with time used by draw-map.js : zoom() and resetZoom() : 750.
 * also @see   dragTransitionTime.
 */
const axisTickTransitionTime = 750;



function blockKeyFn(block) { return block.axisName; }


/*------------------------------------------------------------------------*/


/*------------------------------------------------------------------------*/


/* showTickLocations() and configureHover() are based on the
 * corresponding functions in draw-map.js
 * There is a lot of variation at all levels between this application and the
 * original - draft factoring (axisDomData.js) showed a blow-out of abstraction
 * and complexity even before all the differences were handled.
 */

const componentName = 'axis-1d';
const className = "horizTick";

/** filter : @return true if the given Block is configured to display ticks.
 *
 * Previously : ! block.block.get('dataset').get('showPaths') to select
 * the scaffolds, but that is no longer relevant since ticks are no
 * longer used for scaffolds.  So now return block ... .isData
 */
function blockWithTicks(block)
{
  let isData = block.block.get('isData');  // was .showPaths
  // dLog('blockWithTicks', block.axisName, showPaths);
  return isData;
}

/** Return a filter to select features which are within the current zoomedDomain
 * of the given block.
 * @param block stacks Block
 */
function inRangeBlock(range0, block) {
  return function (feature) {
    let
    axis1d = block.axis.axis1d;
    return axis1d.inRangeR(feature, range0);
  };
}

/** Draw horizontal ticks on the axes, at feature locations.
 * This is used for 2 cases so far :
 * . all features of blocks which have !showPaths, when axis is ! extended
 * . features found in blocks using feature search (goto-feature-list)
 *
 * @param axis  Stacked
 * @param axisApi for lineHoriz
 * @param axis1d axis-1d component, to lookup axisObj.extended
 */
function FeatureTicks(axis, axisApi, axis1d)
{
  this.axis = axis;
  this.axisApi = axisApi;
  this.axis1d = axis1d;

  this.getTransitionTime = () => this.axis1d.get('transitionTime');
  this.selectionToTransition = (selection) => this.axis1d.selectionToTransition(selection);
  this.featureY = (feature) => this.axis1d.featureY(feature);
  this.blockColourValue = (feature) => this.axis1d.blockColourValue(feature);
  this.selectGroup = (groupName) => this.axis1d.selectGroup(groupName);
}

/** @return a function to lookup from block to an array of features.
 * Used as a d3 .data() function with block as data.
 */
FeatureTicks.prototype.featuresOfBlock = function (featuresOfBlockLookup) {
  let
  range0 = this.axis.yRange2();

    return (block) => {
      let inRange = inRangeBlock(range0, block);

      let blockR = block.block,
      blockId = blockR.get('id'),
      featuresAll = featuresOfBlockLookup(blockR),
      features = ! featuresAll ? [] : featuresAll
        .filter(inRange);
      if (trace_stack > 1) {
        dLog(blockId, features.length, 'showTickLocations featuresOfBlock');
      }
      return features;
    };
};

/** Determine the colour for the feature, either traitColour() if
 * feature.blockId is a QTL, or otherwise blockColourValue().
 */
FeatureTicks.prototype.featureColour = function (feature) {
  /** Similar @see featurePathStroke() */
  let colour;
  let block = feature.get('blockId');
  if (block.get('useTraitColour')) {
    colour = featureTraitColour(feature);
  } else {
    colour = this.blockColourValue(contentOf(block));
  }
  return colour;
};

function blockTickEltId(groupName) {
  return function (block) { return className + '_' + groupName + '_' + block.axisName; };
}


/** Draw horizontal ticks on the axes, at feature locations.
 *
 * @param featuresOfBlockLookup map from block to array of features; its param is :
 * @param axis  block (Ember object), result of stacks-view:axesP
 * If the axis has multiple (data) blocks, this is the reference block.
 */
FeatureTicks.prototype.showTickLocations = function (featuresOfBlockLookup, setupHover, groupName, blockFilter, clickFn)
{
  /** Called from axis-ticks-selected : renderTicks(), and originally also
   * called from axis-1d : renderTicks() to represent the edges of scaffolds.
 */
  let axis = this.axis, axisApi = this.axisApi;
  let axisName = axis.axisName;
  let
    axisObj = this.axis1d.get('axisObj'),
  // The following call to this.axis1d.get('extended')
  // replaces directly accessing axisObj.extended
  extended = this.axis1d.get('extended');
  if (trace_stack)
    dLog('showTickLocations', extended, axisObj, groupName);

  let blockIndex = {};
  let aS = selectAxis(axis);
  if (!aS.empty())
  {
    /** show no ticks if axis is extended. */
    const notWhenExtended = false;
    let blocks = (notWhenExtended && extended ? [] : blockFilter ? axis.blocks.filter(blockWithTicks) : axis.blocks);
    let gSA = this.selectGroup(groupName);
    if (!gSA.empty()) {

      function storeBlockIndex (block, i) {
        blockIndex[block.getId()] = i;
        if (trace_stack)
          dLog('blockIndex', block.getId(), i);
      };

      /** data blocks of the axis, for calculating blockIndex i.e. colour.
       * colour assignment includes non-visible blocks . */
      let blocksUnfiltered = extended ? [] : axis.dataBlocks(false, false);
      if (trace_stack)
        dLog('blockIndex', axisName, axis, axis.blocks);
      blocksUnfiltered.forEach(storeBlockIndex);

      featuresOfBlockLookup ||= function (blockR) {
        return blockR.get('features').toArray();
      };
      let featuresOfBlock = this.featuresOfBlock(featuresOfBlockLookup);

      let
      pS = gSA
        .selectAll("path." + className)
        .data(featuresOfBlock, keyFn),
      pSE = pS.enter()
        .append("path")
        .attr("class", className)
      ;

      /** @return rgb() colour for feature <path> stroke (feature ticks / triangles)
       * @desc Calling signature : `this` is the DOM element to be coloured,  from d3 .attr() `this`
       */
      function featurePathStroke (feature, i2) {
        /** Similar : FeatureTicks.prototype.featureColour() */
        let colour;
        let block = this.parentElement.__data__;
        if (block.block.get('useTraitColour')) {
          colour = featureTraitColour(feature);
        } else {
          let
          blockId = block.getId(),
          /** Add 1 to i because it is the elt index, not the
           * index within axis.blocks[], i.e. the reference block is not included. */
          i = blockIndex[blockId];
          if (i2 < 2)
            dLog(this, 'stroke', blockId, i);
          colour = axisTitleColour(blockId, i+1) || 'black';
        }
        return colour;
      }

      if (setupHover === true)
      {
        setupHover = 
          function setupHover (feature) 
        {
          let block = this.parentElement.__data__;
          return configureHover.apply(this, [{feature, block}, hoverTextFn]);
        };

        pSE
          .each(setupHover);
      }
      pSE.on('click', clickFn);

      pS.exit()
        .remove();
      /** Instead of using .merge(), show .enter() elements (at their
       * final posiiton) after the pS elements have transitioned to
       * their final position.
       let pSM = pSE.merge(pS);
      */

      /* update attr d in a transition if one was given.  */
      let p1 = // (t === undefined) ? pSM :
          this.selectionToTransition(pS);

      /** similar comment re. transitionTime as in showLabels() */
      nowOrAfterTransition(
        p1, () => pSE.call(pathAndColour),
        this.axis1d.transitionTime);

      p1.call(pathAndColour);
      function pathAndColour(selection) {
        selection
        .attr("d", pathFn)
        .attr('stroke', featurePathStroke)
        .attr('fill', featurePathStroke)
      ;
      }

    }
  }

  function keyFn (feature) {
    // here `this` is the parent of the <path>-s, e.g. g.axis

    /** If feature is the result of block.get('features') then it will be an
     * ember store object, but if it is the result of featureSearch() then it will be
     * just the data attributes, and will not implement .get().
     * Using feature.name instead of feature.get('name') will work in later
     * versions of Ember, and will work after the computed property is
     * evaluated, because name attribute does not change.
     * The function getAttrOrCP() will use .get if defined, otherwise .name (via ['name']).
     * This comment applies to use of 'feature.'{name,range,value} in
     * inRange() (above), and keyFn(), pathFn(), hoverTextFn() below.
     *
     * The features created from blast search results will all have the same name,
     * so for better d3 join, append location to the key.
     */
    let
    value = getAttrOrCP(feature, 'value'),
    featureName = getAttrOrCP(feature, 'name') + '-' + value[0];
    // dLog('keyFn', feature, featureName); 
    return featureName;
  };
  function pathFn (feature) {
    // based on axisFeatureTick(ai, d)
    /** shiftRight moves right end of tick out of axis zone, so it can
     * receive hover events.
     */
    let xOffset = 25, shiftRight=5;
    /* the requirements for foundFeatures path will likely evolve after trial,
     * so this informal customisation is sufficient until the requirements are
     * settled.
     */
    if (groupName === 'foundFeatures') {
      xOffset = 35;
    }
    let ak = axisName,
    range = getAttrOrCP(feature, 'range') || getAttrOrCP(feature, 'value'),
    tickY = range && (range.length ? range[0] : range),
    // sLine = axisApi.lineHoriz(ak, tickY, xOffset, shiftRight);
    // instead of lineHoriz(), use horizTrianglePath().
    /** scaled to axis.
     * could instead use featureY_(ak, feature.id);     */
    akYs = stacks.oa.y[ak](tickY),
    sLine = horizTrianglePath(akYs, 10, xOffset / 2, 1);
    return sLine;
  };

  /** Construct a <path> which draws a horizontal isosceles triangle, pointing right.
   * This is used to indicate on an axis the position of features search results.
   * @param akYs	scaled y position of feature
   * @param yLength	length of triangle base
   * @param xLength	length of triangle x axis
   * @param shiftLeft	offset of vertex from y axis
   */
  function horizTrianglePath(akYs, yLength, xLength, shiftLeft) {
    /** related : axisApi.lineHoriz(), featureLineS()  */
    let
    baseX = -xLength + shiftLeft,
    y2 = yLength / 2;
    let path = d3.line()(
      [[baseX, akYs - y2],
       [-shiftLeft, akYs],
       [baseX, akYs + y2]]) + 'Z';
    return path;
  };

  /** eg: "scaffold23432:1A:1-534243" */
  function hoverTextFn(context) {
    let {feature, block} = context;
    let
      /** value is now renamed to range, this handles some older data. */
      range = getAttrOrCP(feature, 'range') || getAttrOrCP(feature, 'value'),
    rangeText = range && (range.length ? ('' + range[0] + ' - ' + range[1]) : range),
    blockR = block.block,
    featureName = getAttrOrCP(feature, 'name'),
    scope = blockR && blockR.get('scope'),
    text = [featureName, scope, rangeText]
      .filter(function (x) { return x; })
      .join(" : ");
    return text;
  };
  // the code corresponding to hoverTextFn in the original is :
  // (location == "string") ? location :  "" + location;

};

/**
 * Specification : #223.  
 * 3.     Shift+ left click triangles on an axis draws a line across the top of the outermost triangles
 *   a.  determine extent of clicked features
 *   b. draw path across extent, near the base of the triangles
 */
FeatureTicks.prototype.showSpanningLine = function (featuresOfBlockLookup) {
  const groupName = 'spanFeatures';

  let axis = this.axis, axisApi = this.axisApi;
  let axisName = axis.axisName;

  let aS = selectAxis(axis);
  if (!aS.empty())
  {

    // .filter((b) => axis1d.selected.shiftClickedFeaturesByBlock(block.block)

    let gSA = this.selectGroup(groupName);
    gSA
      .attr("clip-path", (block) => "url(#" + axisEltIdClipPath(block.block.get('referenceBlockOrSelf.id')) + ")");

    if (!gSA.empty()) {

      const spanFeaturesOfBlock = (blockS) => {
        let
        blockR = blockS.block,
        features = featuresOfBlockLookup(blockR),
        outermostFeatures = features && features
          .reduce((result, f) => {
            let y = this.featureY(f);
            if (! result[0] || (y < result.minY)) {
              result[0] = f;
              result.minY = y;
            }
            if (! result[1] || (y > result.maxY)) {
              result[1] = f;
              result.maxY = y;
            }
            return result; }, []);
        // .minY and .maxY are used in spanPathFn(), but could be deleted here and re-calculated.
        return outermostFeatures ? [outermostFeatures] : [];
      };

      const tagName = 'path';

      let
      pS = gSA
        .selectAll(tagName + "." + className)
        .data(spanFeaturesOfBlock /*, keyFn*/),
      pSE = pS.enter()
        .append(tagName)
        .attr("class", className)
      ;

      pS.exit()
        .remove();
      let pSM = pSE.merge(pS);

      const pathFn = (d,i,g) => this.spanPathFn(d,i,g);
      pSE
        .attr("d", pathFn)

      this.selectionToTransition(pSM)
        .attr("d", pathFn)
        .attr('stroke', (limitFeatures) => this.featureColour(limitFeatures[0]))
      ;

    }
  }
}

/** Construct a <path> which draws a line slightly left of the bases of the
 * triangles which represent the given outermost limitFeatures
 */
FeatureTicks.prototype.spanPathFn = function (limitFeatures) {
  // based on showTickLocations():pathFn(), horizTrianglePath(); related : axisFeatureTick(ai, d)

  /** features y extent / interval scaled to px. */
  let 
  /** only called if there is >=1 feature, so .minY and .maxY are defined.
   * equivalent to : limitFeatures.map((f) => this.featureY(featureY));
   */
  yIntS = [limitFeatures.minY, limitFeatures.maxY],
  padding = 0;
  if (yIntS[0] === yIntS[1]) {
    /** @param yLength	length of triangle base */
    const yLength = 10,
    y2 = yLength / 2;
    /** if padding is to be added when !==, use Math.sign(yIntS[1] - yIntS[0]) * y2 */
    padding = yLength;
  }

  /**
   * @param yLength	length of triangle base
   * @param xLength	length of triangle x axis
   * @param shiftLeft	offset of line from base of triangles
   */
  const xLength = 35 / 2;
  const shiftLeft = -1.5;

  let
  baseX = -xLength - shiftLeft;
  let path = d3.line()(
    [[baseX, yIntS[0] - padding],
     [baseX, yIntS[1] + padding]]);

  return path;
};



/** Draw text feature labels left of the axes, at location of features selected
 * by clicking on the feature triangle, recorded in selected.labelledFeatures.
 *
 */
FeatureTicks.prototype.showLabels = function (featuresOfBlockLookup, setupHover, groupName, blockFilter, transitionFn)
{

  function textFn(feature) {
    let
    featureName = getAttrOrCP(feature, 'name');
    return featureName;
  }

  // copied from .showTickLocations(); can probably factor the keyFn and <g> setup

  function keyFn (feature) {
    // here `this` is the parent of the <path>-s, e.g. g.axis
    let
    value = getAttrOrCP(feature, 'value'),
    featureName = getAttrOrCP(feature, 'name') + '-' + value[0];
    // dLog('keyFn', feature, featureName); 
    return featureName;
  };

  let axis = this.axis, axisApi = this.axisApi;
  let axisName = axis.axisName;

  let aS = selectAxis(axis);
  if (!aS.empty())
  {
    let gSA = this.selectGroup(groupName);
    if (!gSA.empty()) {

      let featuresOfBlock = this.featuresOfBlock(featuresOfBlockLookup);

      const tagName = 'text';
      /**  p* (i.e. pS, pSE, pSM, p1) are selections of the <path> in .showTickLocations or <text> in .showLabels
       * S : the whole selection, SE : the .enter().append(), SM : the SE merged back with S, 1 : SM with a transition.
       */
      let
      pS = gSA
        .selectAll(tagName + "." + className)
        .data(featuresOfBlock, keyFn),
      pSE = pS.enter()
        .append(tagName)
        .attr("class", className)
        .attr('stroke', this.featureColour.bind(this))
      ;

      /* pSE
         .each(setupHover); */

      pS.exit()
        .remove();
      let pSM = pSE.merge(pS);

      /** For <text> the d is constant, so use pSE.
       * For showTickLocations / <path>, the d updates, so pSM is used
       */
      pSE
      // positioned just left of the base of the triangles.  inherits text-anchor from axis;
        .attr('x', '-30px');

      let attrY_featureY = this.attrY_featureY.bind(this);

      let transition = this.selectionToTransition(pS);
      /** pass in the delay time, because transition has no duration if empty(). */
      nowOrAfterTransition(
        transition, () => {
          return pSE.call(attrY_featureY)
        .text(textFn);
        },
        this.axis1d.transitionTime);

      if (transition === pS) {
        pS.call(attrY_featureY);
      } else {
        transition.call(attrY_featureY);
        // transitionFn(transition, attrY_featureY);
      }
    }
  }

};

FeatureTicks.prototype.attrY_featureY = function(selection) {
  console.log('attrY_featureY', selection.node(), this.axis1d.zoomedDomain);
  selection
    .attr('y',  (feature) => this.axis1d.featureY(feature));
};

/**
 * @property zoomed   selects either .zoomedDomain or .blocksDomain.  initially undefined (false).
 * @property flipped  if true then the domain is flipped in the view.  initially undefined (false).
 */
export default Component.extend(Evented, AxisEvents, AxisPosition, {
  blockService: service('data/block'),
  selected : service('data/selected'),
  axisBrush: service('data/axis-brush'),
  axisZoom: service('data/axis-zoom'),
  headsUp : service('data/heads-up'),
  controls : service(),

  controlsView : alias('controls.controls.view'),

  stacks : stacks,
  /** oa is used for these connections, which will eventually be
   * passed as params or replaced : axisApi, eventBus, svgContainer, axes[].
   * (stacks.oa is equivalent)
   */
  oa : alias('drawMap.oa'),
  axisApi : alias('oa.axisApi'),

  featuresCountsThreshold : alias('controls.view.featuresCountsThreshold'),

  /** flipRegion implies paths' positions should be updated.  The region is
   * defined by brush so it is within the domain, so the domain does not change.
   */
  flipRegionCounter : 0,


  init() {
    this._super(...arguments);

    let axisName = this.get('axis.id');
    /* axisS may not exist yet, so give Stacked a reference to this. */
    Stacked.axis1dAdd(axisName, this);
    let axisS = this.get('axisS');
    if (! axisS) {
      dLog('axis-1d:init', this, axisName, this.get('axis'));
    }
    else if (axisS.axis1d === this) {
      // no change
    }
    else if (axisS.axis1d && ! axisS.axis1d.isDestroyed)
    {
      dLog('axis-1d:init', this, axisName, this.get('axis'), axisS, axisS && axisS.axis1d);
    }
    else {
      axisS.axis1d = this;
      if (trace_stack) {
        dLog('axis-1d:init', this, this.get('axis.id'), axisS); axisS.log();
      }
    }

    next(() => this.axis1dExists(this, true));
  },


  /*--------------------------------------------------------------------------*/

  /** @return true if there is a brush on this axis.
   */
  brushed : computed('brushedRegion', function () {
    let brushed = !! this.get('brushedRegion');
    return brushed;
  }),
  brushedRegion : computed(
    'axis.id',
    'axisBrush.brushedAxes.[]',
    /** oa.brushedRegions is a hash, and it is updated not replaced,
     * so as a dependency key it will not signal changes; selectedAxes
     * is an array and is changed when brushedRegions is changed, so
     * it is used as a dependency, but it may not change when the user
     * brushes because it persists after the brush is cleared.
     */
    'oa.brushedRegions', 'oa.selectedAxes.[]',
    function () {
      let brushedRegions = this.get('oa.brushedRegions'),
      axisId = this.get('axis.id'),
      brushed = brushedRegions[axisId];
      dLog('brushed', axisId, brushedRegions[axisId], this.get('axisBrush.brushedAxes'));
      return brushed;
    }),
  brushedDomain : computed('brushedRegion', function () {
    let
    brushedRegion = this.get('brushedRegion'),
    /** refBlockId */
    axisId = this.get('axis.id'),
    brushedDomain = brushedRegion && this.get('axisApi').axisRange2Domain(axisId, brushedRegion);
    return brushedDomain;
  }),

  brushedBlocks : computed('brushed', 'block', 'zoomedDomain.{0,1}', function () {
    let blocks;
    if (this.brushed) {
      blocks = this.get('dataBlocks');
      dLog('brushedBlocks', blocks, this);
    }
    return blocks || [];
  }),


  zoomed2 : computed('zoomed', 'domain', 'zoomedDomain', function () {
    let
    zoomed = this.get('zoomed'),
    domain = this.get('domain'),
    zoomedDomain = this.get('zoomedDomain');
    if (zoomed) {
      zoomed &= (domain[0] !== zoomedDomain[0]) ||
        (domain[1] !== zoomedDomain[1]);
    }
    return zoomed;
  }),

  /** similar to isZoomedOut, this is quicker to evaluate because it
   * only considers the fully-zoomed out case, which means that the
   * total .featureCount for each block can be used instead of
   * calculating .featuresCountIncludingZoom.
   * i.e. if all .dataBlocks[] have block.featureCount < featuresCountsThreshold
   */
  isZoomedRightOut() {
    let out = ! this.zoomed;
    if (out) {
      let
      featuresCountsThreshold = this.get('featuresCountsThreshold');
      out = ! this.dataBlocks.any((b) => b.featureCount <= featuresCountsThreshold);
      dLog('isZoomedRightOut', out, featuresCountsThreshold, this.dataBlocks);
    }
    return out;
  },

  /*--------------------------------------------------------------------------*/

  /** axis-1d receives axisStackChanged and zoomedAxis from draw-map
   * zoomedAxis is specific to an axisID, so respond to that if it matches this.axis.
   */

  resized : function(widthChanged, heightChanged, useTransition) {
    /* useTransition could be passed down to showTickLocations()
     * (also could pass in duration or t from showResize()).
     */
    if (trace_stack)
      dLog("resized in components/axis-1d");
    if (heightChanged)
      this.renderTicksDebounce();
  },

  axisStackChanged : function() {
/*
    dLog("axisStackChanged in components/axis-1d");
    this.renderTicksDebounce();
*/
  },

  /** @return the Stacked object corresponding to this axis. */
  axisS : computed('axis.id', 'stacks.axesPCount', function () {
    let
      axisName = this.get('axis.id'),
    axisS = Stacked.getAxis(axisName);
    if (axisS) {
      if (axisS.axis1d === this && this.isDestroying)
        axisS.axis1d = undefined;
      else if (! axisS.axis1d && ! this.isDestroying) {
        axisS.axis1d = this;
      }
    }
    return axisS;
  }),
  /** @return true if an axis-2d child component is required for this
   * axis, i.e. the axis is split or has data blocks which are QTLs
   * (which are shown as axis-tracks outside-right of the axis, and
   * hence axis-2d and axis-tracks are required.
   */
  is2d : computed('extended', 'dataBlocksQtl.[]', function () {
    return !! this.get('extended') || this.get('dataBlocksQtl.length');
  }),
  /** viewed blocks on this axis.
   * For just the data blocks (depends on .hasFeatures), @see dataBlocks()
   * @desc
   * Related : block : viewedChildBlocks().
   */
  viewedBlocks : computed('axis', 'blockService.axesViewedBlocks2.[]', function () {
    let
    blocks,
    axesBlocks = this.get('blockService.axesViewedBlocks2'),
    referenceBlock = this.get('axis');
      blocks = axesBlocks.get(referenceBlock);
      dLog('viewedBlocks', referenceBlock, axesBlocks, blocks);
    return blocks || [];
  }),
  dataBlocks : computed('viewedBlocks.@each.isData', function () {
    let
    /** block.isData is similar to the block.hasFeatures filtering which is done in loadedViewedChildBlocks() */
    dataBlocks = this.get('viewedBlocks')
      .filter((block) => block.get('isData'));
    dLog('dataBlocks', dataBlocks);
    return dataBlocks;
  }),
  dataBlocksQtl : computed('dataBlocks.[]', function () {
    let
    /** isSNP is constant for a block. */
    qtlBlocks = this.get('dataBlocks')
      .filter((block) => block.get('isQTL'));
    dLog('qtlBlocks', qtlBlocks);
    return qtlBlocks;
  }),

  /** Reverse map dataBlocks : map from blockId to index position within the dataBlocks[].
   *
   * This can replace storeBlockIndex(), which is defined in
   * showTickLocations(); that is calculated at render time, whereas this is
   * dependent on the base data.
   */
  blockIndexes : computed('viewedBlocks.[]', function () {
    // based on axis-tracks.js : blockIndexes(), translated to .reduce.
    let dataBlocks = this.get('viewedBlocks');
    let blockIndexes =
    dataBlocks.reduce(function (result, b, i) {
      let d = b.get('id');  result[d] = i; 
      return result;
    }, {});
    dLog('blockIndexes', blockIndexes, dataBlocks);
    return blockIndexes;
  }),
  colourSlotsUsed : A([]),
  /** assign colour slots to viewed blocks of an axis
   * e.g. slots 0-10 for schemeCategory10
   * @return array mapping colour slots to blocks, or perhaps blocks to slots
   */
  colourSlots : computed('dataBlocks.[]', function () {
    /* 
     * when .viewed blocks changes : for each viewed block
     * if it is viewed and does not have a colour slot assigned
     * look for a slot assigned to a block which is no longer viewed
     * if 1 found, re-use that slot
     * else use an incrementing count (maybe simply append - that would enable 2 identical colours after others are unviewed, but new allocations would be from the initial range because search from start)
     */
    let colourSlots,
    used = this.get('colourSlotsUsed');
    let dataBlocks = this.get('dataBlocks');
    if (trace_stack > 1)
      dLog('colourSlots', used, 'dataBlocks', dataBlocks);
    dataBlocks.forEach((b) => {
      if (b.get('isViewed') && (this.blockColour(b) < 0)) {
        let free = used.findIndex(function (bi, i) {
          return !bi || !bi.get('isViewed');
        });
        if (free > 0)
          used[free] = b;
        else
          used.push(b);
      }
    } );
    colourSlots = used;
    if (trace_stack)
      dLog('colourSlots', colourSlots);
    return colourSlots;
  }),
  colourSlotsEffect : computed('colourSlots.[]', 'dataBlocks.[]', function () {
    let colourSlots = this.get('colourSlots');
    if (trace_stack)
      dLog('colourSlotsEffect', colourSlots, 'colourSlots', 'dataBlocks');
    /** Update the block titles text colour. */
    this.axisTitleFamily();
  }),
  /** @return the colour index of this block
   */
  blockColour(block) {
    let used = this.get('colourSlotsUsed'),
    i = used.indexOf(block);
    if ((trace_stack > 1) && (i === -1) && block.isData) {
      dLog('blockColour', i, block.mapName, block, used, this,
           this.viewedBlocks, this.viewedBlocks.map((b) => [b.mapName, b.isData, b.id]));
    }
    return i;
  },
  /** @return a colour value for .attr 'color'
   * @desc uses axisTitleColour(), which uses this.blockColour()
   */
  blockColourValue(block) {
    let
    blockId = block.get('id'),
    /** Could set up param i as is done in showTickLocations() :
     * featurePathStroke(), but i is only used when axisTitleColourBy is .index,
     * and currently it is configured as .slot.
     */
    colour = axisTitleColour(blockId, /*i*/undefined) || 'black';
    return colour;
    },

  /** @return the domains of the data blocks of this axis.
   * The result does not contain a domain for data blocks with no features loaded.
   *
   * These events are input to the chain dataBlocksDomains -> blocksDomains ->
   *   blocksDomain -> domain -> domainChanged -> scaleChanged
   */
  dataBlocksDomains : computed('dataBlocks.@each.featuresDomain', function () {
    let dataBlocks = this.get('dataBlocks'),
    dataBlockDomains = dataBlocks.map(function (b) { return b.get('featuresDomain'); } )
    /* featuresDomain() will return undefined when block has no features loaded. */
      .filter(d => d !== undefined);
    return dataBlockDomains;
  }),
  referenceBlock : alias('axis'),
  /** @return the domains of all the blocks of this axis, including the reference block if any.
   * @description related @see axesDomains() (draw/block-adj)
   */
  blocksDomains : computed('dataBlocksDomains.[]', 'referenceBlock.range', function () {
    let
      /* alternative :
       * dataBlocksMap = this.get('blockService.dataBlocks'),
       * axisId = this.get('axis.id'),
       * datablocks = dataBlocksMap.get(axisId),
       */
      /** see also domainCalc(), blocksUpdateDomain() */
      blocksDomains = this.get('dataBlocksDomains'),
    /** equivalent : Stacked:referenceDomain() */
    referenceRange = this.get('referenceBlock.range');
    if (referenceRange) {
      dLog('referenceRange', referenceRange, blocksDomains);
      blocksDomains.push(referenceRange);
    }
    return blocksDomains;
  }),
  /** @return the union of blocksDomains[], i.e. the interval which contains all
   * the blocksDomains intervals.
   */
  blocksDomain : computed('blocksDomains.[]', function () {
    let 
      blocksDomains = this.get('blocksDomains'),
    domain = intervalExtent(blocksDomains);
    dLog('blocksDomain', blocksDomains, domain);
    return domain;
  }),
  /** if domain is [0,0] or [false, false] then consider that undefined. */
  domainDefined : computed('domain.0', 'domain.1', function () {
    let domain = this.get('domain'),
    defined = ! noDomain(domain);
    return defined;
  }),
  /** Update the domain of the Y scales. */
  updateScaleDomain() {
    if (this.isDestroyed) return undefined;
    let domain = this.get('domain'),
    domainDefined = this.get('domainDefined');
    if (domain && domainDefined) {
      /* Similar to this.updateDomain(), defined in axis-position.js, */
      let axisS = this.get('axisS');
      dLog('updateScaleDomain', domain, axisS);
      if (axisS) {
        let y = axisS.getY(), ys = axisS.ys;
        updateDomain(axisS.y, axisS.ys, axisS, domain);
      }
    }
    return domain;
  },
  /** This is the currently viewed domain.
   * @return if zoomed return the zoom yDomain, otherwise blockDomain.
   * Result .{0,1} are swapped if .flipped.
   */
  domain : computed('zoomed', 'flipped', 'blocksDomain', 'zoomedDomain'/*Throttled*/, function () {
    /** Actually .zoomedDomain will be == blocksDomain when not zoomed, but
     * using it as a CP dependency causes problems, whereas blocksDomain has a
     * more direct dependency on axis' blocks' features' locations.
     * When .zoomed is set, .zoomedDomain may be undefined briefly; if so use .blocksDomain.
     */
    let domain = this.get('zoomed') ? this.get('zoomedDomain') || this.get('blocksDomain') : this.get('blocksDomain');
    if (this.get('flipped')) {
      domain = [domain[1], domain[0]];
    }
    return domain;
  }),


  /** count of features of .dataBlocks
   * Maybe : Also depend on block.featuresForAxis, to trigger a request for features of
   * a block when it is added to an axis.
   */
  featureLength : computed(
    /** depend on both featuresLength{Debounced,Throttled} because we want a
     * steady flow of updates (throttled) and the trailing edge / final value
     * update (debounced).  In practice, Features are received in bursts (API
     * responses) so the throttled events may not occur.
     * lodash has options to combine these features into a single function.
     */
    'dataBlocks.@each.{featuresLengthDebounced,featuresLengthThrottled,featuresForAxis}', 
    function () {
    let dataBlocks = this.get('dataBlocks'),
    featureLengths = dataBlocks.map(function (b) { return b.get('featuresLength'); } ),
    featureLength = sum(featureLengths);
    /** This is only intended to trigger an initial featuresForAxis, but changes
     * in dataBlocks[*].featuresLength will trigger this CP, so it would be
     * recursive to request featuresForAxis here.
     * If enabled this seems to cause "Cannot read property 'nextSibling' of null" in DOMChanges.insertAfter (runtime.js)
     * seemingly because of multiple requests in a short time.
     */
    let featuresForAxis; // = dataBlocks.map(function (b) { return b.get('featuresForAxis'); } );
    dLog(this, dataBlocks, featureLengths, 'featureLength', featureLength, featuresForAxis /*.length*/);
    let axisS = this.get('axisS'); if (axisS && trace_stack) axisS.log();
    return featureLength;
  }),
  /** When featureLength changes, render.
   * The suffix Effect is used to denote a Side Effect triggered by a CF.
   */
  featureLengthEffect : computed('featureLength', 'flipRegionCounter', 'axisS', function () {
    let featureLength = this.get('featureLength');

    this.renderTicksDebounce();
    this.updateBrushedFeatures();

    /** Update the featureCount shown in the axis block title */
    this.axisTitleTextBlockCount();
    if (featureLength)
      dLog('featureLengthEffect', this.get('axis.id'), featureLength);

    return featureLength;
  }),
  updateBrushedFeatures() {
    let axisApi = stacks.oa.axisApi,
    /** defined after first brushHelper() call. */
    axisFeatureCirclesBrushed = axisApi.axisFeatureCirclesBrushed;
    if (axisFeatureCirclesBrushed) {
      next(axisFeatureCirclesBrushed);
    }
  },
  /** When values change on user controls which configure the brush,
   * re-calculate the brushed features.
   */
  brushControlEffect : computed(
    'controlsView.featureIntervalContain',
    'controlsView.featureIntervalOverlap',
    'controlsView.tickOrPath',
    function () {
      this.updateBrushedFeatures();
    }),
  axisTitleFamily() {
    let axisApi = stacks.oa.axisApi;
    let axis = this.get('axisS');
    if (axis) {
      let
        gAxis = axis.selectAll(),
      axisTitleS = gAxis.select("g.axis-outer > g.axis-all > text");
      dLog(
        'axisTitleFamily', axisTitleS.nodes(), axisTitleS.node(),
        gAxis.nodes(), gAxis.node());
      axisApi.axisTitleFamily(axisTitleS);
    }
  },
  updateAxisTitleSize() {
    let axisApi = stacks.oa.axisApi;
    let axis = this.get('axisS');
    if (axis) {
      let
        gAxis = axis.selectAll();
      axisApi.updateAxisTitleSize(gAxis);
    }
  },

  /** Update the display of the feature (loaded / total) count in the
   * axis title text for the data blocks.
   *
   * This is a small part of draw-map.js : axisTitleFamily(), and it
   * is used in response to receipt of features (possibly via paths),
   * which may be via zoomedDomain change.  So the usage is high
   * frequency, and the remainder of axisTitleFamily() is not needed
   * for these updates.
   */
  axisTitleTextBlockCount() {
    let subTitleS = this.get('axisSelectTextBlock');
    // dLog('axisTitleTextBlockCount', subTitleS.nodes(), subTitleS.node());
    subTitleS
      .text(function (block) { return block.titleText(); });
    if (true || trace_stack) {
      let nodes = subTitleS.nodes(),
          lastNode = nodes.length ? nodes[nodes.length - 1] : null;
      dLog('axisTitleTextBlockCount', nodes, lastNode);
    }
  },

  /** d3 selection of .axis-outer of this axis.
   * Equivalent : this.get('axisS').selectAll(), which does a selection by id
   * from svgContainer through g.stack to the g.axis-outer.
   */
  axisSelect : computed('axis.id', function () {
    let 
      axisId = this.get('axis.id'),
    /** could narrow this to svgContainer, but probably not a performance
     * improvement, and if we have multiple draw-maps later, the map id can be
     * included in eltId() etc. */
    as = d3.selectAll(".axis-outer#" + eltId(axisId));
    return as;
  }),

  /** d3 selection of tspan.blockTitle of this axis.
   */
  axisSelectTextBlock : computed('axisSelect', function () {
    let
    gAxis = this.get('axisSelect'),
    axisTitleS = gAxis.selectAll("g.axis-all > text"),
    subTitleS = axisTitleS.selectAll("tspan.blockTitle");
    return subTitleS;
  }),

  /** d3.select g.groupName within g.axis-all > g.axis-1d
   * Create g.axis-1d and g.groupName if needed.
   */
  selectGroup(groupName) {
    let resultG;
    let axisS = this.get('axisS');

    if (! axisS) {
      resultG = d3.select();
    } else {
      let
      /** this selects g.axis-outer.  It matches axisS .stack.stackID also.  equivalent : this.axisSelect(). */
      gAxis = axisS.selectAll(),
      /** compare : selectAxis(axisS) selects g.axis-outer > g.axis-all > g.axis. 
       * This is similar to axisTitleFamily(), could be factored. */
      aS = gAxis.selectAll('g.axis-outer > g.axis-all'),
      /** select/create the component g.axis-1d */
      gcA = selectGroup(aS, componentName, undefined, undefined, undefined, undefined),
      /** In earlier versions, horizTick <path> was used to show scaffolds,
       * which were distinguished by blockWithTicks() (i.e. .showPaths===false),
       * and were only shown when not split axis (notWhenExtended, i.e.
       * ! .extended).
       * scaffolds are now represented using split axis tracks, so that use case
       * is no longer required.
       * All the axis-1d elements (triangles, labels, spanning line) are shown regardless of .extended.
       */
      blocks = axisS.blocks,
      gA = selectGroup(gcA, groupName, blocks, blockKeyFn, blockTickEltId(groupName), [className]);
      resultG = gA;

    }
    return resultG;
  },
    

  get transitionTime() {
    return this.get('axisZoom.axisTransitionTime');
  },
  selectionToTransition(selection) {
    return this.get('axisZoom').selectionToTransition(selection);
  },

  /*--------------------------------------------------------------------------*/

  /** Calculate current scaled position of the given feature on this axis.
   */
  featureY(feature) {
    let
    /* alternative :
    axisName = this.get('axis.id'),
    ak = axisName,
    y = stacks.oa.y[ak],
    */
    axisS = this.get('axisS'),
    y = axisS && axisS.getY(),
    ys = axisS && axisS.ys,

    range = getAttrOrCP(feature, 'range') || getAttrOrCP(feature, 'value'),
    tickY = range && (range.length ? range[0] : range),
    /** scaled to axis.
     * Similar : draw-map : featureY_(ak, feature.id);     */
    akYs = y(tickY);
    return akYs;
  },

  inDomain(feature) {
    let
    /** comment re. getAttrOrCP() in @see keyFn() */
    value = getAttrOrCP(feature, 'value'), // feature.get('value'),
    domain = this.currentDomain,
    overlap = intervalOverlap([value, domain]);
    return overlap;
  },
  inRange(feature) {
    let
    axisS = this.get('axisS'),
    range0 = axisS.yRange2(),
    overlap = this.inRangeR(feature);
    return overlap;
  },
  inRangeR(feature, range0) {
    let
    axisS = this.get('axisS'),
    y = this.featureY(feature),
    yScale = axisS.getY(),
    value = getAttrOrCP(feature, 'value'), // feature.value,
    yInterval = value.length ? value.map(yScale) : yScale(value),
    overlap = value.length === 1 ?
      inRange(yInterval[0], range0) :
      value.length ? intervalOverlap([yInterval, range0]) :
      inRange(yInterval, range0);
    return overlap;
  },

  /*--------------------------------------------------------------------------*/

  /** @param [axisID, t] */
  zoomedAxis : function(axisID_t) { },

  /** position when last pathUpdate() drawn. */
  position : alias('lastDrawn.yDomain'),
  /** position as of the last zoom. */
  zoomedDomain : alias('currentPosition.yDomain'),
  zoomedDomainDebounced : alias('currentPosition.yDomainDebounced'),
  zoomedDomainThrottled : alias('currentPosition.yDomainThrottled'),

  /** Updates when the array elements of .domain[] update.
   *  @return undefined; value is unused.
   */
  domainChanged : computed(
    'domain.0', 'domain.1',
    function () {
      if (this.isDestroyed) return undefined;
      let domain = this.get('domain'),
      domainDefined = this.get('domainDefined');
      // domain is initially undefined or []
      if (domain && domainDefined) {
        // use the VLinePosition:toString() for the position-s
        dLog('domainChanged', domain, this.get('axisS'), ''+this.get('currentPosition'), ''+this.get('lastDrawn'));
        // this.notifyChanges();
        if (! this.get('axisS'))
          dLog('domainChanged() no axisS yet', domain, this.get('axis.id'));
        else {
          this.updateScaleDomain();
          throttle(this, this.updateAxis, this.get('controlsView.throttleTime'));
        }
      }
      return domainDefined && domain;
    }),
  /** Update when the domain has changed and the scale has been updated.
   */
  scaleChanged : computed('domainChanged', function () {
    let scale, domainDefined = this.get('domainChanged');
    dLog('scaleChanged', domainDefined);
    if (domainDefined) {
      let axisS = this.get('axisS');
      if (axisS) {
        let y = axisS.getY(), ys = axisS.ys;
        scale = y;
      }
    }
    return scale;
  }),
  notifyChanges() {
    let axisID = this.get('axis.id');
    dLog('notifyChanges', axisID);

    let axisApi = stacks.oa.axisApi;
    let t = stacks.oa.svgContainer; // .transition().duration(750);

    let eventBus = stacks.oa.eventBus;

    let p = axisID;
    eventBus.trigger("zoomedAxis", [axisID, t]);
    // true does pathUpdate(t);
    axisApi.axisScaleChanged(p, t, true);

    axisApi.axisStackChanged(t);
  },
  updateAxis() {
    // subset of notifyChanges()
    let axisApi = stacks.oa.axisApi;
    let axisID = this.get('axis.id');
    dLog('updateAxis', axisID);
    let t = stacks.oa.svgContainer; //.transition().duration(750);
    axisApi.axisScaleChanged(axisID, t, true);
  },
  drawTicks() {
    /** based on extract from axisScaleChanged() */
    let
      axisTicks = 10,
    axisId = this.get('axis.id'),
    axisS = this.get('axisS'),
    yScale = axisS && axisS.y;
    if (yScale) {
      let yAxis = axisS.axisSide(yScale).ticks(axisTicks * axisS.portion);

      /** axisSelect is the g.axis-outer.  structure within that is :
       *                id prefix  prefix function
       * g.axis-outer   id         eltId()
       * > g.axis-all   all        eltIdAll()
       * > g.axis       a          axisEltId()
       * The d3 axis function is called on the g.axis.
       */
      let gAxis = this.get('axisSelect')
        .select("#" + axisEltId(axisId))
        /*.transition().duration(750)*/;
      gAxis.call(yAxis);
      dLog('drawTicks', axisId, axisS, gAxis.nodes(), gAxis.node());

      
      function showText(text) {
        if (! this.get('headsUp.isDestroying')) {
          this.set('headsUp.tipText', text);
        }
      }
      gAxis.selectAll('text')
        .on('mouseover', showText.bind(this, 'Ctrl-click to drag axis'))
        .on('mouseout', showText.bind(this, ''));
    }
  },

  ensureAxis : computed('viewedBlocks', function () {
    let viewedBlocks = this.get('viewedBlocks');
    let axisApi = stacks.oa.axisApi;
    let count = viewedBlocks.length;
    viewedBlocks.forEach((block) => {
      if (! block.get('axis'))
        axisApi.ensureAxis(block.id);
      if (! block.get('axis'))
        count--;
    });
    return count;
  }),

  extendedEffect : computed('extended', function () {
    let
    extended = this.get('extended'),
    axisID = this.get('axis.id');
    dLog('extended', extended, axisID);
    // possibly ... pass an action param.
    let axis2d = this.get('axis2d');
    if (axis2d) {
      next(() => ! axis2d.isDestroyed && axis2d.axisWidthResizeEnded());
    }

    this.showExtendedClass();
    this.drawTicks();

    if (extended)
      this.removeTicks();
    else
    {
      let axisID_t = [axisID, undefined];
      this.renderTicksDebounce(axisID_t);
    }

    /* when split axis is closed,
     * updateAxisTitleSize() is called in willDestroyElement()->axisWidthResizeEnded()->stacksAdjust()
     * when split axis is opened or closed, widthEffects()->this.updateAxisTitleSize() -> updateAxisTitleSize()
     */

    this.widthEffects();

    return extended;
  }),

  extendedWidthEffect : computed(/*'extended',*/ 'axis2d.allocatedWidthsMax.centre', function () {
    this.widthEffects();
  }),
  widthEffects() {
    this.showZoomResetButtonXPosn();

    let axisApi = stacks.oa.axisApi;
    axisApi.updateXScale();
    axisApi.collateO();

    /** .extended has changed, so the centre of the axisTitle is changed. */
    this.axisTitleFamily();
    this.updateAxisTitleSize();
  },

  /*--------------------------------------------------------------------------*/


  didReceiveAttrs() {
    this._super(...arguments);
    this.get('featureTicks') || this.constructFeatureTicks();
  },
  didInsertElement() {
    this._super(...arguments);
    dLog('axis-1d didInsertElement', this, this.get('listen') !== undefined);
  },
  willDestroyElement() {
    dLog('willDestroyElement', this.get('axis.id'));
    this.removeTicks();
    let axisS = this.get('axisS');
    if (axisS) {
      if (axisS.axis1d === this)
        delete axisS.axis1d;
    }
    let axisName = this.get('axis.id');
    Stacked.axis1dRemove(axisName, this);
    next(() => this.axis1dExists(this, false));

    this._super(...arguments);
  },
  /*--------------------------------------------------------------------------*/
  removeTicks() {
    /** Select all the <path.horizTick> of this axis and remove them.
     * Could use : this.renderTicks() because when ! axis.extended,
     * showTickLocations() will use features == [], which will remove ticks;
     */
    let axis = this.get('axis'),
    aS = selectAxis(axis),
    pS = aS.selectAll("path." + className);
    pS.remove();
  },
  didRender() {
    this.renderTicksDebounce();
  },
  constructFeatureTicks () {
    /** There is 1 axis-1d component per axis, so here `block` is an axis (Stacked),
     * Can rename it to axis, assuming this structure remains.
     */
    let block = this.get('axis'), blockId = block.get('id');
    dLog('constructFeatureTicks', blockId, this);
    let axisApi = this.get('drawMap.oa.axisApi');
    let oa = this.get('drawMap.oa');
    let axis = oa.axes[blockId];
    // dLog('axis-1d renderTicks', block, blockId, axis);

    /* If block is a child block, don't render, expect to get an event for the
     * parent (reference) block of the axis. */
    if (! axis)
      dLog('renderTicks block', block, blockId, oa.stacks.blocks[blockId]);
    else {
      let featureTicks = new FeatureTicks(axis, axisApi, this);
      dLog('featureTicks', featureTicks);
      this.set('featureTicks',  featureTicks);
    }
  },
  renderTicks() {
    let featureTicks = this.get('featureTicks');
    if (! featureTicks && this.get('axisS')) {
      this.constructFeatureTicks();
      featureTicks = this.get('featureTicks');
    }
    if (! featureTicks)
      dLog('renderTicks', featureTicks);
    /* originally used to show the edges of scaffolds, which are now shown
     * within the split axis, so this is not required atm; there might be a case
     * for marking scaffold edges with a horizontal line (not a triangle) when
     * the axis is not open, viewing paths.
    else
      featureTicks.showTickLocations(undefined, true, 'notPaths', true);
      */
  },
  /** call renderTicks().
   * filter / debounce the calls to handle multiple events at the same time.
   * @param axisID_t is defined by zoomedAxis(), undefined when called from
   * axisStackChanged()
   */
  renderTicksDebounce(axisID_t) {
    // dLog('renderTicksDebounce', axisID_t);
    // renderTicks() doesn't use axisID_t; this call chain is likely to be refined yet.
    /* using throttle() instead of debounce() - the former has default immediate==true.
     * It is possible that the last event in a group may indicate a change which
     * should be rendered, but in this case it is likely there is no change
     * after the first event in the group.
     */
    // throttle(this, this.renderTicks, axisID_t, 500);
    run_once(() => this.renderTicks(axisID_t))
  },

  /** Give the g.axis-outer a .extended class if the axis is split.
   * .extended interacts with .rightmost in the CSS rules which place axis ticks on the right side of the rightmost axis.
   */
  showExtendedClass()
  {
    let
      as = this.get('axisSelect');
    as.classed("extended", this.get('extended'));
  },
  buttonStateEffect : computed('brushed', 'zoomed', function () {
    this.showZoomResetButtonState();
  }),
  showZoomResetButtonState() {
    let
    as = this.get('axisSelect'),
    gb = as.selectAll('g.btn');
    gb.attr('class', () => 'btn graph-btn ' + ['brushed', 'zoomed'].filter((state) => this.get(state)).join(' '));
    dLog('showZoomResetButtonState', gb.node(), this.get('brushed'), this.get('zoomed'), this.get('zoomed2'), this.get('axisBrush.brushedAxes'));
  },
  showZoomResetButtonXPosn() {
    if (! (this.isDestroying || this.isDestroyed) && this.axis.get('isViewed')) {
      let
      as = this.get('axisSelect'),
      gb = as.selectAll('g.btn');
      gb
        .attr('transform', yAxisBtnScale);
    }
  }
  
});

