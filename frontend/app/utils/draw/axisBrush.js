import {
  once,
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

import { scheduler } from 'ember-raf-scheduler';

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
import { subInterval, wheelNewDomain } from './zoomPanCalcs';
import { intervalsEqual, intervalIntersect } from '../interval-calcs';

import {
  isOtherField
} from '../field_names';

import {
  unique_1_1_mapping 
} from '../paths-config';


//------------------------------------------------------------------------------

/* global d3 */
/* global CSS */
/* global WheelEvent */

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace_scale_y = 0;
const trace_gui = 0;

//------------------------------------------------------------------------------

// let  bbox  = { x: 1, y : 2, width: 20, height : undefined };

/** Add <clipPath><rect /><g clip-path= />
 * This is used within an axis to wrap the content of g.brush, provided a clip
 * rect for the brush elements.
 * @param gp  <g.brush>
 * @return selection of g[clip-path], used by the caller to insert the brush elements.
 */
function brushClip(gp, axisID) {

  let gpp = gp.node().parentElement;

  // there may be a delay before getBBox is available.  if so, return an empty selection.
  if (! gpp.getBBox)
    return d3.select(undefined);

  let bbox = gpp.getBBox();

  let
    gc = gp.selectAll("g > clipPath")
    .data([axisID]),
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
  let gg = 
    gp.selectAll("g > [clip-path]"),
  g = gg
    .data([axisID])
    .enter()
    .append("g")
    .attr("clip-path", (axisID) => "url(#" + axisEltIdClipPath(axisID) + ")") // clip with the rectangle
    .merge(gg);

  dLog(axisID, bbox, 'brushClip', gp.node(), gprm.node(), gg.node(), g.node());

  return g;
}

/*--------------------------------------------------------------------------*/

/** Select the brush of brushedAxisID.
 * @return d3 selection of the brushed axis.
 */
function axisBrushSelect(svgContainer, brushedAxisID) {
  // copied from showAxisZoomResetButtons()
  let axisS = svgContainer.selectAll("#" + eltId(brushedAxisID));
  /** this is the element which is passed when called via
   * zoomBehavior.on('zoom', zoom)
   * so pass the same element when calling via g.btn .Zoom .on('click' ).
   */
  let gBrush = axisS.selectAll('g.brush > g[clip-path]').node();
  return gBrush;
}


function showAxisZoomResetButtons(svgContainer, getBrushExtents, zoom, resetZoom, brushedAxisID, drawMap) {
  // `used as the basis of axisBrushSelect
  /** d3 selection of the brushed axis. */
  let axisS = svgContainer.selectAll("#" + eltId(brushedAxisID));
  /** this is the element which is passed when called via
   * zoomBehavior.on('zoom', zoom)
   * so pass the same element when calling via g.btn .Zoom .on('click' ).
   */
  let that = axisS.selectAll('g.brush > g[clip-path]').node();
  let zoomResetNames = ['Zoom', 'Reset'];
  let gS = axisS
      .selectAll('g.btn')
      .data([1]);
  let gE = gS
      .enter()
      .append('g')
      .attr('class', 'btn');
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
      let brushExtents = getBrushExtents();
      zoom(that,brushExtents);
      // zoomed = true; // not used.

      //reset function
      //Remove all the existing circles
      axisFeatureCircles_selectAll().remove();

    });
  let
  resetSwitch = g.selectAll('.Reset');
  resetSwitch
    .on('click',function(){resetZoom(brushedAxisID); });
 
 dLog("showAxisZoomResetButtons g", g.nodes());
}


/*--------------------------------------------------------------------------*/

