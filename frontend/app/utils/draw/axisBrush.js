import {
  once,
  later,
  debounce,
  bind,
} from '@ember/runloop';

//------------------------------------------------------------------------------

/* Originally used scheduleIntoAnimationFrame() from github.com/runspired/ember-run-raf
 * which uses github.com/kof/animation-frame to wrap requestAnimationFrame().
 * Installed via : npm --expose-internals install --save ember-run-raf
 * Tried import, e.g.  import scheduleIntoAnimationFrame from 'npm:ember-run-raf/addons/utils/schedule-frame';
 * Seems not updated to Ember 3.22
 *
 * Now using : github.com/html-next/ember-raf-scheduler
 */

// ember-raf-scheduler is not updated for Ember v4
// import { scheduler } from 'ember-raf-scheduler';
const scheduler = undefined;

//------------------------------------------------------------------------------

import { isEqual } from 'lodash/lang';

//------------------------------------------------------------------------------

import {
  eltClassName,
} from '../domElements';

import {
  maybeFlip,
  ensureYscaleDomain,
  yAxisTicksScale, yAxisBtnScale,
  eltId, axisEltId,
  axisEltIdClipPath,
  selectAxisOuter,
  axisFeatureCircles_eltId,
  axisFeatureCircles_selectAll,
  axisFeatureCircles_selectOneInAxis,
} from './axis';
import { I } from './d3-svg';

import {
  Stacked,
  Block,
} from '../stacks';

import { breakPoint } from '../breakPoint';
import { subInterval, wheelNewDomain, ZoomFilter } from './zoomPanCalcs';
import { intervalsEqual, intervalIntersect } from '../interval-calcs';


import {
  isOtherField
} from '../field_names';

import {
  unique_1_1_mapping 
} from '../paths-config';

import { PathInfo } from './path-info';
import { PathDataUtils } from './path-data';

//------------------------------------------------------------------------------

/* global d3 */
/* global CSS */
/* global WheelEvent */

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace_scale_y = 0;
const trace_gui = 0;

//------------------------------------------------------------------------------

/** Select paths.
 * selects the g which may have .faded added.  Exclude g.progress because
 * featureNotSelected2() does not yet support its datum type, and we
 * should check with users if this feature should be maintained or varied.
 */
const fadedSelector = ".foreground > g:not(.progress) > g";

//------------------------------------------------------------------------------

// let  bbox  = { x: 1, y : 2, width: 20, height : undefined };

/** Add <clipPath><rect /><g clip-path= />
 * This is used within an axis to wrap the content of g.brush, provided a clip
 * rect for the brush elements.
 * @param gp  <g.brush>
 * @param axis1d
 * @return selection of g[clip-path], used by the caller to insert the brush elements.
 */
function brushClip(gp, axis1d) {

  let gpp = gp.node().parentElement;

  // there may be a delay before getBBox is available.  if so, return an empty selection.
  if (! gpp.getBBox)
    return d3.select(undefined);

  let bbox = gpp.getBBox();

  let
  gc = gp.selectAll("g > clipPath")
    .data([axis1d]),
  gr = gc.enter()
  // define the clipPath
    .append("clipPath")       // define a clip path
    .attr("id", axisEltIdClipPath) // give the clipPath an ID
    .append("rect"),          // shape it as a rect
  gprm = gp.selectAll("clipPath > rect")
    .attr("x", bbox.x)
    .attr("y", bbox.y + 30)
    .attr("width", bbox.width)
    .attr("height", bbox.height - 30)
  ;
  const
  gg = 
    gp.selectAll("g > [clip-path]"),
  g = gg
    .data([axis1d])
    .enter()
    .append("g")
    .attr("clip-path", (axis1d) => "url(#" + axisEltIdClipPath(axis1d) + ")") // clip with the rectangle
    .merge(gg);

  dLog(axis1d, bbox, 'brushClip', gp.node(), gprm.node(), gg.node(), g.node());

  return g;
}

/*--------------------------------------------------------------------------*/

/** Select the brush of brushedAxisID.
 * @return d3 selection of the brushed axis.
 */
function axisBrushSelect(svgContainer, brushedAxis1d) {
  // copied from showAxisZoomResetButtons()
  let axisS = svgContainer.selectAll("#" + eltId(brushedAxis1d));
  /** this is the element which is passed when called via
   * zoomBehavior.on('zoom', zoom)
   * so pass the same element when calling via g.btn .Zoom .on('click' ).
   */
  let gBrush = axisS.selectAll('g.brush > g[clip-path]').node();
  return gBrush;
}

/** fixed classes of the <g> containing the Axis Zoom/Reset buttons.
 * The g.btn and buttons can be factored to form a Component.
 */
const axisZoomResetButtonClasses = 'btn graph-btn';

function showAxisZoomResetButtons(svgContainer, zoom, resetZoom, brushedAxis1d) {
  // `used as the basis of axisBrushSelect
  /** d3 selection of the brushed axis. */
  let axisS = svgContainer.selectAll("#" + eltId(brushedAxis1d));
  /** this is the element which is passed when called via
   * zoomBehavior.on('zoom', zoom)
   * so pass the same element when calling via g.btn .Zoom .on('click' ).
   */
  let that = axisS.selectAll('g.brush > g[clip-path]').node();
  let zoomResetNames = ['Zoom', 'Reset'];
  let gS = axisS
      .selectAll('g.btn')
      .data([1]);
  const
  gE = gS
    .enter()
    .append('g')
    .attr('class', axisZoomResetButtonClasses);
  gE
    .selectAll('rect')
    .data(zoomResetNames)
    .enter()
    .append('rect')
    .attr('class', (d,i) => zoomResetNames[i]);
  let g = gS.merge(gE);
  g
    .attr('transform', yAxisBtnScale);
  gE
    .selectAll('text')
    .data(zoomResetNames)
    .enter()
    .append('text')
    .attr('class', (d,i) => zoomResetNames[i])
    .attr('x', (d,i) => i*55).attr('y', 20)
    .text(I);
  g.on('mousedown', function () {
    d3.event.stopPropagation();
  });
  /** parallel with zoomResetNames[], [0] is Zoom and [1] is Reset. */
  g
    .selectAll('.Zoom')
    .on('click', function () {
      d3.event.stopPropagation();
      const brushedDomain = brushedAxis1d.brushedDomain;
      if (brushedDomain) {
        zoom(that, /*i*/undefined, /*g*/undefined, brushedDomain);
      }
      // zoomed = true; // not used.

      //reset function
      //Remove all the existing circles
      axisFeatureCircles_selectAll().remove();

    });
  let
  resetSwitch = g.selectAll('.Reset');
  resetSwitch
    .on('click',function(){resetZoom(brushedAxis1d); });

  dLog("showAxisZoomResetButtons g", g.nodes());
  brushedAxis1d.showZoomResetButtonState();
}