function AxisBrushZoom(oa) {
  const
  me = oa.eventBus,
  resetZooms = me.get('resetZooms');

  const result = {
    brushUpdates,
    getBrushExtents,
    getBrushedRegions, axisBrushedDomain, axisRange2DomainFn, axisRange2Domain, axisBrushShowSelection,
    brushHelper, resetZooms, resetBrushes, removeBrushExtent, resetZoom,
    axisFeatureCircles_selectAll, handleFeatureCircleMouseOver, handleFeatureCircleMouseOut, brushEnableFeatureHover, zoom, axisScaleChangedRaf, axisScaleChanged, brushended, 
    draw_flipRegion, /* containing : features2Limits, flipRegionInLimits, */
    triggerZoomedAxis, throttledZoomedAxis,
  };
  

  //----------------------------------------------------------------------------

  function brushUpdates() {
    /* axes removed via manage-view : removeBlock don't remove any brush of
     * that axis from brushedRegions, so check for that here.
     * This check could be done when services/data/blocks:viewed.[] updates.
     */
    Object.keys(oa.brushedRegions).forEach(
      (refBlockId) => { if (! oa.axes[refBlockId]) removeBrushExtent(refBlockId); } 
    );

    /** As in zoom(), note the brushedDomains before the scale change, for
     * updating the brush selection position.
     * This could be passed to axisBrushShowSelection() and used in place of
     * axisBrush.brushedDomain; the current intention is to shift to using
     * just axisBrush.brushedDomain and brushedRegions / brushExtents can be retired.
     * oa.brushedRegions is equivalent to getBrushedRegions() - could use that for verification.
     */
    let brushedDomains = {};
    Object.entries(oa.brushedRegions).forEach(
      // similar to axisBrushedDomain().
      ([refBlockId, region]) => brushedDomains[refBlockId] = axisRange2Domain(refBlockId, region)
    );
    dLog('brushedDomains', brushedDomains);
  }


  //----------------------------------------------------------------------------

  /** Map brushedRegions into an array parallel to selectedAxes[]. */
  function getBrushExtents() {
    const brushedRegions = oa.brushedRegions;
    /** Extent of current brush (applied to y axis of a axis). */
    let
    selectedAxes = oa.selectedAxes,
      brushExtents = selectedAxes.map(function(p) { return brushedRegions[p]; }); // extents of active brushes
    return brushExtents;
  }
  /** Could use this instead of maintaining oa.brushedRegions :
   */
  function getBrushedRegions() {
    let brushedRegions = d3.selectAll('g.brush > g[clip-path]').nodes().reduce((br, e) => { let s = e.__brush.selection; br[e.__data__] = [s[0][1], s[1][1]]; return br; }, {});
    return brushedRegions;
  }

  /** Return the brushed domain of axis p
   * Factored from brushHelper(); can use axisBrushedDomain() to replace that code in brushHelper().
   */
  function axisBrushedDomain(p, i)
  {
    let brushExtents = getBrushExtents();

    if (! brushExtents[i]) {
      dLog('axisBrushedDomain no brush for', p, i, brushExtents);
      return undefined;
    }
    let brushedDomain = axisRange2Domain(p, brushExtents[i]);
    console.log('axisBrushedDomain', p, i, brushExtents, brushedDomain);
    return brushedDomain;
  }
  /** Convert the given brush extent (range) to a brushDomain.
   * @param p axisID
   * @return function to convert range a value to a domain value.
   * undefined if scale has no domain.
   */
  function axisRange2DomainFn(p)
  {
    let
      yp = oa.y[p];
    let ypDomain = yp.domain();
    if (! ypDomain || ! ypDomain.length)
      return undefined;
    function fn(ypx) { return yp.invert(ypx /* *axis.portion */); };
    return fn;
  }
  /** Convert the given brush extent (range) to a brushDomain.
   * @param p axisID
   * @param range a value or an interval in the axis range.  This may be e.g. a brush extent
   * @return domain the (reverse) mapping of range into the axis domain.
   * undefined if range is undefined.
   */
  function axisRange2Domain(p, range)
  {
    // axisRange2Domain{,Fn} are factored from axisBrushedDomain(), and brushHelper()
    let
      r2dFn = axisRange2DomainFn(p);
    if (! r2dFn) {
      dLog('axisRange2Domain', p, range, 'scale has no domain', oa.y[p].domain());
      return undefined;
    }
    if (! range) {
      return undefined;
    }
    let
    axis = oa.axes[p],
    brushedDomain = range.length ? range.map(r2dFn) : r2dFn(range);
    if (range.length && axis.flipped)
    {
      let swap = brushedDomain[0];
      brushedDomain[0] = brushedDomain[1];
      brushedDomain[1] = swap;
    }
    if (trace_scale_y)
      dLog('axisRange2Domain', p, range, brushedDomain);
    return brushedDomain;
  }

  /** update brush selection position for window / element height resize.
   * @param gBrush  <g clip-path> within <g.brush>
   */
  function axisBrushShowSelection(p, gBrush) {
    let yp = oa.y[p],
    brushedAxisID = p;
    /* based on similar functionality in zoom() which updates brush
     * extent/position for (zoom) scale change (brushedDomain does not change).
     *
     * If axisBrush.brushedDomain is not available, can use brushedDomains
     * calculated from existing brush extent in showResize before the scale is changed.
     */
    let brushedDomain;
    if (! brushedDomain) {
      let axisBrush = me.get('store').peekRecord('axis-brush', brushedAxisID);
      brushedDomain = axisBrush && axisBrush.get('brushedDomain');
    }
    if (brushedDomain) {
      let newBrushSelection = brushedDomain.map(function (r) { return yp(r);});
      console.log('axisBrushShowSelection', brushedAxisID, brushedDomain, gBrush, newBrushSelection);
      if ((newBrushSelection[0] < -1e3) || (newBrushSelection[1] > 1e4)) {
        // when zoomedDomain is set by setDomainFromDawn(), the current brush is likely to be way out of scope.
        dLog('brush selection is large after scale change - removing', p);
        removeBrushExtent(p);
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
   * The datum of g.brush is the ID/name of its axis, call this axisID.
   * If null selection then remove axisID from selectedAxes[], otherwise add it.
   * Update selectedFeatures{}, brushedRegions{} : if selectedAxes[] is empty, clear them.
   * Otherwise, set brushedRegions[axisID] to the current selection (i.e. of the brush).
   * Set brushExtents[] to the brushedRegions[] of the Axes in selectedAxes[].
   * For each axis in selectedAxes[], clear selectedFeatures{} then store in it the
   * names + locations of features which are within the brush extent of the axis.
   * Add circle.axisID for those feature locations.
   * Remove circles of features (on all Axes) outside brushExtents[axisID].
   * For elements in '.foreground > g.flowName > g', set class .faded iff the feature (which
   * is the datum of the element) is not in the selectedFeatures[] of any axis.
   *
   * Draw buttons to zoom to the brushExtents (zoomSwitch) or discard the brush : resetSwitch.
   * Called from brushended(), which is called on(end) of axis brush.
   *
   * @param that  the brush g element.
   * The datum of `that` is the name/ID of the axis which owns the brushed axis.
   * 
   */
  function brushHelper(that) {
    const axisApi = oa.axisApi;
    // Chromosome name, e.g. 32-1B
    /** name[0] is axisID of the brushed axis. name.length should be 1. */
    let name = d3.select(that).data();
    let brushedAxisID = name[0];

    const selectedAxes = oa.selectedAxes;
    let svgContainer = oa.svgContainer;
    //Remove old circles.
    axisFeatureCircles_selectAll().remove();
    let brushedRegions = oa.brushedRegions;
    let
    brushRange = d3.event.selection,
    /** d3.mouse() calls : function point(node, event) { .. point.x = event.clientX, point.y = event.clientY;
     * so don't call mouse if those are undefined.
     */
    eventHasClientXY = (d3.event.clientX !== undefined) && (d3.event.clientX !== undefined),
    mouse = brushRange && eventHasClientXY && d3.mouse(that);
    let brushSelection = d3.brushSelection(d3.select(that));
    let brush_ = that.__brush,
    brushSelection_ = brush_.selection,
    brushExtent_ = brush_.extent;
    /** selects the g which may have .faded added.  Exclude g.progress because
     * featureNotSelected2() does not yet support its datum type, and we
     * should check with users if this feature should be maintained or varied.
     */
    const fadedSelector = ".foreground > g:not(.progress) > g";

    if (trace_gui)
      console.log("brushHelper", that, brushedAxisID, selectedAxes, brushRange, brushedRegions,
                  brushSelection, mouse,
                  brushSelection_ ? '' + brushSelection_[0] + '' + brushSelection_[1] : '', ', ',
                  brushExtent_ ? '' + brushExtent_[0] + ',' + brushExtent_[1] : ''
                 );

    /* d3.event.selection is null when brushHelper() is called via zoom() ... brush.move.
     * This causes selectedAxes to update here; when an axis is zoomed its brush is removed.
     */
    if (brushRange == null) {
      removeBrushExtent(brushedAxisID);
    }
    else {
      selectedAxes.addObject(name[0]); 
      brushedRegions[brushedAxisID] = brushRange;
    }

    const
    ab = brushRangeToDomain(brushRange),
    axisBrush = ab.axisBrush,
    /** equiv : axis.referenceBlock */
    limits = axisBrush.get('block.limits')
      || axisBrush.get('block.axis.domain')
      || axisBrush.get('block.axis.referenceBlock.range');

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
      dLog(fnName, changed, domain, previousDomain);
      if (changed) {
        block[Symbol.for('previousDomain')] = domain;
      }
      return changed;
    }


    // selectedAxes is an array containing the IDs of the Axes that
    // have been selected.

    if (selectedAxes.length > 0) {
      axisFeatureCirclesBrushed();

      if (! oa.axisApi.axisFeatureCirclesBrushed) {
        oa.axisApi.axisFeatureCirclesBrushed = axisFeatureCirclesBrushed;
      }

      /** For those axes in selectedAxes, if the axis has a brushed region,
       * draw axis circles for features within the brushed region.
       */
      function axisFeatureCirclesBrushed() {
        /* This function can be split out similarly to axis-1d.js :
         * FeatureTicks; possibly a sub-component of axis-1d.
         */

        let valueInInterval = me.get('controls').get('view.valueInInterval');

        let selectedAxes = oa.selectedAxes;
      console.log("Selected: ", " ", selectedAxes.length);
      // Axes have been selected - now work out selected features.

      let brushExtents = getBrushExtents();

      axisApi.selectedFeatures_clear();
      /** selectedFeaturesSet contains feature f if selectedFeatures[d_b][f] for any dataset/block d_b.
       * This is used to efficiently implement featureNotSelected2() which implements .faded.
       */
      let selectedFeaturesSet = new Set();
      let anyBrushIntersectionChanged = false;
      /**
       * @param p an axis selected by a current user brush
       * @param i index of the brush of p in brushExtents[]
       */
      selectedAxes.forEach(function(p, i) {
        /** d3 selection of one of the Axes selected by user brush on axis. */
        let axisS = oa.svgContainer.selectAll("#" + eltId(p));

        // blockS = oa.stacks.axes[p],

        let notBrushed = brushExtents[i] === undefined,
        enable_log = notBrushed;
          if (enable_log)
          console.log("brushHelper", p, i);
        /* brushExtents[i] is required for the following calculation of
         * brushedDomain and hence the filtering, so return if it is undefined.
         * The above selectedAxes.removeObject() is intended to prevent this but it seems to miss some case.
         * And selectedAxes[] does not only derive from brushes - an axis can be selected in the data explorer.
         * The whole flow of calculation in brushHelper() needs to be changed :
         * it is unnecessary to traverse selectedAxes[] - only 1 axis has
         * been brushed, and p is known via (thisElement.__data__, name[0], brushedAxisID).
         * brushExtents[] is not required, and brushedRegions[] can be
         * independent of selectedAxes[].
         */
        if (notBrushed)
          return;

        // this can use axisRange2Domain() which is based on this function.
        // if yp.domain() is [], then this won't be useful.
        let yp = oa.y[p],
        axis = oa.axes[p],
        brushedDomain = brushExtents[i].map(function(ypx) { return yp.invert(ypx /* *axis.portion */); });
        if (axis.flipped)
        {
          let swap = brushedDomain[0];
          brushedDomain[0] = brushedDomain[1];
          brushedDomain[1] = swap;
        }

        /** when components/draw/axis-brush.js : draw() calls into
         * axisFeatureCirclesBrushed(), the limits and axisBrush calculated
         * above are probably current.
         */
        anyBrushIntersectionChanged ||= brushIntersectionChanged(axisBrush, brushedDomain);

        if (enable_log)
          console.log("brushHelper", name, p, yp.domain(), yp.range(), brushExtents[i], axis.portion, brushedDomain);

        /** for all data blocks in the axis; reference blocks don't contain
         * features so don't brush them. */
        /* can pass visible=true here - a slight optimisation; it depends on the
         * expression in dataBlocks() which distinguishes data blocks. */
        let childBlocks = axis.dataBlocks(true, false)
            /** Until d398e98e, this was filtered by .isBrushableFeatures; changed because
             * if there are paths (& hence features) loaded, then it makes sense to brush those.
             * (isBrushableFeatures() is concerned with whether more features should be requested, which is different).
             */
            ; // .filter((blockS) => blockS.block.get('isBrushableFeatures'));
        let range = [0, axis.yRange()];
        console.log(axis, 'childBlocks', childBlocks, range);
        /*
         * The circles have class feature.name (which should be prefixed with
         * a letter), which may not be unique between sibling blocks of an
         * axis.
         * Using combinedId below is sufficient to implement transitions,
         * but a more structured design is preferable to insert a layer : a <g> for
         * each block, with datum blockId or block, to wrap the <circle>s, and
         * a featuresOfBlock(blockId)->blockFeatures[] for the circle data.
         */
        childBlocks.map(function (block) {

        let
          blockR = block && block.block,
        /** compound name dataset:block (i.e. map:chr) for the selected axis p.  */
        mapChrName = blockR.get('brushName');
        const selectedFeatures = oa.selectedFeatures;
        selectedFeatures[mapChrName] = [];

        /** The initial application, Marker Map Viewer, was for genetic maps,
         * for which marker names are unique within a chromosome, and the data
         * structure reflected this : (z[axisName][featureName] -> location).
         * Now block.get('features') is used - providing the full array of
         * features, regardless of uniqueness of names.
         */
        let blockFeatures = block.block.get('features');  // was oa.z[block.axisName];
        /*d3.keys()*/ blockFeatures.forEach(function(feature) {
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
            let yScale = oa.ys[p];
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
            let combinedId = axisFeatureCircles_eltId(feature),
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
      if (anyBrushIntersectionChanged) {
        axisApi.sendUpdatedSelectedFeatures();
      }
      function featureNotSelected2(d)
      {
        let sel =
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

      showAxisZoomResetButtons(svgContainer, getBrushExtents, zoom, bind(me, me.get('resetZooms')), brushedAxisID, me);

    } else {
      // brushHelper() is called from brushended() after zoom, with selectedAxes.length===0
      // At this time it doesn't make sense to remove the resetSwitch button

      // No axis selected so reset fading of paths or circles.
      console.log("brushHelper", selectedAxes.length);
      // some of this may be no longer required
      if (false)
        svgContainer.selectAll(".btn").remove();
      axisFeatureCircles_selectAll().remove();
      d3.selectAll(fadedSelector).classed("faded", false);
      axisApi.selectedFeatures_clear();
      /* clearing brushedRegions is not needed here because resetBrushes() (by
       * clearing the brushes) causes brushHelper() to remove brushes from
       * brushedRegions.
       * (and changing the value of brushedRegions in draw() closure would
       * require using oa.brushedRegions instead).
       * brushedRegions = oa.brushedRegions = {};
       */
    }
    /** Determine the axis-brush object and calculate brushedDomain from brushRange.
     */
    function brushRangeToDomain(brushRange) {
     /** Related : axisBrushedDomain() which relies on brushExtents[i],
      * whereas this uses brushRange more directly, from d3.event.selection.
      */
    let axisBrush = me.get('store').peekRecord('axis-brush', brushedAxisID);
    if (!axisBrush) {
      let axis = Stacked.getAxis(brushedAxisID);
      let block = me.peekBlock(brushedAxisID);
      axisBrush = me.get('pathsP').ensureAxisBrush(block);
      console.log('axis', axis, axis.block, block, 'axisBrush', axisBrush);
    }
    let yp = oa.y[brushedAxisID];
    ensureYscaleDomain(yp, oa.axes[brushedAxisID]);
    let brushedDomain = brushRange ? axisRange2Domain(brushedAxisID, brushRange) : undefined;
      return {axisBrush, brushedDomain};
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

    let axis = oa.axes[brushedAxisID],
        axis1d = axis && axis.axis1d;
    if (axis1d && brushIntersectionChanged(axisBrush, ab.brushedDomain)) {
      bind(axis1d, axis1d.showZoomResetButtonState)();
    }

    me.attrs.selectChromById(brushedAxisID);

  } // brushHelper


        /** Call resetZoom(axisId) - reset the zoom of one or all zoomed axes (selectedAxes).
         * Applies to the specified axis, or all brushes if axisId is undefined.
         * @param  axisId  db id of reference block of axis (i.e. .axisName) or undefined
         * @desc resetZooms() resets both the brush/es and the
         * zoom/s, and is callable via feed.trigger(), whereas resetZoom()
         * clears just the zoom and is local.
         */
      // console.log("me.get('resetZooms')", me.get('resetZooms') !== undefined);
        if (! me.get('resetZooms'))
        me.set('resetZooms', function(axisId) {
          console.log('resetZooms', axisId, oa.selectedAxes, oa.brushedRegions);
          resetBrushes(axisId);
          resetZoom(axisId);
          console.log('after resetZoom', axisId, oa.selectedAxes, oa.brushedRegions);
        });
      /** Clear the brush of the specified axis, or all brushes if axisId is undefined.
       * @param  axisId  db id of reference block of axis (i.e. .axisName) or undefined
       */
      function resetBrushes(axisId)
      {
        const brushedRegions = oa.brushedRegions;
        let
        axisClipId = axisId ? '="url(#axis-clip-' + axisId + ')"' : '',
        brushSelector = "g.axis-all > g.brush > g[clip-path" + axisClipId + "]",
        brushExtents;
        if (axisId) {
          brushExtents = [brushedRegions[axisId]];
        } else {
          /** brushed[j] may correspond to oa.selectedAxes[j] and hence
           * brushExtents[j], but it seems possible for their order to not
           * match.  This is only used in trace anyway.
           */
          brushExtents = getBrushExtents();
        }
        let brushed = d3.selectAll(brushSelector);
        brushed.each(function (axisName, i, g) {
          /* `this` refers to the brush g element.
           * pass selection==null to clear the brush.
           * clearing the brush triggers brushHelper() which removes the brush from selectedAxes[] and brushedRegions.
           * and hence index is 0.
           */
          let j = i;
          dLog('resetBrushes', axisId, this, axisName, oa.selectedAxes[j], oa.brushedRegions[axisName], brushExtents[j]);
          if (this.__brush)
            d3.select(this).call(oa.y[axisName].brush.move, null);
          let brushedAxisID = axisName;
          /* the above call(brush.move, null) causes
           * brushedRegions[brushedAxisID] to be deleted, via :
           * brushended() -> brushHelper() -> removeBrushExtent()
           . */
          if (oa.brushedRegions[brushedAxisID])
            removeBrushExtent(brushedAxisID);
        });
      }

  /** remove the brush extent of brushedAxisID from brushedRegions[] */
  function removeBrushExtent(brushedAxisID) {
      console.log('removeBrush', brushedAxisID);
      oa.selectedAxes.removeObject(brushedAxisID);
      delete oa.brushedRegions[brushedAxisID];
  }
        /** Reset 1 or all zooms.
         * @param axisID  axis id to reset; undefined means reset all zoomed axes.
         */
        function resetZoom(axisID)
        {
          const axisApi = oa.axisApi;
          let svgContainer = oa.svgContainer;
          let t = svgContainer.transition().duration(750);
          /** rather than all of axisIDs(), should be sufficient to use
           * selectedAxes (related to brushedRegions)
           */
          let axisIDs = axisID ? [axisID] : oa.stacks.axisIDs();
          axisIDs.forEach(function(d) {
            let idName = axisEltId(d); // axis ids have "a" prefix
              if (d != axisID)
                console.log('resetZoom', d, axisID);
            let a = oa.axes[d],
            domain = a.parent ? a.parent.domain : a.getDomain();
            domain = maybeFlip(domain, a.flipped);
            a.setZoomed(false);
            oa.y[d].domain(domain);
            oa.ys[d].domain(domain);
            a.setDomain(domain);
            let yAxis = a.axisSide(oa.y[d]).ticks(10);
            oa.svgContainer.select("#"+idName).transition(t).call(yAxis);
          });
          let axisTickS = svgContainer.selectAll("g.axis > g.tick > text");
          axisTickS.attr("transform", yAxisTicksScale);
          // axisStackChanged(t);
          throttledZoomedAxis(axisID, t);

          axisApi.pathUpdate(t);
          let axisS;
          let resetScope = axisID ? (axisS = selectAxisOuter(axisID)) : svgContainer;
            resetScope.selectAll(".btn").remove();
          if (axisID === undefined)
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
        const toolTip = oa.toolTip;
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
    if (false)
    debounce(
      function() {
        me.set("axisFeatureCircleHover", false);
      },
      10000);
    else
    {
      function hidePathHoverToolTip() { oa.toolTip.hide(d); }
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
   * The datum of `that` is the name of the axis which owns the brushed axis.
   * @param brushExtents  limits of the current brush, to which we are zooming
   */
  function zoom(that, brushExtents) {
    const fnName = 'zoom';
    const trace_zoom = 0;
    const selectedAxes = oa.selectedAxes;
    /** can be undefined in some cases. it is defined for WheelEvent - mousewheel zoom. */
    let e = d3.event.sourceEvent;
    let isWheelEvent = d3.event.sourceEvent instanceof WheelEvent;
    let timeStamp = e && e.timeStamp;
    me.set('axisZoom.zoomPan', {isWheelEvent, timeStamp});
    if (trace_zoom > 0 + isWheelEvent)
    console.log('zoom', that, brushExtents, arguments, this);
    let axisName;
    if (isWheelEvent) {
      axisName = arguments[0];
      brushExtents = undefined;
      let w = e;
      if (trace_zoom > 1) 
      console.log(
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
      /* The only apparent reason to add axis to selectedAxes[] when
       * mouse-wheel zoom is to prop up selectedAxes_i below, which will be
       * replaced.
       *
       * A couple of side-effects of WheelEvent adding axis to selectedAxes[] :
       * . draw_flipRegion() will apply to it;
       * . it is not apparent to the user that they should clear it,
       * by clicking on axis, to remove class .faded.
       */
       selectedAxes.addObject(axisName);
    }
    else if (e instanceof MouseEvent) {
      console.log(
        'MouseEvent', e);
    }
    else
    {
    axisName = d3.select(that).data();
    if (axisName.length == 1)
      axisName = axisName[0];
    }
    /* if parent (reference) block arrives after child (data) block, the brush
     * datum is changed from child to parent in adoption.  This code verifies
     * that.
     */
    let axis = oa.axesP[axisName],
    parentName = Block.axisName_parent(axisName);
    if (! axis || (parentName != axisName))
      breakPoint('zoom changing datum', axisName, 'to', parentName);
    else
      axis.verify();

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
    let selectedAxes_i = 
      selectedAxes.reduce(function(result, p, i) {
        if(p == axisName){
          result.push([p, i]);
        }
        return result;
      }, []);
    selectedAxes_i.forEach(function(p_i) {
      let [p, i] = p_i;
      {
        let y = oa.y, svgContainer = oa.svgContainer;
        if (brushExtents)
        // possibly selectedAxes changed after this callback was registered
        // The need for brushExtents[] is not clear; it retains earlier values from brushedRegions, but is addressed relative to selectedAxes[].
        if (brushExtents[i] === undefined)
        {
          console.log("zoom() brushExtents[i]===undefined", axisName, p, i, "use", brushedRegions[p]);
          brushExtents[i] = brushedRegions[p];
        }
        let yp = y[p],
        ypDomain = yp.domain(),
        axis = oa.axes[p],
        domain,
        brushedDomain;
        ensureYscaleDomain(yp, axis);
        if (brushExtents && brushExtents[i]) {
        brushedDomain = brushExtents[i].map(function(ypx) { return yp.invert(ypx /* *axis.portion*/); });
        // brushedDomain = [yp.invert(brushExtents[i][0]), yp.invert(brushExtents[i][1])];
        console.log("zoom", axisName, p, i, yp.domain(), yp.range(), brushExtents[i], axis.portion, brushedDomain);
          domain = brushedDomain;
        }
        else if (d3.event.sourceEvent)  // if there is a mousewheel event
        {
          /** note the brushedDomain before the scale change, for updating the brush position */
          let brushExtent = oa.brushedRegions[p];
          if (brushExtent)
            brushedDomain = axisRange2Domain(p, brushExtent);

          domain = wheelNewDomain(axis, oa.axisApi, false);  // uses d3.event, d3.mouse()
        }
        if (! axis.axis1d) {
          let a1 = axis?.blocks?.mapBy('block.axis1d');
          dLog(fnName, axisName, axis, a1, a1?.mapBy('isDestroying'));
          // axis.log();
        } else
        if (domain) {
          domainChanged = true;
          /** mousewheel zoom out is limited by javascript
           * precision, so consider domain equal if first 7 chars
           * are equal.  */
          function limitPrecision(x) { return ('' + x).substr(0,7); };
          let 
          /** total domain */
          domainAll = axis.axis1d.get('blocksDomain').toArray(),
          domainAllS = domainAll.map(limitPrecision),
          domainFS = maybeFlip(domain, axis.flipped).map(limitPrecision),
          /** true if (mousewheel) zoomed out to the limit of the whole domain. */
          zoomedOut = isEqual(domainAllS, domainFS);

          axis.setZoomed(! zoomedOut);
          y[p].domain(domain);
          oa.ys[p].domain(domain);
          // scale domain is signed. currently .zoomedDomain is not, so maybeFlip().
          axis.setDomain(maybeFlip(domain, axis.flipped));

          /* was updatePaths true, but pathUpdate() is too long for RAF.
           * No transition required for RAF.
           */
          debounce(
            undefined,
            me.functionHandle('axisScaleChangedRaf', axisScaleChangedRaf),
            p, tRaf, false,  // args
            me.get('controls.view.debounceTime')
          );
          let brushExtent = oa.brushedRegions[p];
          if (brushExtents)
            // `that` refers to the brush g element, i.e. <g clip-path> within <g.brush>
            d3.select(that).call(y[p].brush.move,null);
          else if (brushExtent) {
            let gBrush = d3.event.sourceEvent.target.parentElement;
            let newBrushExtent = brushedDomain.map(function (r) { return yp(r);});
            console.log(brushExtent, brushedDomain, gBrush, newBrushExtent);
            d3.select(gBrush).call(yp.brush.move, newBrushExtent);
          }
        }
      }
    });
    debounce(
      undefined,
      me.functionHandle('showAxisZoomResetButtons', showAxisZoomResetButtons),
      oa.svgContainer, getBrushExtents, zoom, bind(me, me.get('resetZooms')), axisName, me,  // args
      me.get('controls.view.debounceTime')
    );

    if (domainChanged) {
      // axisStackChanged(t);
      throttledZoomedAxis(axisName, t);
    }
  } // end of zoom()
  function axisScaleChangedRaf(p, t, updatePaths) {
    const job = 
    scheduler.schedule('affect', () => axisScaleChanged(p, t, updatePaths));
  }
  /** @param p  axisName
   * @param updatePaths true : also update foreground paths.
   */
  function axisScaleChanged(p, t, updatePaths)
  {
    const axisApi = oa.axisApi;
    let y = oa.y, svgContainer = oa.svgContainer;
    let yp = y[p],
    axis = oa.axes[p];
    if (yp && axis) {
      let yAxis = axis.axisSide(y[p]).ticks(me.axisTicks * axis.portion);
      let idName = axisEltId(p),
      axisS = svgContainer.select("#"+idName);
      if (t)
        axisS = axisS.transition(t)
        .duration(me.get('axisZoom.axisTransitionTime'));
      axisS.call(yAxis);
      if (updatePaths)
        axisApi.pathUpdate(t);
      let axisGS = svgContainer.selectAll("g.axis#" + axisEltId(p) + " > g.tick > text");
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
   * @param features is an array of feature names, created via (zoom) brush,
   * and input via text box
   * features are passed by selected-markers.js : flipRegion(), but not
   * view-controls.js:flipRegion().
   */
  function draw_flipRegion(features) {
    const axisApi = oa.axisApi;
    let brushedMap, zm,
    selectedAxes = oa.selectedAxes;
    let limits;
    if (selectedAxes.length === 0)
      console.log('draw_flipRegion', 'selectedAxes is empty', selectedAxes);
    /* axes = oa.selectedAxes;
      brushedMap = axes && axes.length && axes[axes.length-1]; */
    else if ((brushedMap = selectedAxes[0]) === undefined)
      console.log('draw_flipRegion', 'selectedAxes[0] is undefined', selectedAxes);
    else if ((zm = oa.z[brushedMap]) === undefined)
      console.log('draw_flipRegion', 'z[', brushedMap, '] is undefined', selectedAxes, oa.z);
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
        selectedAxes.forEach(function(p, i) {
          // p is selectedAxes[i], including brushedMap === selectedAxes[0]
          limits = axisBrushedDomain(p, i);
          //  oa.brushedRegions[brushedMap];
          console.log('flipRegion', p, i, brushedMap, limits);
          /* Generally for p in selectedAxes[], brushedRegions[p] is
           * defined; but if axis 'Reset' the brush is cleared but
           * the axis remains selected. */
          if (limits) {
            flipRegionInLimits(p, limits);
            flipRegionSignalAxis(p);
          }
        });
      }
      /** Flag the flip event for the axis - increment axis1d flipRegionCounter.
       * @param axisID  brushedMap / selectedAxes[i]
       */
      function flipRegionSignalAxis(axisID) {
      let axis = Stacked.getAxis(axisID),
      axis1d = axis && axis.axis1d;
      if (axis1d)
        axis1d.incrementProperty('flipRegionCounter');
      }
    }
    function features2Limits()
    {
      /** the first and last features have the minimum and maximum position
       * values, except where flipRegion has already been applied. */
      let limits = [undefined, undefined];
      limits = features
        .reduce(function(limits_, fi) {
          // console.log("reduce", fi, limits_, zm[fi]);
          // feature aliases may be in the selection and yet not in the map
          let zmi = zm[fi];
          if (zmi)
          {
            let l = zmi.location;
            if (limits_[0] === undefined || limits_[0] > l)
              limits_[0] = l;
            if (limits_[1] === undefined || limits_[1] < l)
              limits_[1] = l;
          }
          // console.log(zmi, l, limits_);
          return limits_;
        }, limits);
      // console.log("limits", limits);
      let 
        f0  = features[0], f1  = features[features.length-1];
      console.log("features2Limits", /*features, zm,*/ f0 , f1, limits);
      return limits;
    }

    function flipRegionInLimits(p, locationRange)
    {
      let
      /** delta of the locationRange interval */
      rd = locationRange[1] - locationRange[0],
      invert = function (l)
      {
        let i = rd === 0 ? l : locationRange[1] + (locationRange[0] - l);
        // console.log("invert", l, i);
        return i;
      };
      console.log("flipRegionInLimits", locationRange, rd);
      let axis = oa.stacks.axesP[p],
      blocks = axis && axis.blocks;
      console.log(axis, blocks);
      (blocks || []).map(function (block) {
        zm = oa.z[block.axisName];
        console.log(block.axisName, zm);
        d3.keys(zm).forEach(function(feature) {
          if (! isOtherField[feature]) {
            let feature_ = zm[feature], fl = feature_.value;
            if (subInterval(fl, locationRange))
              fl.forEach((v, i) => { feature_.value[i] = invert(v); });
          }
        });
      });
      axisApi.pathUpdate(undefined);
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
  brushClip, axisBrushSelect, showAxisZoomResetButtons,
  AxisBrushZoom,
};