/*--------------------------------------------------------------------------*/

function AxisBrushZoom(oa) {
  const
  me = oa.eventBus,
  pathDataUtils = PathDataUtils(oa);
  

  const result = {
    setupBrushZoom,
    brushClipSize,
    getBrushedRegions, axisRange2DomainFn, axisRange2Domain, axisBrushShowSelection,
    brushHelper, resetZooms, resetBrushes, removeBrushExtent, resetZoom,
    axisFeatureCircles_selectAll, handleFeatureCircleMouseOver, handleFeatureCircleMouseOut, brushEnableFeatureHover, zoom, axisScaleChangedRaf, axisScaleChanged, brushended, 
    draw_flipRegion, /* containing : features2Limits, flipRegionInLimits, */
    triggerZoomedAxis, throttledZoomedAxis,
  };
  

  //----------------------------------------------------------------------------

  const zoomBehavior = zoomBehaviorSetup(oa);

  function zoomBehaviorSetup(oa) {
    const zoomFilterApi = ZoomFilter(oa);
    const
    zoomBehaviorLocal = d3.zoom()
      .filter(zoomFilterApi.zoomFilter)
      .wheelDelta(zoomFilterApi.wheelDelta)
    /* use scaleExtent() to limit the max zoom (zoom in); the min zoom (zoom
     * out) is limited by wheelNewDomain() : axisReferenceDomain, so no
     * minimum scaleExtent is given (0).
     * scaleExtent() constrains the result of transform.k * 2^wheelData( ),
     */
      .scaleExtent([0, 1e8])
      .on('zoom', zoom)
    ;
    // console.log('zoomBehavior', zoomBehaviorLocal);
    return zoomBehaviorLocal;
  }

  //----------------------------------------------------------------------------

  function setupBrushZoom(allG) {
    // Add a brush for each axis.
    let gBrushParent =
        allG.append("g")
        .attr("class", "brush");

    if (! gBrushParent.empty()) {
      /** brushClip() uses getBBox(), so call again after the geometry has settled.
       * If this works reliably, it might suggest splitting the append(clipPath)
       * from the geometry setting.
       * The 2sec call should be fine for most computers, some might take until
       * 5sec to settle the geometry.
       */
      brushClipSize(gBrushParent);
      later(() => ! me.isDestroying && this.brushClipSize(gBrushParent), 2000);
      later(() => ! me.isDestroying && this.brushClipSize(gBrushParent), 5000);
    }

    if (! allG.empty()) {
      console.log('zoomBehavior', allG.nodes(), allG.node());
      allG
        .call(zoomBehavior);
    }
  }

  /** Ensure there is clipPath & rect in gBrushParent, and set its geometry. */
  function brushClipSize(gBrushParent) {
    gBrushParent
      .each(function(axis1d) {
        if (axis1d.isDestroying) {
          return;
        }
        brushClip(d3.select(this), axis1d)
          .each(function(d) { d3.select(this).call(axis1d.y.brush); });
      });
  }

  //----------------------------------------------------------------------------

  /** Could use this instead of maintaining oa.brushedRegions :
   */
  function getBrushedRegions() {
    /** e.__brush :
     *   dim: Object { name: "y", handles: (2) [], input: input(y, e),  } // configuration
     *   extent: Array [ (2) [], (2) [] ]     // rect which can be brushed i.e. maximum range of thumb
     *   selection: Array [ (2) [], (2) [] ]    // current selection, i.e. range of thumb
     */
    let brushedRegions = d3.selectAll('g.brush > g[clip-path]').nodes().reduce((br, e) => {
      let s = e.__brush.selection;
      br[e.__data__] = [s[0][1], s[1][1]];
      return br;
    }, {});
    return brushedRegions;
  }

  /** Convert the given brush extent (range) to a brushDomain.
   * @param axis1d
   * @return function to convert range a value to a domain value.
   * undefined if scale has no domain.
   */
  function axisRange2DomainFn(axis1d)
  {
    let
    yp = axis1d.y;
    let ypDomain = yp.domain();
    if (! ypDomain || ! ypDomain.length)
      return undefined;
    function fn(ypx) { return yp.invert(ypx /* *axis1d.portion */); };
    return fn;
  }
  /** Convert the given brush extent (range) to a brushDomain.
   * @param axis1d
   * @param range a value or an interval in the axis range.  This may be e.g. a brush extent
   * @return domain the (reverse) mapping of range into the axis domain.
   * undefined if range is undefined.
   */
  function axisRange2Domain(axis1d, range)
  {
    // axisRange2Domain{,Fn} are factored from axisBrushedDomain(), and brushHelper()
    let
    r2dFn = axisRange2DomainFn(axis1d);
    if (! r2dFn) {
      dLog('axisRange2Domain', axis1d.axisName, range, 'scale has no domain', axis1d.y.domain());
      return undefined;
    }
    if (! range) {
      return undefined;
    }
    let
    brushedDomain = range.length ? range.map(r2dFn) : r2dFn(range);
    if (range.length && axis1d.flipped)
    {
      // similar maybeFlip(brushedDomain, axis1d.flipped), defines a new array.
      let swap = brushedDomain[0];
      brushedDomain[0] = brushedDomain[1];
      brushedDomain[1] = swap;
    }
    if (trace_scale_y)
      dLog('axisRange2Domain', axis1d.axisName, range, brushedDomain);
    return brushedDomain;
  }

  /** update brush selection position for window / element height resize.
   * @param gBrush  <g clip-path> within <g.brush>
   */
  function axisBrushShowSelection(axis1d, gBrush) {
    const
    yp = axis1d.y,
    brushedAxisID = axis1d.axisName;
    /* based on similar functionality in zoom() which updates brush
     * extent/position for (zoom) scale change (brushedDomain does not change).
     *
     * If axisBrush.brushedDomain is not available, can use brushedDomains
     * calculated from existing brush extent in showResize before the scale is changed.
     */
    let brushedDomain;
    if (! brushedDomain) {
      let axisBrush = axis1d.axisBrushObj;
      brushedDomain = axisBrush && axisBrush.get('brushedDomain');
    }
    if (brushedDomain) {
      let newBrushSelection = brushedDomain.map(function (r) { return yp(r);});
      console.log('axisBrushShowSelection', brushedAxisID, brushedDomain, gBrush, newBrushSelection);
      if ((newBrushSelection[0] < -1e3) || (newBrushSelection[1] > 1e4)) {
        // when zoomedDomain is set by setDomainFromDawn(), the current brush is likely to be way out of scope.
        dLog('brush selection is large after scale change - removing', brushedAxisID);
        removeBrushExtent(axis1d);
        newBrushSelection = null; // clear the brush selection
      }
      if (newBrushSelection) {
        /* brush extent is required to be +ve interval. */
        newBrushSelection = maybeFlip(newBrushSelection, newBrushSelection[0] > newBrushSelection[1]);
      }
      d3.select(gBrush).call(yp.brush.move, newBrushSelection);
    }
  }

  /** Used when the user completes a brush action on the axis axis.
   * The datum of g.brush is the axis-1d of its axis, call this axis1d.
   * If null selection then remove axis1d from selectedAxes[], otherwise add it.
   * Update selectedFeatures{}, axis1d.brushedRegion : if selectedAxes[] is empty, clear them.
   * Otherwise, set axis1d.brushedRegion to the current selection (i.e. of the brush).
   * Set axis1d.brushedRegion and .brushedDomain to the (pixel) range and domain
   * respectively of the brush selection / thumb.
   * For each axis in selectedAxes[], clear selectedFeatures{} then store in it the
   * names + locations of features which are within the brush extent of the axis.
   * Add circle.axisID for those feature locations.
   * Remove circles of features (on all Axes) outside axis1d.brushedDomain.
   * For elements in '.foreground > g.flowName > g', set class .faded iff the feature (which
   * is the datum of the element) is not in the selectedFeatures[] of any axis.
   *
   * Draw buttons to zoom to the axis1d-s .brushedDomain (zoomSwitch) or discard the brush : resetSwitch.
   * Called from brushended(), which is called on(end) of axis brush.
   *
   * @param that  the brush g element.
   * The datum of `that` is the name/ID of the axis which owns the brushed axis.
   * 
   */
  function brushHelper(that) {
    const fnName = 'brushHelper';
    const axisApi = oa.axisApi;
    // Chromosome name, e.g. 32-1B
    /** name[0] is axis1d of the brushed axis. name.length should be 1. */
    let name = d3.select(that).data();
    const
    brushedAxis1d = name[0],
    axis1d = brushedAxis1d;

    let brushedAxisID = axis1d.axisName;

    const selectedAxes = oa.selectedAxes;
    let svgContainer = oa.svgContainer;
    //Remove old circles.
    axisFeatureCircles_selectAll().remove();
    let
    brushRange = d3.event.selection,
    /** d3.mouse() calls : function point(node, event) { .. point.x = event.clientX, point.y = event.clientY;
     * so don't call mouse if those are undefined.
     */
    eventHasClientXY = (d3.event.clientX !== undefined) && (d3.event.clientX !== undefined),
    mouse = brushRange && eventHasClientXY && d3.mouse(that);
    let brushSelection = d3.brushSelection(d3.select(that));
    const
    brush_ = that.__brush,
    brushSelection_ = brush_.selection,
    brushExtent_ = brush_.extent;

    if (trace_gui) {
      dLog(
        fnName, that, brushedAxisID, selectedAxes, brushRange, axis1d.brushedRegion,
        brushSelection, mouse,
        brushSelection_ ? '' + brushSelection_[0] + '' + brushSelection_[1] : '', ', ',
        brushExtent_ ? '' + brushExtent_[0] + ',' + brushExtent_[1] : ''
      );
    }

    /* d3.event.selection is null when brushHelper() is called via zoom() ... brush.move.
     * This causes selectedAxes to update here; when an axis is zoomed its brush is removed.
     */
    if (brushRange == null) {
      removeBrushExtent(axis1d);
    }
    else {
      selectedAxes.addObject(axis1d);
      axis1d.set('brushedRegion', brushRange);
    }

    const
    ab = brushRangeToDomain(axis1d, brushRange),
    axisBrush = ab.axisBrush,
    /** equiv : axis.referenceBlock */
    limits = axisBrush.get('block.limits')
      || axisBrush.get('block.axis.domain')
      || axisBrush.get('block.axis.referenceBlock.range');


    // selectedAxes is an array containing the IDs of the Axes that
    // have been selected.

    if (selectedAxes.length > 0) {
      axisFeatureCirclesBrushed(axis1d);

      if (! oa.axisApi.axisFeatureCirclesBrushed) {
        oa.axisApi.axisFeatureCirclesBrushed = axisFeatureCirclesBrushed;
      }


      showAxisZoomResetButtons(svgContainer, zoom, bind(this, resetZooms, axis1d), axis1d);

    } else {
      // brushHelper() is called from brushended() after zoom, with selectedAxes.length===0
      // At this time it doesn't make sense to remove the resetSwitch button

      // No axis selected so reset fading of paths or circles.
      dLog(fnName, selectedAxes.length);
      // some of this may be no longer required
      if (false)
        svgContainer.selectAll(".btn").remove();
      axisFeatureCircles_selectAll().remove();
      d3.selectAll(fadedSelector).classed("faded", false);
      axisApi.selectedFeatures_clear();
      /* clearing .brushedRegion is not needed here because resetBrushes() (by
       * clearing the brushes) causes brushHelper() to reset brushedAxis1d.brushedRegion
       */
    }


    /** brushHelper() may be called when brushedDomain has not changed :
     * d3.select(gBrush).call(yp.brush.move, newBrushExtent);
     * calls brushended(), which calls brushHelper().
     * Don't set brushedDomain when it has not changed, because it is a
     * dependency of many CPs.
     * Related : brushIntersectionChanged.
     */
    if (! isEqual(ab.brushedDomain, axisBrush.brushedDomain)) {
      axisBrush.set('brushedDomain', ab.brushedDomain);
    }

    if (axis1d && brushIntersectionChanged(axisBrush, ab.brushedDomain)) {
      bind(axis1d, axis1d.showZoomResetButtonState)();
    }

    const abs = axis1d.axisBrush;
    abs.incrementProperty('brushCount');

    /* me.attrs.selectBlock is currently 'selectBlock'; when changed to a
     * closure action it can be called directly.
     * selectChromById() (selectBlockById) is no longer used here because
     * changing axis element data from axisName (blockId) to axis1d provides the
     * block reference.
     */
    me.sendAction('selectBlock', axis1d.axis);

  } // brushHelper

  //----------------------------------------------------------------------------

  function brushIntersectionChanged(axisBrush, brushedDomain) {
    const
    fnName = 'brushIntersectionChanged',
    block = axisBrush.get('block.content') || axisBrush.get('block'),
    domain = axisBrush.get('block.currentDomain'),
    previousDomain = block[Symbol.for('previousDomain')],
    changed = axisBrush.brushedDomain && domain && previousDomain ?
      ! intervalsEqual(
        intervalIntersect(brushedDomain, domain),
        intervalIntersect(axisBrush.brushedDomain, previousDomain)
      ) :
      true;
    // evaluate axis1d.brushedDomain
    dLog(fnName, changed, domain, previousDomain, brushedDomain, axisBrush.brushedDomain, block.axis1d.brushedDomain, block.brushedDomain);
    if (changed) {
      block[Symbol.for('previousDomain')] = domain;
    }
    return changed;
  }



  /** For those axes in selectedAxes, if the axis has a brushed region,
   * draw axis circles for features within the brushed region.
   */
  function axisFeatureCirclesBrushed(axis1d) {
    /* This function can be split out similarly to axis-1d.js :
     * FeatureTicks; possibly a sub-component of axis-1d.
     */

    if (axis1d.isDestroying) {
      return;
    }

    let valueInInterval = me.get('controls').get('view.valueInInterval');

    let selectedAxes = oa.selectedAxes;
    console.log("Selected: ", " ", selectedAxes.length);
    // Axes have been selected - now work out selected features.

    let brushExtent = axis1d.brushedRegion;

    oa.axisApi.selectedFeatures_clear();
    /** selectedFeaturesSet contains feature f if selectedFeatures[d_b][f] for any dataset/block d_b.
     * This is used to efficiently implement featureNotSelected2() which implements .faded.
     */
    let selectedFeaturesSet = new Set();
    let anyBrushIntersectionChanged = false;

    /* re-process all of selectedAxes, because it is (currently) easier to clear
     * selectedFeaturesSet and re-accumulate all of it.
     * Changing data structure to e.g. selected : blocksFeatures would enable
     * re-filtering just 1 axis or block.
     */
    /**
     * @param p an axis selected by a current user brush
     * @param i index of the brush of p in brushExtents[]
     */
    selectedAxes.forEach(function(axis1d, i) {
      if (axis1d.isDestroying) {
        return;
      }
      const brushExtent = axis1d.brushedRegion;
      if (! brushExtent) {
        return;
      }

      /** d3 selection of one of the Axes selected by user brush on axis. */
      let axisS = oa.svgContainer.selectAll("#" + eltId(axis1d));

      const
      notBrushed = brushExtent === undefined,
      enable_log = notBrushed;

      // this can use axisRange2Domain() which is based on this function.
      // if yp.domain() is [], then this won't be useful.
      const
      yp = axis1d.y,
      brushedDomain = brushExtent.map(function(ypx) { return yp.invert(ypx /* *axis1d.portion */); });
      if (axis1d.flipped)
      {
        let swap = brushedDomain[0];
        brushedDomain[0] = brushedDomain[1];
        brushedDomain[1] = swap;
      }

      const axisBrush = axis1d.axisBrushObj;
      /** when components/draw/axis-brush.js : draw() calls into
       * axisFeatureCirclesBrushed(), the limits and axisBrush calculated
       * above are probably current.
       */
      anyBrushIntersectionChanged ||= brushIntersectionChanged(axisBrush, brushedDomain);

      if (enable_log)
        console.log("brushHelper", axis1d.axisName, yp.domain(), yp.range(), axis1d.brushedRegion, axis1d.portion, brushedDomain);

      /** for all data blocks in the axis; reference blocks don't contain
       * features so don't brush them. */
      /* can pass visible=true here - a slight optimisation; it depends on the
       * expression in dataBlocks() which distinguishes data blocks.
       * related axis1d.brushedBlocks
       */
      let childBlocks = axis1d.dataBlocksFiltered(true, false)
      /** Until d398e98e, this was filtered by .isBrushableFeatures; changed because
       * if there are paths (& hence features) loaded, then it makes sense to brush those.
       * (isBrushableFeatures() is concerned with whether more features should be requested, which is different).
       */
      ; // .filter((blockS) => blockS.block.get('isBrushableFeatures'));
      let range = [0, axis1d.yRange()];
      console.log(axis1d, 'childBlocks', childBlocks, range);
      /*
       * The circles have class feature.name (which should be prefixed with
       * a letter), which may not be unique between sibling blocks of an
       * axis.
       * Using combinedId below is sufficient to implement transitions,
       * but a more structured design is preferable to insert a layer : a <g> for
       * each block, with datum blockId or block, to wrap the <circle>s, and
       * a featuresOfBlock(blockId)->blockFeatures[] for the circle data.
       */
      childBlocks.forEach(function (block) {
        let
        /** compound name dataset:block (i.e. map:chr) for the selected axis p.  */
        mapChrName = block.get('brushName');
        const selectedFeatures = oa.selectedFeatures;
        selectedFeatures[mapChrName] = [];

        /** The initial application, Marker Map Viewer, was for genetic maps,
         * for which marker names are unique within a chromosome, and the data
         * structure reflected this : (z[axisName][featureName] -> location).
         * Now block.get('features') is used - providing the full array of
         * features, regardless of uniqueness of names.
         */
        let blockFeatures = block.get('features');  // was oa.z[block.axisName];
        blockFeatures.forEach(function(feature) {
          let f = feature.name;
          // let feature = blockFeatures[f];
          let value = feature?.value;
          /** fLocation is value[0], i.e. the start position. The circles are placed
           * at fLocation, and the end position is not currently shown.
           * A feature is selected if its interval [start,end], i.e. .value,
           * overlaps the brush thumb [start,end].
           */
          let fLocation;
          if (/*! isOtherField[f] && */ ((fLocation = feature.location) !== undefined))
          {
            /** range is from yRange() which incorporates .portion, so use ys rather than axis.y. */
            let yScale = axis1d.ys;
            let yPx;
            /** the brushedDomain may be out of the current zoom scope, so intersect .value with range also.
             */
            if (block.visible &&
                valueInInterval(feature.value, brushedDomain) &&
                valueInInterval(value.map(yScale), range)
               ) {
              //selectedFeatures[p].push(f);
              selectedFeaturesSet.add(f);
              // previously pushed : f + " " + fLocation
              selectedFeatures[mapChrName].push(feature);
              /** Highlight the features in the brushed regions
               * o[p] : the axis location;  now use 0 because the translation of parent g.axis-outer does x offset of stack.
               * fLocation :  actual feature position in the axis, 
               * yp(fLocation) :  is the relative feature position in the svg
               */
              /** lacking the g.block structure which would enable f (feature.name) to be
               * unique within its parent g, this combinedId enables transition
               * to be implemented in an improvised way.
               * Update : originally (Genetic Maps) feature.name was unique within block,
               * now use feature.id because feature.name can be repeated within block.
               */
              let
              combinedId = axisFeatureCircles_eltId(feature),
              dot = axisS.selectAll('circle#' + combinedId);
              if (! dot.empty()) {
                dot
                  .transition().duration(200)
                  .attr("cy", yp(fLocation));
              }
              else {
                dot = axisS
                  .append("circle")
                  .attr('id', combinedId)
                  .attr("class", eltClassName(f))
                  .attr("cx",0)   /* was o[p], but g.axis-outer translation does x offset of stack.  */
                  .attr("cy", yp(fLocation))
                  .attr("r",2)
                  .style("fill", "red");
                brushEnableFeatureHover(dot);
                /* This can be done via an added class and css :
                 * r, fill, stroke are toggled (to 5,yellow,black) by
                 * @see table-brushed.js: highlightFeature() */
              }
            } else {
              axisFeatureCircles_selectOneInAxis(axisS, feature)
                .remove();
            }
          }
        });
      });
    });

    const x = !oa.eventBus.selectedService.selectedFeatures.length;
    /* The aim of anyBrushIntersectionChanged was to skip
     * sendUpdatedSelectedFeatures(); perhaps remove the above
     * selectedFeatures_clear() to enable this.
     if (anyBrushIntersectionChanged)
    */ {
      oa.axisApi.sendUpdatedSelectedFeatures();
    }
    function featureNotSelected2(d)
    {
      const
      sel =
        unique_1_1_mapping && (typeof d != 'string') ?
        ( selectedFeaturesSet.has(d[0]) ||
          selectedFeaturesSet.has(d[1]) )
        : selectedFeaturesSet.has(d);
      /* if (sel)
         console.log("featureNotSelected2", unique_1_1_mapping, d, selectedFeaturesSet); */
      return ! sel;
    }

    d3.selectAll(fadedSelector).classed("faded", featureNotSelected2);
  } // axisFeatureCirclesBrushed()

  //----------------------------------------------------------------------------

  /** Determine the axis-brush object and calculate brushedDomain from brushRange.
   * param  brushRange from d3.event.selection
   */
  function brushRangeToDomain(axis1d, brushRange) {
    let axisBrush = axis1d.axisBrushObj;
    if (!axisBrush) {
      let block = axis1d.axis;
      axisBrush = me.get('pathsP').ensureAxisBrush(block);
      console.log('axis', axis1d, axis1d.view, block, 'axisBrush', axisBrush, axisBrush === axis1d.axisBrushObj);
    }
    let yp = axis1d.y;
    ensureYscaleDomain(yp, axis1d);
    let brushedDomain = brushRange ? axisRange2Domain(axis1d, brushRange) : undefined;
    return {axisBrush, brushedDomain};
  }


  //----------------------------------------------------------------------------

  /** Call resetZoom(axisId) - reset the zoom of one or all zoomed axes (selectedAxes).
   * Applies to the specified axis, or all brushes if axisId is undefined.
   * @param  axisId  db id of reference block of axis (i.e. .axisName) or undefined
   * @desc resetZooms() resets both the brush/es and the
   * zoom/s, and is callable via feed.trigger(), whereas resetZoom()
   * clears just the zoom and is local.
   * @param this AxisBrushZoom - not used.
   */
  function resetZooms(axis1d) {
    let zoomedAxes;
    const
    fnName = 'resetZooms',
    stacksView = oa.axisApi.stacksView,
    /** Probably zoomedAxes is sufficient; if it is empty then look at
     * selectedAxes, but probably not required. */
    axis1ds = axis1d ? [axis1d] :
      (zoomedAxes = stacksView.axes().filterBy('zoomed')).length ? zoomedAxes : 
      oa.selectedAxes.length ? oa.selectedAxes.slice() :
      [];
    console.log(
      fnName, axis1ds.mapBy('axisName'),
      axis1ds.mapBy('axis.brushName'), axis1ds);
    axis1ds.forEach((axis1d) => {
      console.log(fnName, axis1d.axisName, axis1d.brushedRegion);
      resetBrushes(axis1d);
      resetZoom(axis1d);
      console.log(fnName, 'after resetZoom', axis1d.axisName, axis1d.brushedRegion);
    });
  }
  /** Clear the brush of the specified axis, or all brushes if axisId is undefined.
   * @param  axisId  db id of reference block of axis (i.e. .axisName) or undefined
   */
  function resetBrushes(axis1d)
  {
    if (axis1d === undefined) {
      // or oa.selectedAxes[]
      oa.axisApi.stacksView.axes().forEach(resetBrush);
    } else {
      resetBrush(axis1d);
    }
  }
  function resetBrush(axis1d)
  {
    /* `this` not used here */
    const brushedRegion = axis1d.brushedRegion;
    let
    axisClipId = axis1d ? '="url(#' + axisEltIdClipPath(axis1d) + ')"' : '',
    brushSelector = "g.axis-all > g.brush > g[clip-path" + axisClipId + "]";
    let brushed = d3.selectAll(brushSelector);
    brushed.each(function (axis1d, i, g) {
      /* `this` refers to the brush g element.
       * pass selection==null to clear the brush.
       * clearing the brush triggers brushHelper() which removes the brush from selectedAxes[] and brushedRegions.
       * and hence index is 0.
       */
      const axisName = axis1d.axisName;
      dLog('resetBrushes', this, axisName, oa.selectedAxes, brushedRegion);
      if (this.__brush)
        d3.select(this).call(axis1d.y.brush.move, null);
      let brushedAxisID = axisName;
      /* the above call(brush.move, null) causes
       * brushedRegions[brushedAxisID] to be deleted, via :
       * brushended() -> brushHelper() -> removeBrushExtent()
       . */
      if (brushedRegion)
        removeBrushExtent(axis1d);
    });
  }

  /** remove the brush extent of brushedAxis1d from brushedRegions[] */
  function removeBrushExtent(brushedAxis1d) {
    console.log('removeBrushExtent', brushedAxis1d.axisName);
    brushedAxis1d.set('brushedRegion', null);
    oa.selectedAxes.removeObject(brushedAxis1d);
  }
  /** Reset 1 or all zooms.
   * @param axis1d  axis to reset; undefined means reset all zoomed axes.
   */
  function resetZoom(axis1d)
  {
    const axisApi = oa.axisApi;
    let svgContainer = oa.svgContainer;
    let t = svgContainer.transition().duration(750);
    /** rather than all of axisIDs(), should be sufficient to use
     * selectedAxes (related to brushedRegions)
     */
    let axes = axis1d ? [axis1d] : axisApi.stacksView.axes();
    axes.forEach(function(a) {
      let idName = axisEltId(a); // axis ids have "a" prefix
      let
      domain = a.parent ? a.parent.domain : a.referenceDomain;
      domain = maybeFlip(domain, a.flipped);
      a.setZoomed(false);
      a.y.domain(domain);
      a.ys.domain(domain);
      a.setDomain(domain);
      let yAxis = a.axisSide(a.y).ticks(10);
      oa.svgContainer.select("#"+idName).transition(t).call(yAxis);
    });
    let axisTickS = svgContainer.selectAll("g.axis > g.tick > text");
    axisTickS.attr("transform", yAxisTicksScale);
    // axisStackChanged(t);
    if (axis1d) {
      throttledZoomedAxis(axis1d, t);
    }

    pathDataUtils.pathUpdate(t);
    let axisS;
    let resetScope = axis1d ? (axisS = selectAxisOuter(axis1d)) : svgContainer;
    resetScope.selectAll(".btn").remove();
    if (axis1d === undefined)
    {
      // reset zoom of all axes clears selectedFeatures - check if this was the intention; also should selectedAxes be cleared ?
      axisApi.selectedFeatures_clear();
    }
  }


  let targetIdCount = 0;
  function handleFeatureCircleMouseOver(d, i)
  {
    let
    /** d is the axis chromosome id */
    chrName = d,
    featureName = this.classList[0],
    hoverFeatures = featureName ? [featureName] : [];
    if (oa.drawOptions.showCircleHover)
    {
      /** related @see axisFeatureCircles_selectAll() */
      let
      selector = "g.axis-outer#" + eltId(chrName) + " > circle." + CSS.escape(featureName),
      targetId = "MC_" + ++targetIdCount;
      console.log("handleFeatureCircleMouseOver", d, featureName, selector, targetId);
      if (false)
      {
        d3.select(selector)
          .attr('id', targetId);  // will add selector support to ember-tooltip targetId
      }
      else
      {
        const pathInfo = PathInfo(oa);
        const toolTip = pathInfo.toolTip;
        toolTip.html('<span id="AxisCircleHoverTarget">AxisCircleHoverTarget</span>');
        toolTip.show(d, i);
        targetId = "devel-visible";
      }
    }
    //  me.set("axisFeatureTargetId", targetId);
    once(function() {
      me.set("hoverFeatures", hoverFeatures);
      // me.set("axisFeatureCircleHover", true);
    });
  }
  function handleFeatureCircleMouseOut(d, i)
  {
    if (false) {
      debounce(
        function() {
          me.set("axisFeatureCircleHover", false);
        },
        10000);
    }
    else
    {
      function hidePathHoverToolTip() {
        const
        axis1d = d,
        oa = axis1d.drawMap.oa,
        pathInfo = PathInfo(oa);
        pathInfo.toolTip.hide(d);
      }
      debounce(hidePathHoverToolTip, 1000);
    }
  }
  function brushEnableFeatureHover(circleSelection)
  {
    circleSelection
      .on("mouseover", handleFeatureCircleMouseOver)
      .on("mouseout", handleFeatureCircleMouseOut);
  }


  /** Zoom the y axis of this axis to the given brushExtents[].
   * Called via on(click) of brushHelper() Zoom button (zoomSwitch).
   * Traverse selected Axes, matching only the axisName of the brushed axis.
   * Set the y domain of the axis, from the inverse mapping of the brush extent limits.
   * Remove the zoom button, redraw the axis, ticks, zoomPath. Move the brush.
   * @param that  the brush g element.
   * The datum of `that` is the axis-1d of the brushed axis.
   * @param brushedDomainClick  limits of the current brush, to which we are zooming
   * (brushedAxis1d.brushedDomain)
   * defined when called via .Zoom .on('click' )
   * undefined when called via .on('zoom' ), i.e. mousewheel zoom
   */
  function zoom(that, i, g, brushedDomainClick) {
    const fnName = 'zoom';
    const trace_zoom = 0;
    const selectedAxes = oa.selectedAxes;
    /** can be undefined in some cases. it is defined for WheelEvent - mousewheel zoom. */
    let e = d3.event.sourceEvent;
    let isWheelEvent = d3.event.sourceEvent instanceof WheelEvent;
    let timeStamp = e && e.timeStamp;
    me.set('axisZoom.zoomPan', {isWheelEvent, timeStamp});
    if (trace_zoom > 0 + isWheelEvent)
      console.log('zoom', that, brushedDomainClick, arguments, this);
    let axis1d;
    if (isWheelEvent) {
      axis1d = arguments[0];
      // expect that brushedDomainClick === undefined;
      let w = e;
      if (trace_zoom > 1) {
        dLog(
          'WheelEvent', d3.event.sourceEvent, d3.event.transform, d3.event,
          '\nclient', w.clientX, w.clientY,
          'deltaY', w.deltaY,
          'layer', w.layerX, w.layerY,
          'movement', w.movementX, w.movementY,
          'offset', w.offsetX, w.offsetY,
          'page', w.pageX, w.pageY,
          'screen', w.screenX, w.screenY,
          'wheelDeltaY', w.wheelDeltaY,
          '.', w.x, w.y
        );
      }
      /* The only apparent reason to add axis to selectedAxes[] when
       * mouse-wheel zoom is to prop up selectedAxes_i below, which will be
       * replaced.
       *
       * A couple of side-effects of WheelEvent adding axis to selectedAxes[] :
       * . draw_flipRegion() will apply to it;
       * . it is not apparent to the user that they should clear it,
       * by clicking on axis, to remove class .faded.
       */
      selectedAxes.addObject(axis1d);
    }
    else if (e instanceof MouseEvent) {
      console.log(
        'MouseEvent', e);
    }
    else
    {
      axis1d = d3.select(that).data();
      if (axis1d.length == 1)
        axis1d = axis1d[0];
    }
    const axisName = axis1d.axisName;

    let t = oa.svgContainer; // .transition().duration(750);
    /** The response to mousewheel zoom is direct, no transition delay.  requestAnimationFrame() is used. */
    let tRaf = undefined; // or t.duration(10);
    /** true if the axis domain is changed. */
    let domainChanged = false;

    /* this uses .map() to find i such that selectedAxes[i] == axisName,
     * and i is used to lookup the parallel array brushExtents[].
     * #afterRelease, selectedAxes / brushExtents / brushedRegions can be
     * better integrated, simplifying this calc and others.
     */
    const
    selectedAxes_i = 
      selectedAxes.reduce(function(result, p, i) {
        if(p === axis1d){
          result.push([p, i]);
        }
        return result;
      }, []);
    selectedAxes_i.forEach(function(p_i) {
      let [p, i] = p_i;
      const axis1d = p;
      let y = axis1d.y, svgContainer = oa.svgContainer;

      let
      yp = y,
      ypDomain = yp.domain(),
      domain,
      brushedDomain;
      ensureYscaleDomain(yp, axis1d);

      if (d3.event.sourceEvent)  // if there is a mousewheel event
      {
        /** note the brushedDomain before the scale change, for updating the brush position */
        let brushExtent = axis1d.brushedRegion;
        if (brushExtent)
          brushedDomain = axisRange2Domain(axis1d, brushExtent);

        domain = wheelNewDomain(axis1d, oa.axisApi, false);  // uses d3.event, d3.mouse()
      } else if (axis1d.brushedRegion) {
        brushedDomain = axis1d.brushedRegion.map(function(ypx) { return yp.invert(ypx /* *axis1d.portion*/); });
        // brushedDomain = [yp.invert(brushExtents[i][0]), yp.invert(brushExtents[i][1])];
        dLog(fnName, axisName, yp.domain(), yp.range(), axis1d.brushedRegion, axis1d.portion, brushedDomain);
        domain = brushedDomain;
      } else {
        dLog(fnName, axisName, 'no mouse-wheel zoom or brushedRegion');
      }

      if (domain) {
        domainChanged = true;
        /** mousewheel zoom out is limited by javascript
         * precision, so consider domain equal if first 7 chars
         * are equal.  */
        function limitPrecision(x) { return ('' + x).substr(0,7); };
        let 
        /** total domain */
        domainAll = axis1d.get('blocksDomain').toArray(),
        domainAllS = domainAll.map(limitPrecision),
        domainFS = maybeFlip(domain, axis1d.flipped).map(limitPrecision),
        /** true if (mousewheel) zoomed out to the limit of the whole domain. */
        zoomedOut = isEqual(domainAllS, domainFS);

        axis1d.setZoomed(! zoomedOut);
        y.domain(domain);
        axis1d.ys.domain(domain);
        // scale domain is signed. currently .zoomedDomain is not, so maybeFlip().
        axis1d.setDomain(maybeFlip(domain, axis1d.flipped));

        /* was updatePaths true, but pathUpdate() is too long for RAF.
         * No transition required for RAF.
         */
        debounce(
          undefined,
          me.functionHandle('axisScaleChangedRaf', axisScaleChangedRaf),
          axis1d, tRaf, false,  // args
          me.get('controls.view.debounceTime')
        );
        let brushExtent = axis1d.brushedRegion;
        if (brushedDomainClick) {
          /* on Zoom button click, clear the brush selection, because we have
           * zoomed to the brush selection.  */
          // `that` refers to the brush g element, i.e. <g clip-path> within <g.brush>
          d3.select(that).call(y.brush.move,null);
        }
        else if (brushExtent) {
          let gBrush = d3.event.sourceEvent.target.parentElement;
          let newBrushExtent = brushedDomain.map(function (r) { return yp(r);});
          // in d3.js:move() .__brush is expected to be defined.
          const state = gBrush.__brush;
          if (! state || (trace_zoom > 1)) {
            dLog(fnName, brushExtent, brushedDomain, gBrush, newBrushExtent);
          }
          if (state) {
            d3.select(gBrush).call(yp.brush.move, newBrushExtent);
          }
        }
      }
    });


    debounce(
      undefined,
      me.functionHandle('showAxisZoomResetButtons', showAxisZoomResetButtons),
      oa.svgContainer, zoom, bind(this, resetZooms, axis1d), axis1d,  // args
      me.get('controls.view.debounceTime')
    );

    if (domainChanged) {
      // axisStackChanged(t);
      throttledZoomedAxis(axisName, t);
    }
  } // end of zoom()

  function axisScaleChangedRaf(axis1d, t, updatePaths) {
    const
    fn = () => axisScaleChanged(axis1d, t, updatePaths),
    job = 
      scheduler ? scheduler.schedule('affect', fn) : fn();
  }
  /** @param axis1d
   * @param updatePaths true : also update foreground paths.
   */
  function axisScaleChanged(axis1d, t, updatePaths)
  {
    let y = axis1d.y, svgContainer = oa.svgContainer;
    if (! axis1d.isDestroying && y) {
      let yAxis = axis1d.axisSide(y).ticks(me.axisTicks * axis1d.portion);
      const idName = axisEltId(axis1d);
      let axisS = svgContainer.select("#"+idName);
      if (t) {
        axisS = axisS.transition(t)
          .duration(me.get('axisZoom.axisTransitionTime'));
      }
      axisS.call(yAxis);
      if (updatePaths) {
        pathDataUtils.pathUpdate(t);
      }
      let axisGS = svgContainer.selectAll("g.axis#" + idName + " > g.tick > text");
      axisGS.attr("transform", yAxisTicksScale);
    }
  }

  function brushended() {
    // console.log("brush event ended");
    brushHelper(this);
  }

  //----------------------------------------------------------------------------

  /** flip the value of features between the endpoints
   *
   * This is done for each of selectedAxes[], except if param features is
   * defined, it is done just for selectedAxes[0].
   *
   * If the param features is defined, the interval limits of those features is
   * determined, and used as the region to flip.
   *
   * @param features is an array of feature names, created via (zoom) brush,
   * and input via text box
   * features are passed by selected-markers.js : flipRegion(), but not
   * view-controls.js:flipRegion().
   */
  function draw_flipRegion(features) {
    let brushedMap, zm;
    const selectedAxes = oa.selectedAxes;
    let limits;
    if (selectedAxes.length === 0)
      console.log('draw_flipRegion', 'selectedAxes is empty', selectedAxes);
    /* axes = oa.selectedAxes;
       brushedMap = axes && axes.length && axes[axes.length-1]; */
    else if ((brushedMap = selectedAxes[0]) === undefined)
      console.log('draw_flipRegion', 'selectedAxes[0] is undefined', selectedAxes);
    else
    {
      if (features && features.length)
      {
        limits = features2Limits(features);
        // possibly could apply to all of selectedAxes[], currently does just selectedAxes[0]
        flipRegionInLimits(brushedMap, limits);
        flipRegionSignalAxis(brushedMap);
      }
      else
      {
        console.log(oa.selectedAxes);
        selectedAxes.forEach(function(axis1d, i) {
          // p is selectedAxes[i], including brushedMap === selectedAxes[0]
          limits = axis1d.brushedDomain;
          console.log('flipRegion', axis1d.axisName, i, brushedMap, limits, axis1d.brushedRegion);
          /* Generally for axis1d in selectedAxes[], axis1d.brushedRegion is
           * defined; but if axis 'Reset' the brush is cleared but
           * the axis remains selected. */
          if (limits) {
            flipRegionInLimits(axis1d, limits);
            flipRegionSignalAxis(axis1d);
          }
        });
      }
      /** Flag the flip event for the axis - increment axis1d flipRegionCounter.
       * @param axis1d  brushedMap / selectedAxes[i]
       */
      function flipRegionSignalAxis(axis1d) {
        if (axis1d) {
          axis1d.incrementProperty('flipRegionCounter');
        }
      }
    }
    function features2Limits(features)
    {
      /** the first and last features have the minimum and maximum position
       * values, except where flipRegion has already been applied.
       * So this could simply look at [features[0], features[features.length-1]].mapBy('value').
       *
       * Instead of reduce, could use d3.extent(), as in e.g. block.js:valueCompute() :
       *   locations = features.filter((fi) => features.includes(fi.name)
       *               .map((fm) => fm.value).flat(),
       *   extent = d3.extent(locations);
       */
      let limits = [undefined, undefined];
      limits = features
      // could use .filter() d3.extent()
        .reduce(function(limits_, fi) {
          if (features.includes(fi.name))
          {
            // console.log("reduce", fi, limits_, zm[fi]);
            let l = fi.location;
            if (limits_[0] === undefined || limits_[0] > l)
              limits_[0] = l;
            if (limits_[1] === undefined || limits_[1] < l)
              limits_[1] = l;
          }
          // console.log(zmi, l, limits_);
          return limits_;
        }, limits);
      // console.log("limits", limits);
      const 
      f0  = features[0], f1  = features[features.length-1];
      console.log("features2Limits", /*features, zm,*/ f0 , f1, limits);
      return limits;
    }

    function flipRegionInLimits(axis1d, locationRange)
    {
      const fnName = 'flipRegionInLimits';
      let
      /** delta of the locationRange interval */
      rd = locationRange[1] - locationRange[0],
      invert = function (l)
      {
        let i = rd === 0 ? l : locationRange[1] + (locationRange[0] - l);
        // console.log("invert", l, i);
        return i;
      };
      console.log(fnName, locationRange, rd);
      let
      blocks = axis1d?.dataBlocks;
      console.log(axis1d, blocks);
      (blocks || []).map(function (block) {
        zm = block.get('features');
        console.log(block.axisName, zm.length);
        zm.forEach(function(feature) {
          {
            const fl = feature.value;
            if (subInterval(fl, locationRange))
              fl.forEach((v, i) => { feature.value[i] = invert(v); });
          }
        });
      });
      pathDataUtils.pathUpdate(undefined);
    }
  }

  //----------------------------------------------------------------------------

  /** Provide a constant function value for use in .debounce(). */
  function triggerZoomedAxis(args) {
    this.trigger("zoomedAxis", args);
  }
  function throttledZoomedAxis(axisID, t) {
    /* this delivers zoomed() via 
     * axis-2d : zoomedAxis() throttle-> sendZoomed() -> zoomed (in-axis.js)
     * used by axis-ld and axis-charts (which can use drawContentEffect instead).
     throttle(this, this.triggerZoomedAxis, [axisID, t], 400);
    */
  }

  //----------------------------------------------------------------------------

  return result;
}


//------------------------------------------------------------------------------


export {
  brushClip, axisBrushSelect,
  axisZoomResetButtonClasses,
  showAxisZoomResetButtons,
  AxisBrushZoom,
};
