import { isArray } from '@ember/array';
import { throttle, next, later } from '@ember/runloop';
import EmberObject, { computed } from '@ember/object';
import { alias, filter } from '@ember/object/computed';
import $ from 'jquery';
import { inject as service } from '@ember/service';

import { isEqual } from 'lodash/lang';

import createIntervalTree from 'interval-tree-1d';

import {
  eltWidthResizable,
  noShiftKeyfilter
} from '../utils/domElements';
import { configureHover } from '../utils/hover';
import InAxis from './in-axis';
import {
  eltId,
  axisEltId,
  eltIdAll,
  axisEltIdClipPath2d,
  trackBlockEltIdPrefix,
  axisTitleColour
} from '../utils/draw/axis';
import { ensureSvgDefs } from '../utils/draw/d3-svg';

import { axisRegionNames } from './axis-2d';

/*----------------------------------------------------------------------------*/

/* milliseconds duration of transitions in which feature <rect>-s are drawn / changed.
 * Match with time used by draw-map.js : zoom() and resetZoom() : 750.
 * also @see   dragTransitionTime and axisTickTransitionTime.
 */
let featureTrackTransitionTime = 750;

/** If false, track <rect>s are trackWidth wide, and layering them to avoid
 * overlap cause the width allocated to the block to increase.
 * If true, the <rect>s are made proportionally narrower instead.
 */
const fixedBlockWidth = true;
/** To allow axis-tracks to share the same (fixed-width) horizontal space
 * allocation as axis-charts featuresCounts, use axisBlocks to allocate the
 * space, under the label 'trackCharts'.
 * Other axis-tracks which use variable width (e.g. sub-elements) will continue
 * to use childWidths['tracks'] for allocatedWidth.
 * QTLs are placed in the region outside the axis, on the right, and use fixed width
 * rectangles, i.e. variable width tracks.
 */
const useAxisBlocks = true;

/** Enable clearing of feature.layer, causing recalculation of layering.
 * If this is not enabled, the layering is calculated for the features just once.
 *
 *   con : causes flickering - e.g. if the layering for tracks F1, F2 is 0, 1, and
 * zooming in slightly F1 moves outside the view, then F2 will be given layer 0,
 * and the remainder of the tracks alternate.
 * This could also be solved by e.g. preserving .layer for just the first feature.
 *
 *   pro : for fixed-width tracks, layering determines compress ratio, so zooming
 * through many orders of magnitude, instead of being limited by layered tracks
 * which are outside the view, it makes sense to re-calculate the layering for
 * just the tracks in view, which can reduce layer depth and compression
 */
const clearLayers = false;

/** track sub-elements < this height (px) are not rendered. */
const subElementThresholdHeight = 5;


const trace = 1;
/** for devel.  ref comment in @see height() */
let trace_count_NaN = 10;

const dLog = console.debug;

/*------------------------------------------------------------------------*/

/**
 * @param tagName name of SVG element to create
 */
function createElementSvg(tagName) {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

/** If the selected element has the alternate tag, replace it.
 * @param fromTag, toTag, 
 * @param element
 * @param attributesForReplace  d3 each function which applies attributes and configuration for a new element
 * @return original element, or new element
 */
function swapTag(fromTag, toTag, element, attributesForReplace) {
  if (element.tagName === fromTag) {
    let to = createElementSvg(toTag);
    element.replaceWith(to);
    dLog('swapTag', fromTag, toTag, element, to, element.__data__);
    // copy d3 attributes to new element.
    if (element.__data__) {
      to.__data__ = element.__data__;
    }
    /* set width and configure to.__on */
    d3.select(to)
      .each(attributesForReplace);

    element.remove();
    element = to;
  }
  return element;
}


/*------------------------------------------------------------------------*/

/** @return the given location as string for display as hover text.
 * @param d featureData, i.e. interval, based on feature.value
 * called via text = textFn(context, d);
 */
function hoverTextFn(location, d, i, g) {
  /** location is d.description */
  /** typeof location may also be "number" or "object" - array : syntenyBlocks[x] */
  let text = (location == "string") ? location :  "" + location;
  if (trace > 1) {
    dLog('hoverTextFn', location, d, this, g[i]);
  }
  return text;
}

/*----------------------------------------------------------------------------*/

/** Configure hover text for tracks. */
function  configureTrackHover(interval)
{
  return configureHover.apply(this, [interval.description, hoverTextFn]);
}
/** Same as configureTrackHover(), except for sub-elements,
 * for which the source data, and hence .description, is in interval.data,
 * because the interval tree takes just the interval as input.
 */
function  configureSubTrackHover(interval)
{
  return configureHover.apply(this, [(interval.data || interval).description, hoverTextFn]);
}

/*----------------------------------------------------------------------------*/

function configureClick(selected, featureData2Feature) {
  return function (selection) {
    selection.on('click', function (d, i, g) { clickTrack.apply(this, [selected, featureData2Feature, d]);});
  };
}
function clickTrack(selected, featureData2Feature, featureData) {
  let feature = featureData2Feature.get(featureData);
  dLog('clickTrack', featureData, feature.id, feature);
  selected.clickFeature(feature);
}

/*----------------------------------------------------------------------------*/

/** For d3 .data() key function */
function I(d) { return d; }

/*----------------------------------------------------------------------------*/

/** Make the description unique in case there are multiple
 * positions for the same feature name.
 */
function intervalUniqueName(description, interval) {
  return description + "_" + interval[0];
}

/*----------------------------------------------------------------------------*/

/** filter intervalTree : select those intervals which intersect domain.
 * @param sizeThreshold intervals smaller than sizeThreshold are filtered out;
 * undefined means don't filter.
 * @param abutDistance	if 2 intervals are within this distance, consider them overlapping
 * @param assignOverlapped  true means assign overlapping tracks in sequence;
 * this is used for Feature tracks, but for sub-elements there is likely to be a
 * sub-element which overlaps all the others, which would place them all in
 * separate layers and missing opportunities to pack more closely.
 *
 * @return {intervals:  array of intervals,
 * nLayers : number of track layers allocated}
 * (Until d989e8f6, result contained .layoutWidth (px width), i.e. .nLayers multiplied by trackWidth*2.)
 */
function regionOfTree(intervalTree, domain, sizeThreshold, abutDistance, assignOverlapped)
{
  let intervals = [],
  result = {intervals : intervals};
  function visit(interval) {
    if ((sizeThreshold === undefined) || (interval[1] - interval[0] > sizeThreshold))
      intervals.push(interval);
  }
  let subTree;
  if (domain) {
    dLog("regionOfTree, domain", domain);
    if (domain[0] < domain[1])
      intervalTree.queryInterval(domain[0], domain[1], visit);
    else // ie: axis has been flipped
      intervalTree.queryInterval(domain[1], domain[0], visit);
    // Build another tree with just those intervals which intersect domain.
    subTree = createIntervalTree(intervals);
  } else {
    subTree = intervalTree;
    result.intervals = intervalTree.intervals;
  }

  if (clearLayers) {
    /* clear layers before layering */
    subTree.intervals.forEach((f) => {if (f.layer) { f.layer = undefined; } });
  }

  /** for each interval, if it does not have a layer,
   * get list of intervals in subTree it intersects,
   * note the layers of those which already have a layer assigned,
   * give the remainder (starting with the current interval) layers which are not assigned in that group.
   * (this alg is approx, but probably ok;  seems like a bin-packing problem)
   *
   * Added : to get a chequerboard pattern when the intervals mostly abut each
   * other, sort the intervals and use the .layer of another interval in
   * overlaps[] for interval o if it does not overlap o, checked with
   * nonOverlap(oMargin, );   otherwise fall back to assignInterval() which uses
   * chooseNext().
   */
  let i1 = subTree.intervals.sortBy('0'),
  layers = {}, largestLayer = 0;
  for (let j=0; j<i1.length; j++)
  {
    // could continue if (i1[j].layer)
    let i=i1[j], overlaps = [], layersUsed = [];
    function noteLayers(interval) {
      if (interval !== i) {
        overlaps.push(interval);
        if (interval.layer !== undefined)
          layersUsed[interval.layer] = true; /* or interval*/
      }
    };
    /** Scaffolds normally abut each other and they can be viewed more clearly
     * if that is treated as an overlap and layered.  This can be applied to
     * other Features (physical and GM), but perhaps not for
     * sub-elements. assignOverlapped can be used to differentiate, or we can
     * pass overlapIfAbut as another parameter.
     */
    let overlapIfAbut = abutDistance !== undefined;
    let overlapInterval = overlapIfAbut ? penumbra(i, abutDistance) : i; // unaffected by flip
    subTree.queryInterval(overlapInterval[0], overlapInterval[1], noteLayers);
    function unusedLayers() {
      let unused = [];
      /** Start counting with layer 1 - it simplifies a number of expressions. */
      for (let j3 = 1; j3<layersUsed.length; j3++)
      {
        if (! layersUsed[j3]) {
          unused.push(j3);
        }
      }
      return unused;
    }
    /** if layersUsed is empty, then ++lastUsed is 1,
     * if layersUsed is not empty, layersUsed[0] is empty, and
     * layersUsed[layersUsed.length - 1] is true and layersUsed.length - 1 is
     * the largest layer used.  e.g. if the only element is [1], lastUsed is 1.
     */
    let lastUsed = layersUsed.length ? (layersUsed.length - 1) : 0,
    u =  unusedLayers();
    function chooseNext() {
      let next = u.pop() || ++lastUsed;
      if (trace > 2 && next > 2) {
        dLog('chooseNext', next, u, lastUsed, 'trackBlocksData');
      }
      if (next > largestLayer) {
        largestLayer = next;
      }
      return next;
    }
    /** Assign a layer to one interval.
     * @param o  interval  */
    function assignInterval(o) {
      if (! o.layer)
        o.layer = chooseNext();
    }
    /** Assigninterval layers to remaining intervals in overlaps[].
     */
    function assignRemainder() {
      for (let j2 = 0; j2 < overlaps.length; j2++)
      {
        /** intervals which overlap i */
        let o = overlaps[j2];
        /** if o has an assigned .layer which conflicts with i, clear it.  */
        if ((o !== i) && (o.layer === i.layer) && o.layer) {
          o.layer = undefined;
        }
        if (! o.layer) {
          /** Expect that on the opposite side of i there is another abutting
           * interval which does not overlap o.  So use its .layer
           */
          let oMargin = penumbra(o, abutDistance);
          let i2 = overlaps.find((i1) => (i1 !== o) && nonOverlap(oMargin, i1));
          if (i2) {
                  o.layer = i2.layer;
          } else {
                  assignInterval(o);
          }
        }
      }
    };
    assignInterval(i);
    if (assignOverlapped)
      assignRemainder();
  }
  /* first layer allocated is 1; allocate one layer if 0.
   * largestLayer===0 means there were no overlaps.
   * if (clearLayers) can use .nLayers = (largestLayer || 1).
   */
  let nLayers;
  if (intervals.length) {
    let layersAssigned = intervals.mapBy('layer').uniq(),
    layersExtent = d3.extent(layersAssigned);
    nLayers = (layersExtent[1] - layersExtent[0]) + 1;
    dLog('regionOfTree layersAssigned', layersAssigned, layersExtent, nLayers);
  }
  result.nLayers = nLayers || 1;
  dLog('regionOfTree', result.nLayers, largestLayer, 'trackBlocksData');
  return result;
}

/*----------------------------------------------------------------------------*/

/** @return an interval larger by abutDistance on each end than the given interval
 * @desc Used for detecting near-overlap, within distance abutDistance.
 */
function penumbra(i, abutDistance) {
  return [i[0]-abutDistance, i[1]+abutDistance];
}

/** @return true if i0 and i1 do not overlap.
 * @desc Used in array.find()
 * @param i0, i1	interval in the form [from,to], sorted
 * @desc if not sorted, see also intervalOrdered()
 */
function nonOverlap(i0, i1) {
  /** based on utils/interval-calcs.js : intervalOverlap() */
  let overlap = 
      ((i1[0] < i0[1]) && (i0[0] < i1[1]));
  return ! overlap;
}

/*----------------------------------------------------------------------------*/


/** select the g.axis-outer which contains g.axis-use. */
function selectAxis(axisID)
{
  let aS = d3.select("#" + eltId(axisID));
  return aS;
}

function setClipWidth(axisID, width)
{
  let
  aS = selectAxis(axisID),
  cp = aS.select("g.axis-use > clipPath > rect");
  /** If the user has resized to a larger width, don't reduce it.
   * The role of this is to automatically increase the width if layout requires it.
   */
  if (! cp.empty() && cp.attr("width") < width)
    cp
    .attr("width", width);
  let gh = aS.select("g.axis-use > g.axis-html");
  gh
    .attr("transform", "translate(" + width + ")");
  dLog(
    'setClipWidth', axisID, width, aS.node(), cp.node(),
    ! cp.empty() && cp.attr("width"),  gh.node());
}

/*----------------------------------------------------------------------------*/

/** Sub-Element of a Feature; e.g. gene structure.
 */
class SubElement {
  constructor(data) {
    this.data = data;
  }
}
/** static, also  member @see getInterval()  */
SubElement.getInterval = function(data) {
  let interval = data.slice(0, 2);
  // perhaps use a WeakMap instead of this
  interval.data = data;
  if (interval[0] > interval[1]) {
    let swap = interval[0];
    interval[0] = interval[1];
    interval[1] = swap;
  }
  return interval;
};
SubElement.prototype.getInterval = function() {
  let interval = SubElement.getInterval(this.data);
  return interval;
};


/*----------------------------------------------------------------------------*/

/** @return true if the feature track interval is > MinimumIntervalWithArrow
 * @param y y scale of axis containing block of feature
 * @param featureData feature element data : feature.value[] plus layer and {,u}description 
 */
function showTriangleP(y, featureData) {
  let
  yS = featureData,
  yLength = y(yS[1]) - y(yS[0]),
  yLengthAbs = Math.abs(yLength),
  show = (yLengthAbs >= MinimumIntervalWithArrow);
  return show;
}

/** Construct a <path> which covers the end of an axis track with background
 * colour, leaving a vertical isosceles triangle, pointing in the positive
 * direction of the track interval.
 *
 * This is used to indicate direction of features / axis track rectangles.
 * @param y y scale of axis containing block of feature
 * @param yInterval	unscaled y position (interval) of feature
 * @param xWidth	width in px of track
 * @param xPosn xOffset, incorporates layer offset
 */
function rectTrianglePath(y, yInterval, xWidth, xPosn) {
  /** related : axisApi.lineHoriz(), featureLineS(), horizTrianglePath().  */
  /**
   *   ^	- yS[1]		-
   *  / \	^		triangleLength
   *  + +	|		-
   *  | |
   *  | |	|
   *  | |	v
   *  +-+	_ yS[0]
   *
   *  | xOffset
   *  | |	xWidth
   *
   * triangleLength :
   * . 0 if length(yS) < MinimumIntervalWithArrow
   * . MaxArrowLength if length(yS) > MaximumIntervalWithArrow
   * . proportionate in between
   */
  let
  /* scaled y position (interval) of feature */
  yS = [y(yInterval[0]), y(yInterval[1])],
  yLength = yS[1] - yS[0],
  yDirection = Math.sign(yLength),
  yLengthAbs = Math.abs(yLength),
  triangleLength =
    (yLengthAbs < MinimumIntervalWithArrow) ? 0 :
    (yLengthAbs > MaximumIntervalWithArrow) ? MaxArrowLength : 
    (
      MaxArrowLength * (yLengthAbs - MinimumIntervalWithArrow) / 
        (MaximumIntervalWithArrow - MinimumIntervalWithArrow)
    ),
  yShoulder = yS[0] + yDirection * (yLengthAbs - triangleLength);
  
  let xOffset = xPosn;
  let path = d3.line()([
    // base
    [xOffset, yS[0]],
    [xOffset + xWidth, yS[0]],

    // triangle
    [xOffset + xWidth, yShoulder],
    [xOffset + xWidth/2, yS[1]],
    [xOffset, yShoulder]

  ]) + 'Z';
  return path;
};

/** px */
/** interval < this size : no arrow is shown (<rect> instead of <path>). */
const MinimumIntervalWithArrow	= 10,
/** interval > this size : the arrow length does not increase. */
      MaximumIntervalWithArrow = 100,
      MaxArrowLength = 20;

/*----------------------------------------------------------------------------*/

/* global d3 */

export default InAxis.extend({

  queryParams: service('query-params'),
  urlOptions : alias('queryParams.urlOptions'),
  selected : service('data/selected'),
  axisZoom: service('data/axis-zoom'),


  className : "tracks",
  
  /** For each viewed block (trackBlocksR), some attributes are kept, until the
   * axis closes.  This state is likely to move to a axis-tracks-block component.
   * So far this contains only a WeakMap for the interval trees of Feature sub-elements (.subEltTree).
   * and .layoutWidth for the block.
   */
  blocks : {},

  featureData2Feature : new WeakMap(),


  /*--------------------------------------------------------------------------*/

  init() {
    this._super(...arguments);
  },

  /*--------------------------------------------------------------------------*/

  actions: {

    selectionChanged: function(selA) {
      console.log("selectionChanged in components/axis-tracks", selA);
      for (let i=0; i<selA.length; i++)
        console.log(selA[i].feature, selA[i].position);
    },

    putContent : function(object, event) {
      console.log("putContent in components/axis-tracks", object, event, event.type, event.target.innerText);
    }

  },

  /*--------------------------------------------------------------------------*/

  didInsertElement() {
    this._super(...arguments);

    console.log("components/axis-tracks didInsertElement()");
    /* if used, generalise for regions : axisRegionNames.forEach((g) => ... childWidths[g] ... width[g] */
    if (false) {
    let
    childWidths = this.get('childWidths'),
    axisID = this.get('axisID'),
    width = this.get('layoutWidth');
    dLog('didInsertElement', axisID, width);
    // [min, max] width
    childWidths.set(this.get('className'), [width, width]);
    }

    let svg = d3.selectAll('svg.FeatureMapViewer');
    ensureSvgDefs(svg);
  },

  willDestroyElement() {
    this._super(...arguments);
    console.log("components/axis-tracks willDestroyElement()");
  },

  didRender() {
    console.log("components/axis-tracks didRender()");
  },

  /*--------------------------------------------------------------------------*/

  /** @return the axis-1d which contains the axis-2d which contains this axis-tracks.
   * @desc Currently uses lookup via .axis; this can instead be passed in as a parameter.
   */
  axis1d : computed('axis.axis1d', 'axis.axis1d.isDestroying', function () {
    /** this CP could be simply a .alias, but it can get a reference to a axis1d
     * which is being destroyed; probably need a small design change in the
     * component relations. */
    let axis1d = this.get('axis.axis1d');
    if (axis1d && axis1d.isDestroying) {
      console.log('axis1d isDestroying', this);
      axis1d = undefined;
    }
    return axis1d;
  }),
  /** @return the corresponding stacks.js axis / Stacked object. */
  axisS : alias('axis.axis'),
  /** Current Y interval within the total domain of the axis reference block. */
  currentPosition : alias('axis1d.currentPosition'),
  yDomain : alias('currentPosition.yDomain'),
  stackBlocks : alias('axis1d.drawMap.oa.stacks.blocks'),

  /** From the Ember block objects, derive the stack Blocks. */
  trackBlocks : computed('trackBlocksR.@each.view', function () {
    let trackBlocksR = this.get('trackBlocksR'),
    trackBlocks = trackBlocksR.mapBy('view');
    console.log('trackBlocks', trackBlocksR, trackBlocks);
    return trackBlocks;
  }),
  /** Number of data blocks shown by this axis-tracks. */
  nTrackBlocks : alias('trackBlocksR.length'),

  /*--------------------------------------------------------------------------*/

  /** currently not called because (quoting from axis-2d comment) : axis-2d
   * receives axisStackChanged from draw-map and propagates it as zoomed to its
   * children.
   * In a separate commit this can be connected;  the update is not required -
   * the only effect of stacking would be a change of sizeThreshold, which could
   * be dependent on axis yRange but it is not yet.
   */
  axisStackChanged : function() {
    console.log("axisStackChanged in components/axis-tracks", this);
    // stack change would change the y display range of the axis, and hence the yScale
    this.showResize(true, true /* , yScaleChanged ? */);
  },
  /* Earlier version (prior to feature/progressive) defined zoomed() for InAxis;
   * this is replaced by giving showTrackBlocks() dependency on yDomain and
   * zoomed.
   */

  /*--------------------------------------------------------------------------*/

  showResize : function(widthChanged, heightChanged, yScaleChanged) {
    let tracks = this.get('tracks'),
    resized = {width : widthChanged, height : heightChanged, yScale : yScaleChanged};
    console.log((tracks === undefined) || tracks.length);
    let args = [resized, tracks];
    console.log('showResize args', args);
    if (tracks)
      throttle(this, this.layoutAndDrawTracks, args, 500, true);
  },

  /*--------------------------------------------------------------------------*/

  /** Convert input text to an interval tree.
   * @param tableText text string, TSV, rows separated by \n and/or \r.
   * First row may contain a header with column names, indicated by leading #.
   * Column names "start", "end" and "description" indicate the columns containing those values,
   * otherwise the default columns are 0, 1, 2 respectively.
   * Other columns are appended to the description value of the 
   */
  parseIntervals(tableText)
  {
    let axisName = "1", intervals = {}, intervalNames = new Set();
    let rows = tableText.split(/[\n\r]+/);
    let colIdx = {start : 0, end : 1, description : 2};
    for (let i=0; i<rows.length; i++)
    {
      let col=rows[i].split(/[ \t]+/);
      if ((rows[i].length == 0) || (col.length == 0))
      {
        console.log("empty row", i, rows[i]);
      }
      else if ((i == 0) && (col[0].startsWith("#")))
      {
        col[0] = col[0].substring(1); // trim off the leading #
        colIdx["start"] = col.indexOf("start");
        colIdx["end"] = col.indexOf("end");
        colIdx["description"] = col.indexOf("description");
      }
      else
      {
        let
        // mapChrName = col[0],
        interval = [col[colIdx["start"]], col[colIdx["end"]]],
        description = col[colIdx["description"]];
        for (let ic=0; ic<col.length; ic++)
        {
          if ((ic != colIdx["start"]) && (ic !=colIdx["end"]) && (ic != colIdx["description"]))
          {
            description += "_" + col[ic];
          }
        }
        interval.description = description;
        interval.udescription = intervalUniqueName(description, interval);

        // let axisName = mapChrName2Axis(mapChrName);
        if (intervals[axisName] === undefined)
          intervals[axisName] = [];
        intervals[axisName].push(interval);
        let intervalName = col[colIdx["start"]] + "_" + col[colIdx["end"]]; //makeIntervalName(mapChrName, [col[1], + col[2]]);
        intervalNames.add(intervalName);
      }
    }
    let result = this.makeTree(intervals, intervalNames);
    return result;
  },
  /** Make an interval tree from the given intervals.
   * @param intervals         array of intervals for each [blockId]
   * @param intervalNames     array of all interval names
   */
  makeTree(intervals, intervalNames) {
    let intervalTree = {};
    /* input data errors such as [undefined, undefined] in intervals passed to createIntervalTree() can cause
     * e.g. RangeError: Maximum call stack size exceeded in Array.sort().
     */
    d3.keys(intervals).forEach(function (axisName) {
      //Build tree
      intervalTree[axisName] = createIntervalTree(intervals[axisName]);
    });

    // scaffolds and intervalNames operate in the same way - could be merged or factored.
    let domain = Array.from(intervalNames.keys());
    console.log("makeTree intervalNames.keys().length", domain.length);
    let result = 
        {
          'intervalNames' : intervalNames,
          'intervalTree' : intervalTree
        };
    return result;
  },

  remove () {
    /** Based on layoutAndDrawTracks() : gp .remove()
     * related : axis-1d.js : selectGroup()
     */
    let
    axisID = this.get('axisID'),
    aS = selectAxis(axisID),
    gp = aS.select("g.axis-use")
      .selectAll("g.tracks");
    if (! gp.empty()) {
      console.log('removing', gp.nodes(), gp.node());
      gp
        .remove();
    }
  },


  /** Layout the feature rectangles and render them.
   * @param resized	undefined or {width, height}, which are true if the caller is a resize event.
   * @param tracks	result of tracksTree
   */
  layoutAndDrawTracks(resized, tracks)
  {
    /** this axis-tracks, used for blockIndex, which perhaps should be factored
     * out to here, if it does not change. */
    let thisAt = this;
    let trackWidth = this.get('trackWidth');

    featureTrackTransitionTime = this.get('axisZoom.axisTransitionTime');
    // seems run.throttle() .. .apply() is wrapping args with an extra [] ?
    if (resized && (resized.length == 2) && (tracks === undefined))
    {
      tracks = resized[1];
      resized = resized[0];
    }
    console.log("layoutAndDrawTracks", resized, tracks, tracks.intervalNames, tracks.intervalTree);
    /* identify axis by axisID.
     * (initial version supported only 1 split axis).  Could prefix selection with stack id.
     * <g class="axis-use">
     */
    let axisID = this.get('axisID'),
    aS = selectAxis(axisID);
    let
    oa = this.get('axis1d.drawMap.oa'),
    axis = oa.axes[axisID];
    /* if parent is un-viewed, this function may be called after axis is removed
     * from stacks. */
    if (! axis || ! axis.extended)
    {
      let gp = 
        // <g.axis-use> may already be gone.
        aS.select("g.axis-use")
        .selectAll("g.tracks");
      console.log('removing', gp.nodes(), gp.node());
      gp
        .remove();
      return;
    }
    let gAxis = aS.select("g.axis-use"),
    /** relative to the transform of parent g.axis-outer */
    bbox = gAxis.node().getBBox(),
    yrange = [bbox.y, bbox.height];
    dLog(gAxis.node());
    /** could skip the reference block blockIds[0]. */
    let blockIds = d3.keys(tracks.intervalTree);
    let
    /** For parseIntervals(), blockId is "1"; otherwise expect that blockId is a child of axisID.
        axisID = gAxis.node().parentElement.__data__, */
    y = oa.y[axisID],
    yDomain = y.domain();
    /* bbox was originally (up until 1116292) used to calculate yrange, yDomain, pxSize;
     * now use y.range(),.domain() instead because bbox.height is affected by zoom.
     * yDomain = [y.invert(yrange[0]), y.invert(yrange[1])],
     * pxSize = ... / bbox.height;
     */
    yrange = y.range();
    let
    pxSize = (yDomain[1] - yDomain[0]) / (yrange[1] - yrange[0]);
    /** For a given blockId shown in the axis, layout its tracks.
     */
    function trackBlocksData(blockId) {
      let
      t = tracks.intervalTree[blockId],
      block = oa.stacks.blocks[blockId],
      axis = block.getAxis(),
      zoomed = axis && axis.axis1d && axis.axis1d.zoomed,
      /** if zoomed in, tracks are not filtered by sizeThreshold.
       * The logic is : if the user is zooming in, they are interested in
       * features regardless of size, e.g. smaller than a pixel.
       * [ sizeThreshold is disabled by setting to undefined, while we prototype how to select a sub-set of features to display ]
       */
      sizeThreshold = undefined, // zoomed ? undefined : pxSize * 1/*5*/,
      yDomain = y.domain(),
      /** Testing showed that 150 is the smallest value which works for physical
       * genomes (600Mb) (use 200 in this case), and domain/1000 works OK for GM (~300 cM).
       */
      domainRange = yDomain[1] - yDomain[0],
      abutDistance = (domainRange > 0) ?
        Math.min(domainRange / 1000, 200) : 
        Math.min(-domainRange / 1000, 200),
      tracksLayout = regionOfTree(t, y.domain(), sizeThreshold, abutDistance, true),
      data = tracksLayout.intervals;
      let blockState = thisAt.lookupAxisTracksBlock(blockId);
      blockState.set('layoutWidth', tracksLayout.nLayers * trackWidth * 2);
      if (! blockState.hasOwnProperty('subElements')) {
        blockState.subElements = blockTagSubElements(blockId);
      }
      /** [min, max] */
      let allocatedWidth = thisAt.get('allocatedWidth');
      /** factor by which blockState.trackWidth must be reduced for layoutWidth to fit in trackWidth.
       * This is effectively tracksLayout.nLayers, which could be used here.
       */
      let compress = blockState.layoutWidth / (trackWidth*2);
      /* don't apply fixedBlockWidth if block subElements - the sub-elements
       * would be too thin to see well, and overlap is less likely.
       */
      blockState.trackWidth = ! fixedBlockWidth || blockState.subElements ?
        trackWidth : (
          allocatedWidth && allocatedWidth[1] ?
            allocatedWidth[1] / 2 / thisAt.get('nTrackBlocks') / compress :
            trackWidth   / compress);
      dLog('trackBlocksData', blockId, data.length, (data.length == 0) ? '' : y(data[0][0]),
           blockState, allocatedWidth, compress, thisAt.get('nTrackBlocks'));
      return data;
    };
    // a block with 1 feature will have pxSize == 0.  perhaps just skip the filter.
    if (pxSize == 0)
      console.log('pxSize is 0', yrange, yDomain);
    function xPosnS(subElements) {
      return xPosn;
      /** datum is interval array : [start, end];   with attribute .description. */
      function xPosn(d) {
        let
        p = this.parentElement,
        gBlock = subElements ? p.parentElement : p,
        blockId = gBlock.__data__;
  if (! subElements && (typeof blockId !== "string") && blockId.description && (typeof p.parentElement.__data__ === "string")) {
      blockId = p.parentElement.__data__;
  }
  let
        blockC = thisAt.lookupAxisTracksBlock(blockId),
        trackWidth = blockC.trackWidth;
        /*console.log("xPosn", d);*/
        return ((d.layer || 1) - 1) *  trackWidth * 2;
      };
    };
    /** @return the position of the start of the feature interval.
     * @desc This is used in combination with heightDir().
     */
    function yPosnDir(d) {
      return y(d[0]);
    };
    /** @return the position of the start or end of the feature interval, whichever is smaller.
     * This is used in combination with height(), which returns a positive value.
     */
    function yPosn(d) { /*console.log("yPosn", d);*/
      if (y(d[0]) > y(d[1]))
        return y(d[1]);
      else
        return y(d[0]);
    };
    /** return the end of the y scale range which d is closest to.
     * Used when transitioning in and out.
     */
    function yEnd(d, i, g) {
      let 
      yPosnD = yPosn.apply(this, [d, i, g]),
      range = y.range(),
      rangeMid = (range[1] - range[0]) / 2,
      fromStart = yPosnD - range[0],
      closerToStart = fromStart < rangeMid,
      end = range[1-closerToStart];
      return end;
    }
    /** @return height of feature in pixels at current scale,
     * including the direction of the feature interval, i.e. start - end,
     * i.e. .value[1] - .value[0],
     */
    function heightDir(d) {
      /** createIntervalTree() requires positive intervals, so the
       * .value [start,end] are reversed if negative (start > end) by
       * tracksTree() and SubElement.getInterval().
       * height() is used to determine the direction of triangles so
       * use feature.value[] here
       */
      let feature = thisAt.featureData2Feature.get(d),
          value = feature.get('value');
      d = value;
      let nonZeroInterval = Ember.isArray(d) && (d.length > 1) && (d[1] !== d[0]);
      /** if axis.zoomed then 0-height intervals are included, not filtered out.
       * In that case, need to give <rect> a height > 0.
       */
      let height = ! nonZeroInterval ? 0.01 : y(d[1]) - y(d[0]);
      /* There was an issue causing NaN here, likely caused by 1-element array
       * .value, which is now handled.   Here that was causing d[1] undefined,
       * and hence y(d[1]) NaN.
       */
      if (Number.isNaN(height) && (trace_count_NaN-- > 0))
      {
        console.log('height NaN', d, 'y:', y.domain(), y.range());
      }
      return height;
    }
    /** Same as heightDir() but return the absolute value, used for
     * drawing <rect> which requires a positive height.
     */
    function height(d) {
      let height = heightDir(d);
      /* When axis is flipped or feature direction is negative, height
       * will be negative, so make it positive
       */
      if (height < 0)
        height = -height;
      return height;
    };
    /** @return the horizontal offset of the left side of this block */
    function blockOffset(blockId, i) {
      let xOffset;
      // subElements could be mixed with fixed width blocks, so perhaps use .offset for all.

      let
      blockC = thisAt.lookupAxisTracksBlock(blockId);
      if (blockC.useAxisBlocks && ! blockC.subElements) {
        let
         /** array of [startOffset, width]. */
        blocksWidths = thisAt.get('axisBlocks.allocatedWidth'),
        axisBlocks = thisAt.get('axisBlocks.blocks'),
        blockIndex = axisBlocks.findIndex((block) => block.get('id') === blockId);
        let allocatedWidth = blocksWidths.length && blocksWidths[blockIndex];
        xOffset = allocatedWidth ? allocatedWidth[0] : 0;
      } else {
        /** blockC.offset is the sum of 
         * tracksLayout.nLayers*trackWidth*2 for each of the blockId-s to the left of this one. */
        let
        /** this assigns blocks[*].offset */
        widthSum = thisAt.get('blockLayoutWidthSum');
        xOffset = blockC.offset;
        if (blockC.region === 'right') {
          /** position right of axis-2d RightEdge
           * equivalent, but maybe not updated : thisAt.get('allocatedWidths.centre.1')
           */
          let rightEdge = thisAt.axis1d.get('axis2d.allocatedWidthsMax.centre');
          if (rightEdge !== undefined) {
            xOffset += rightEdge;
          }
        }
      }
      if (xOffset === undefined)
      {
        if (! fixedBlockWidth) {
          xOffset = 0;
        } else {
          // width/nTrackBlocks is related to 2 * trackWidth;
          let width = thisAt.get('width') || thisAt.get('layoutWidth');
          xOffset = width * (i+0.5) / thisAt.get('nTrackBlocks');
          dLog('blockOffset', blockId, i, width, xOffset, blockC);
        }
      }
      /** Leave 10px left margin to be clear of the axis brush.
       * This allows the track to be hovered, and keeps the tracks visually clear of the brush highlight.
       * This could be factored to axis-blocks : allocatedWidth, since it is
       * also required for axis-charts, which has an improvised +5 in
       * Chart1:group().
       */
      xOffset += 10;
      return xOffset;
    }
    function blockTransform(blockId, i) {
      let xOffset = blockOffset(blockId, i);
      return 'translate(' + xOffset + ',0)';
    }
    /** parent; contains g > rect, maybe later a text.resizer.  */
    let
    gpS =   gAxis
      .selectAll("g.tracks")
      .data(blockIds, I),
    gp = gpS
      .enter()
      .append("g")  // .insert(, ":last-child")
      .attr('class', 'tracks'),
    gpM = gp
      .merge(gpS)
      .attr('id', function (blockId) { console.log('', this, blockId); return trackBlockEltIdPrefix + blockId; })
      .attr('transform', blockTransform);
    gpS.exit().remove();
    /* this is for resizing the width of axis-tracks; may instead scale width of
     * rectangles to fit available width. */
    if (false) { // not completed.  Can base resizedParentElt() on axis-2d.js : resized()
      let
      text = gp
        .append("text")
        .attr('class', 'resizer')
        .html("⇹")
        .attr("x", bbox.width-10);
      if (gp.size() > 0)
        eltWidthResizable("g.axis-use > g.tracks > text.resizer", resizedParentElt);
    }
    /** define the clipPath.  1 clipPath per axis. */
    let
    clipRectS =
      gAxis.selectAll('g.axis-use > clipPath')
      .data([axisID]),
    clipRect = clipRectS
      .enter()
      .append("clipPath")       // define a clip path
      .attr("id", axisEltIdClipPath2d) // give the clipPath an ID
      .append("rect")          // shape it as a rect
    ;
    clipRectS
      .exit().remove();
    /* During zoom calcs, axis-ticks positions elements before the data is
     * re-filtered, causing gAxis bbox to be large.  Don't resize to that.
     * No longer using bbox.height anyway
     * (resized && (resized.width || resized.height) && )
     */

    /** Set x only for .append.  Update y, width and height for all. */
    let clipRectA = clipRect.merge(clipRectS.selectAll("clipPath > rect"));

    if (bbox.x < 0)
      bbox.x = 0;
    /* seems like bbox.x is the left edge of the left-most tracks (i.e. bbox
     * contains the children of gAxis), so use 0 instead. */
    bbox.y = yrange[0] ;
    /** + trackWidth for spacing. */
    bbox.width = this.get('combinedWidth') + trackWidth;
    bbox.height = yrange[1] - yrange[0];
    clipRect
      .attr("x", 0 /*bbox.x*/);
    clipRectA
      .attr("y", bbox.y)
      .attr("width", bbox.width)
      .attr("height", bbox.height)
    ;
    if (clipRect.size())
    {
      console.log('clipRect', bbox.width, clipRect.node());
    }
    let g = gp.append("g")
      .attr("clip-path", "url(#" + axisEltIdClipPath2d(axisID) + ")"); // clip the rectangle

    function trackKeyFn(featureData) {
      // Make description unique when multiple features with same name.
      return featureData.description+"_"+featureData[0];
    }
    /** Add the <rect>s and/or <path>s, or sub-elements, within <g clip-path...>  */
    let
    /** block select - datum is blockId. */
    bs = gAxis.selectAll("g.axis-use > g.tracks > g"),
    a = bs.each(function(blockId,i,g) {
      let
      subElements = blockTagSubElements(blockId),
      eachFn = subElements ? eachGroup : eachRect;
      eachFn.apply(this, [blockId, i, g]);
    });
    /** @return true if the given block has the tag geneElements, indicating
     * sub-elements should be shown. */
    function blockTagSubElements(blockId) {
      let
      block = oa.stacks.blocks[blockId],
      tags = block.block.get('datasetId.tags'),
      subElements = tags && (tags.indexOf("geneElements") >= 0);
      return subElements;
    };
    function eachRect(blockId, i, g) {
      let
      /** match either rect or path */
      rs = d3.select(this).selectAll(".track")
        .data(trackBlocksData, trackKeyFn),
      re =  rs.enter(), rx = rs.exit();
      dLog(rs.size(), re.size(),  'rx', rx.size());

      let
      blockC = thisAt.lookupAxisTracksBlock(blockId),
      trackWidth = blockC.get('trackWidth');
      appendRect.apply(this, [re, rs, trackWidth, false]);
    }
    /** Within a single block, render the features or sub-features of
     * the selection as a <rect> or <path>
     * 
     * @param re  .entry() selection
     * @param rs  selection
     * @param width
     * @param subElements true if features are sub-features
     * - rename re and rs to ge and gs
     * es could be called rs
     * @param subElements true if (gene) sub-elements (intro/exon) are displayed for this block.
     */
    function appendRect(re, rs, width, subElements) {
      const
      // this.parentElement.__data__ is also the blockId
      blockId = this.__data__,
      block = thisAt.lookupBlock(blockId),
      isPhased = block && (block.hasTag('phased') || block.get('datasetId._meta.phased')),
      /** true to enable use of 5-point <path> (rectangle+triangle) as an
       * alternate representation, with the triangle vertex indicating
       * direction. */
      useTriangle = false && isPhased;
      /** true means <rect> will not be used - only <path> (rectangle+triangle).
       */
      const alwaysTri = true;
      let
      /** true for the 3-point <path>. This is not alternated with <rect>, i.e. useBoth is false */
      useTriangle3 = isPhased && ! subElements,
      /** true when using <path> */
      usePath = useTriangle3 || useTriangle,
      /** true when using either <rect> or <path> depending on zoom
       * (triangle point is only visible when zoomed in).  */
      useBoth = useTriangle && ! alwaysTri,
      tagName = ['rect', 'path'][+usePath],
      ra = re
        .append(! useBoth ? tagName : (d) => createElementSvg(useTriangle && (alwaysTri || showTriangleP(y, d)) ? 'path' : 'rect'));
      ra
        .attr('class', 'track')
        .each(subElements ? configureSubTrackHover : configureTrackHover);
      if (! subElements) {
        ra.call(configureClick(thisAt.selected, thisAt.featureData2Feature));
      }
      rs.merge(ra)
        .transition().duration(featureTrackTransitionTime)
        .attr('width', useTriangle ? ((d) => alwaysTri || showTriangleP(y, d) ? undefined : width) : width);

      function attributesForReplace(d, i, g) {
        let s =
        d3.select(g[i])
        .each(subElements ? configureSubTrackHover : configureTrackHover)
        .transition().duration(featureTrackTransitionTime)
        .attr('width', useTriangle ? ((d) => alwaysTri || showTriangleP(y, d) ? undefined : width) : width);
        if (! subElements) {
          s.call(configureClick(thisAt.selected, thisAt.featureData2Feature));
        }
      }

      let
      blockIndex = thisAt.get('axis1d.blockIndexes'),
      /** the structure here depends on subElements:
       * true : g[clip-path] > g.track.element > rect.track
       * false : g[clip-path] > rect.track
       * appendRect() could also be used for geneElementData[], which would pass isSubelement=true.
       */
      isSubelement = false,
      gSelector = subElements ? '.track' : '[clip-path]',
      elementSelector = isSubelement ? '.element' : ':not(.element)',
      /** match either {rect,path}.track */
      es = subElements ?
        /** .track here will match rect.track, path.track; not just tagName + '.track' 	 */
      // if tagName is required here, would need to repeat the whole selector for rect,path - better to make class more specific
        rs.selectAll("g" + gSelector + " > .track" + elementSelector) : rs,
      /** ra._parents is the g[clip-path], whereas es._parents are the g.track.element
       * es.merge(ra) may work, but ra.merge(es) has just 1 elt.
       */
      rm = es
        .merge(ra);
      dLog('rm', rm.node(), 'es', (trace > 1) ? es.nodes() : es.size(), es.node());
      ra
        .attr('y', (d,i,g) => useTriangle && (alwaysTri || showTriangleP(y, d)) ? undefined : yEnd.apply(this, [d, i, g]));
      if (! useTriangle) {
        ra
          .call(positionUpdate);
        let rmt =
        rm
          .transition().duration(featureTrackTransitionTime)
          .call(fadeOutIfZoomedOut)
          .call(positionUpdate);
        if (useTriangle3) {
          ra
            .each(triangleDimensions);
          rmt
            .each(triangleDimensions);
        }
      }
      else if (alwaysTri) {
        let xPosnFn = xPosnS(subElements);
        rm
          // maybe transition
          .attr('d', (d,i,g) => rectTrianglePath(y, d, width, xPosnFn.apply(this, [d, i, g])));
      }
      else {
      rm
      // .transition().duration(featureTrackTransitionTime)
        .each(
          (d,i,g) => showTriangleP(y, d) ?
            function (d, i, g) {
              g[i] = swapTag('rect', 'path', g[i], attributesForReplace);
              let x = xPosnS(subElements).apply(this, [d, i, g]);
              d3.select(g[i])
                .attr('d', (d,i,g) => rectTrianglePath(y, d, width, x));
            }.apply(this, [d, i, g]) :
          function (d, i, g) {
            g[i] = swapTag('path', 'rect', g[i], attributesForReplace);
            d3.select(g[i])
              .call(rectUpdate);
          }.apply(this, [d, i, g])
        );
      }

      /** Transition the exiting <rect>s and <paths> to the end of the
       * y scale range which d is closest to, using yEnd.
       * Then remove them after that transition.
       */
      let rx = rs.exit();
      if (usePath) {
        const
        xPosnD = 0,
        yPosn = yEnd;
        rx
          .transition().duration(featureTrackTransitionTime)
          .attr('transform', (d,i,g) => "translate(" + xPosnD + ", " + yPosn.apply(this, [d, i, g]) + ")")
          .on('end', () => {
            rx.remove();
          });
      } else {
        rx
          .transition().duration(featureTrackTransitionTime)
          .attr('x', 0)
          .attr('y', yEnd)
          .on('end', () => {
            rx.remove();
          });
      }


      function positionUpdate(selection) {
        if (usePath) {
          selection
            .attr('transform', featureTransform);
        } else {
          rectUpdate(selection);
        }
      }
      function rectUpdate(selection) {
        selection
          .attr('x', xPosnS(subElements))
          .attr('y', yPosn)
          .attr('height' , height);
      }
      /** zoom:Reset will generally replace feature tracks with
       * features counts charts (axis-charts.js), depending on
       * featuresCountsThreshold.
       * To make this less abrupt, transition the tracks out by
       * reducing opacity.
       */
      function fadeOutIfZoomedOut(selection) {
        /** If block.isZoomedRightOut and selection is a transition,
         * and opacity is not set, set it to 1 immediately, and
         * transition to 0.
         */
        let t0 = selection.node();
        if (t0) {
          /** may not be blockId, e.g subElements, so default to false. */
          let blockId = t0.parentElement.__data__,
              block = blockId && oa.stacks.blocks[blockId],
              out = block && block.block.isZoomedRightOut();
          /** if selection is a transition */
          if (out && selection.selection) {
            /* if called again before transition is complete,
             * don't restart the attribute values. */
            if (! t0.hasAttribute('stroke-opacity')) {
              selection.selection()
                .attr('stroke-opacity', 1)
                .attr('fill-opacity', 1);
            }
            selection
              .attr('stroke-opacity', 0)
              .attr('fill-opacity', 0);
          }
        }
      }
      rm
      .attr('stroke', blockTrackColourI)
      .attr('fill', blockTrackColourI)
      ;

      dLog('ra', ra.size(), ra.node(), 'rm', rm.size(), rm.node());
      // result is not used yet.
      return ra;
    }
    /** Position the feature representation (<path>) with a transform.
     * This plays an analogous role to rectUpdate(), which does not
     * apply to path because it sets x,y,height.
     */
    function featureTransform(d, i, g) {
      let
      xPosnD = xPosnS(/*subElements*/false).apply(this, [d, i, g]),
      yPosnD = yPosnDir.apply(this, [d, i, g]),
      /** xPosnS() offsets by  + d.layer*trackWidth  */
      transform = "translate(" + xPosnD + ", " + yPosnD + ")";
      return transform;
    }
    /** triangle with tip facing toward the axis.
     * Used to make features obvious when small (height) and sparse / useTriangle3.
     * (could use a line segment with an arrow, see lineDimensions() : showArrow).
     */
    function triangleDimensions(d, i, g) {
      let
      width = trackWidth / 2,
      tWidth = width/2,
      heightD = heightDir.apply(this, [d, i, g]),
      /** either a horizontal arrow pointing left, or a vertical arrow pointing in the direction of the feature interval. */
      vertical = true,
      /** based on lineDimensions() : sideWedge -> triangle,  tipY -> heightD, wedgeX -> tWidth,  */
      triangle = vertical ?
        [
          [width, 0],
          [0, 0],
          [tWidth, heightD]
        ] :
        [
          [tWidth, heightD],
          [0, heightD / 2],
          [tWidth, 0]
        ],
      points = triangle,
      l =
        d3.select(this)
        .attr('d', d3.line()(points))
      ;
      dLog('triangleDimensions', width, tWidth, heightD, points);
    }

    /** subElements */
    function eachGroup(blockId, i, g) {
      let
      egs = bs.selectAll("g.element")
      // probably add geneKeyFn showing sub-element details, e.g. typeName, start/end, sequence?
        .data(trackBlocksData, trackKeyFn),
      ege =  egs.enter(), egx = egs.exit();
      dLog('ege', ege.node(), 'egx', egx.nodes());
      egx.remove();
      let
      ega = ege
        .append("g")
        .attr('class', 'track element');
      dLog('ega', ega.node(), ega.size(), egs.size());

      let
      egm = egs.merge(ega),
      era = appendRect.apply(this, [ega, egs, trackWidth, true]);


      /** geneElementData will be a function of d (feature / interval).
       * [start, end, typeName] :
       * start, end are relative to the feature / interval / track / gene.
       */
      let geneElementData_dev = [
        [0.1, 0.2, 'intron'],
        [0.55,0.8, 'utr'],
        [0.45,0.35,'exon'],
      ];
      /** If true then use the development data, otherwise get the real data from the feature .value[]. */
      const useDevData = false;
      /** @return the sub-element data extract from a Feature.value.
       * @param d Feature.value
       */
      function elementDataFn (d, i, g) {
        let featureValue = d;
        featureValue = featureValue && featureValue[2];
        if (! isArray(featureValue))
          featureValue = [];
        return featureValue;
      }
      /** Map the given typeName to the characteristics of the shape which will
       * represent that type.  This is a description of the shape, not the
       * symbol it represents; i.e. the same shape could be used for 2 different
       * gene sub-element types.
       */
      class ShapeDescription {
        /** @param typeName */
        constructor(typeName) {
          /** true means show a pointed tip on the rectangle, indicating read direction.
           */
          this.showArrow = false;
          this.width = trackWidth / 2;
          switch (typeName) {
          case 'intron' :
            this.tagName = 'path';
            this.useLine = true;
            /** side-spur for intron */
            this.sideWedge = true;
            this.width = 1;
            this.fill = null;  // set in css. 'none'; // inherits black, so set none.
            break;

          case 'mRNA':
            this.tagName = 'path';
            this.useLine = true;
            this.width = 1;
            break;

          case 'exon':
          case 'CDS':
            this.tagName = this.showArrow ? 'path' : 'rect';
            this.useLine = false;
            break;

          case 'utr':
          case 'five_prime_UTR':
          case 'three_prime_UTR':
            this.useLine = true;
            /** blue fill for utr (dashed thick blue line, maybe arrow head), */
            this.tagName = 'path';
            this.width = trackWidth / 3;
            this.showArrow = true;
            break;

          default :
            this.tagName = 'path';
            dLog('ShapeDescription', typeName);
            break;
          }
          /** default stroke and fill is blockTrackColourI
           * if fill===stroke then can use path instead of rect
           */
        }
      };

      /* would use ega here, but the sub-element may be added in a separate pass after the parent g.track.element.   */
      egm.each(function (d, i, g) {
        let
        a = d3.select(this);
        let heightD = height.apply(this, [d, i, g]);
        if (heightD < subElementThresholdHeight)
        {
          let ses = a
            .selectAll('g.track.element > .track.element');
          ses.remove();
        } else {
          let geneElementData = useDevData ? geneElementData_dev : elementDataFn.apply(this, arguments);
          geneElementData.forEach(subEltDescription);
          // layer the geneElementData
          geneElementData = thisAt.layerSubElements(blockId, d.description, geneElementData);
          let ges = a.selectAll('g.track.element > ' + '.track.element')
            .data(geneElementData);
          let
          ea = ges
            .enter()
            .append((e) => {
              let typeName = e.data[2],
                shape = e.shape || (e.shape = new ShapeDescription(typeName));
              return document.createElementNS("http://www.w3.org/2000/svg", shape.tagName); });
          ges
            .exit()
            .remove();
          // ea.each(subEltDescription);
          function subEltDescription(e, j) {
            let [start, end, typeName] = e;
            let shape = e.shape;
            if (! e.description) {
              e.description = d.description + ' : ' +
                start + '-' + end + ' ' + typeName;
              dLog('e.description', e.description, d.description, d, e);
            }
          };
          ea
            .attr('class', (e) => {
              let typeName = e.data[2];
              if (typeName.endsWith('_prime_UTR')) 
                typeName += ' utr';
              return 'track element ' + typeName;
            })
          // .transition().duration(featureTrackTransitionTime)
            .each(function (e, i, g) {
              let s = d3.select(this), shape = e.shape;
              s.attr(shape.tagName === 'path' ? 'stroke-width' : 'width', shape.width); })
            .each(configureSubTrackHover);
        }
      });
      // ega.each was used for .append();  egm.each is used to update size.
      // could now factor these 2 loops together ..
      egm.each(function (d, i, g) {
        let
        a = d3.select(this),
        /** height and yPosn don't yet use `this`, i or g, but they could, so
         * the standard d3 calling signature is used.  xPosn uses `this`.
         * ((d,i,g) => height(d, i, g))(d,i,g) should also work but it compiles to a function without .apply
         */
        heightD = height.apply(this, [d, i, g]);
        if (heightD > subElementThresholdHeight) {
          let
          xPosn = xPosnS(/*subElements*/true),
          xPosnD = xPosn.apply(this, [d, i, g]),
          yPosnD = yPosn.apply(this, [d, i, g]);
          let geneElementData = useDevData ? geneElementData_dev : elementDataFn.apply(this, arguments);
          // layer the geneElementData
          geneElementData = thisAt.layerSubElements(blockId, d.description, geneElementData);
          let ges = a.selectAll('g.track.element > ' + '.track.element')
            .data(geneElementData);
          ges.each(function(e, j) {
            let [start, end, typeName] = e.data,
              /** signed vector from start -> end. */
              heightElt;
            if (useDevData)
              heightElt = heightD * (end - start);
            else {
              start = y(start);
              end = y(end);
              heightElt = (end - start);
            }
            let shape = e.shape || (e.shape = new ShapeDescription(typeName));
            /** x and y position of sub-element */
            let ex = xPosnD + trackWidth * 2,
              ey = useDevData ? yPosnD + heightD * start : start;
            let showDimensions = shape.useLine ? lineDimensions : shape.showArrow ? elementDimensions : rectDimensions;
            /** sub-element selection */
            let ses =
              d3.select(this)
              .transition().duration(featureTrackTransitionTime)
              .each(showDimensions);
            if (shape.stroke !== null)
              ses.attr('stroke', shape.stroke || blockTrackColourI);
            if (shape.fill !== null)
              ses.attr('fill', shape.fill || blockTrackColourI);

            function lineDimensions(d, i, g) {
              let
              /** cut-down version of rectArrow() - the rectangle centreline
               * could be factored out.
               */
              tipEndsY = [0, heightElt],
              endsY = [0, heightElt],
              tipY = tipEndsY[1],
              width = trackWidth / 2,
              centreX = width/2,
              wedgeX = width/2,
              centreLine = [
                [centreX, 0],
                [centreX, tipY]
              ],
              sideWedge = [
                [centreX+wedgeX, tipY],
                [centreX+wedgeX*2, heightElt / 2],
                [centreX+wedgeX, 0]
              ],
              /** put the centreLine last, because marker-end. */
              points = shape.sideWedge ?
                sideWedge.concat(centreLine) : centreLine,
              l =
                d3.select(this)
                .attr('d', d3.line()(points))
                .attr('transform', (d) => "translate(" + (d.layer*trackWidth + ex) + ", " + ey + ")");
              dLog('lineDimensions', heightElt, width, points, sideWedge);
              if (shape.showArrow) {
                let arrow = (shape.width === 1) ? 'arrow' : 'fat_arrow';
                l.attr('marker-end', (heightElt < 20) ? "none" : 'url(#marker_' + arrow + ')');
              }
            }
            function rectDimensions(d, i, g) {
              d3.select(this)
                .attr('x', ex + d.layer*trackWidth)
                .attr('y', ey)
                .attr('height' , heightElt);
            }
            function rectArrow(d, i, g) {
              /** signed, according to direction start -> end. */
              let
              arrowLength = heightElt / 3, // 10,
              tipEndsY = [0, heightElt],
              endsY = [0, heightElt],
              direction = start < end,
              directionFrom = +!direction,
              directionTo = +direction;
              endsY[1] -= arrowLength;
              let
              tipY = tipEndsY[1],
              width = shape.width,
              tip = [[width/2, tipY]],
              append  = direction ? 'push' : 'unshift',
              /** the arrow tip is added between 2 points with the same y. */
              pointsLeft = [
                [0, endsY[directionFrom]],
                [0, endsY[directionTo]]
              ],
              pointsRight = [
                [width, endsY[directionTo]],
                [width, endsY[directionFrom]]
              ],
              points = direction ?
                pointsLeft.concat(tip, pointsRight) :
                pointsLeft.concat(pointsRight, tip);
              let
              l =  d3.line()(points) + 'Z';
              dLog('rectarrow', arrowLength, tipEndsY, endsY, direction, tip, append, points, l);
              return [l];
            }

            function elementDimensions(d, i, g) {
              d3.select(this)
                .attr('transform', "translate(" + (d.layer*trackWidth + ex) + ", " + ey + ")")
                .attr('d', rectArrow);
            }
          });
        }
      });
    }

    /** Colour a Feature or sub-element <rect> or other element by
     * the block colour, which corresponds to the block's position
     * in the axis title menu, and the track order from the left.
     *
     * Used for assigning fill and stroke via d3 .attr().
     */
    function blockTrackColourI (b) {
      let parent = this.parentElement;
      if (! parent.getAttribute('clip-path')) {
        parent = parent.parentElement;
        // can check that parent has clip-path, and data is string
      }
      let
      blockId = parent.__data__,
      blockIndex = thisAt.get('axis1d.blockIndexes'),
      /** If blockIndex{} is not collated yet, can scan through blockIds[] to get index.
       * Actually, the number of blocks will be 1-10, so collating a hash is
       * probably not time-effective.
       */
      i = blockIndex && blockIndex[blockId];
      if (i === undefined)
        i = blockIds.indexOf(blockId);
      // console.log(d,i,b);
      // colour is calculated from i, not blockId.
      // index into axis.blocks[] = <g.tracks> index + 1
      return axisTitleColour(blockId, i+1) || 'black';
    }
    /** This has a similar role to the above blockTrackColourI(); it
     * is simpler but it creates its own selection instead of working
     * within a given transition.
     *
     * Starting from a selection of the block element (e.g. gp),
     * select child elements matching a given selector string.  The
     * block element selection provides the block index whereas the
     * alternative blockTrackColourI() uses axis1d.blockIndexes.
     */
    function blockColour(selector) {
      function blockTrackColour(d,i,g) {
        d3.select(this).selectAll(selector)
        // .transition().duration(featureTrackTransitionTime)
          .attr('stroke', axisTitleColourI)
          .attr('fill', axisTitleColourI);
        function axisTitleColourI (b) {
          // console.log(d,i,b);
          // index into axis.blocks[] = <g.tracks> index + 1
          return axisTitleColour(d, i+1) || 'black';
        }
      }
      return blockTrackColour;
    }
    /** note of how blockColour() would be used. */
    let blockTrackColour = blockColour('rect.track, path.track');
    if (false)
      // gp
      d3.selectAll('g.tracks')
      .each(blockTrackColour);

  },  // end of layoutAndDrawTracks()

  /*--------------------------------------------------------------------------*/

  /** Display as tracks the data which the user has pasted into the
   * spreadsheet.
   * This was used to provide data in early development, and might
   * be used for displaying ad-hoc data which the user pastes in.
   * The spreadsheet could be moved from its current position within
   * the split axis (as HTML within a <foreignObject>) to a dialog.
   */
  pasteProcess: function(textPlain) {
    console.log("components/axis-tracks pasteProcess", textPlain.length);

    let
    parseIntervals = this.get('parseIntervals'),
    layoutAndDrawTracks = this.get('layoutAndDrawTracks');

    let tracks = parseIntervals(textPlain);
    this.set('tracks', tracks); // used by axisStackChanged() : layoutAndDrawTracks()
    /** parseIntervals() puts the data into a blockId (refered to as axisName) "1".
     * This was refactored to incorporate the addition of trackBlocks(), showTrackBlocks();
     * if required these changes can be tested / debugged.
     */
    let blockId = "1";
    /** Parsed data is echoed in the table. */
    let forTable = tracks.intervalTree[/*blockId*/1].intervals.map(this.intervalToStartEnd);
    // intersect with axis zoom region;  layer the overlapping tracks; draw tracks.
    layoutAndDrawTracks.apply(this, [undefined, tracks]);

    this.set('data.tracks', forTable);
  },
  intervalToStartEnd : function(interval) {
    interval.start = interval[0];
    interval.end = interval[0];
    return interval;
  },

  /*--------------------------------------------------------------------------*/



  /** Not used; can be used in .hbs for trace, for comparison against the result
   * of showTrackBlocks(). */
  blocksFeaturesLengths : computed(
    'trackBlocksR.@each.featuresLength',
    'trackBlocks.[]', 'trackBlocksR.0.featuresLength', 'trackBlocksR.0.features.[]',
    function () {
      let lengths = this.get('trackBlocks').map((block) => [block.axisName, block.block.get('featuresLength')]);
      // similar : d3.keys(block.features())
      console.log('blocksFeaturesLengths', lengths);
      return lengths;
    }),

  /** Construct a interval tree from the track data.
   * This is used for filtering and for layering.
   */
  tracksTree : computed('trackBlocksR.@each.featuresLength', function () {
    let
    axisID = this.get('axisID'),
    trackBlocksR = this.get('trackBlocksR'),
    featuresLengths = this.get('trackBlocksR').mapBy('featuresLength');
    console.log('tracksTree', axisID, this, trackBlocksR, featuresLengths);
    let
    featureData2Feature = this.featureData2Feature,
    /** similar to : axis-1d.js : showTickLocations(), which also does .filter(inRange)
     */
    intervals = trackBlocksR.reduce(
      function (blockFeatures, blockR) {
        let
        blockId = blockR.get('id'),
        features = blockR.get('features')
          .toArray()  //  or ...
          .map(function (feature) {
            let interval = feature.get('range') || feature.get('value');
            /* extra attributes will be added to interval : .description,
               * .udescription, .feature.   Can copy .value to avoid modifying
               * store object with attributes which are local and ephemeral. */
            interval = interval.slice();
            featureData2Feature.set(interval, feature);

            /* copy/paste into CSV in upload panel causes feature.value to be a
             * single-element array, e.g. {name : "my1AGene1", value : [5200] }
             * interval-tree expects an interval to be [start, end].
             */
            if (interval.length == 1) {
              interval.push(interval[0]);
            } else if (! interval.length) {
              interval = [interval, interval];
            }
            /* interval-tree:createIntervalTree() assumes the intervals are positive, and gets stack overflow if not. */
            else if (interval[1] === null) {
              /* undefined / null value[1] indicates 0-length interval.  */
              interval[1] = interval[0];
            }
            else if (interval[0] > interval[1]) {
              let swap = interval[0];
              interval[0] = interval[1];
              interval[1] = swap;
            }
            interval.description = feature.get('name');
            interval.udescription = intervalUniqueName(interval.description, interval);
            /* for datasets with tag 'SNP', feature .values.{ref,alt} is reference / alternate,
             * e.g. "A/G", "T/C" etc */
            let values = feature.get('blockId.isSNP') && feature.get('values');
            if (values && (values.ref || values.alt)) {
              let refAlt = (values.ref || '') + '/' + (values.alt || '');
              interval.description += ('\n' + refAlt);
            }
            return interval;
          });
        blockFeatures[blockId] = features;
        return blockFeatures;
      }, {}),
    intervalNames = d3.keys(intervals),
    tracks = this.makeTree(intervals, intervalNames);
    /** may need to limit this to apply only for a significant change of zoomedDomain, e.g. zoomedDomainDebounced.  */
    if (clearLayers) {
      d3.keys(intervals).forEach(function (axisName) {
        let ifs = intervals[axisName];
        // regionOfTree() will assign a layer to features with !f.layer
        ifs.forEach((f) => {if (f.layer) { f.layer = undefined; } });
      });
    }


    // now that this is a computed function, don't need to store the result.
    this.set('tracks', tracks); // used by axisStackChanged() : passed to layoutAndDrawTracks()
    return tracks;
  }),

  lookupBlock(blockId) {
    let
    blockS = this.get('stackBlocks')[blockId],
    block = blockS && blockS.block;
    return block;
  },

  /** The blocks within axis-tracks have collected some attributes,
   * so will likely be split out as a sub-component.
   * As an interim step, this function maps blockId to an object
   * containing attributes for the block, which include :
   * .offset : x offset of left side of this block / track
   * .layoutWidth	: required number of layers of rectangles * trackWidth
   * .trackWidth	: compressed width to fit in constant trackWidth
   * .subElements	: true if the block data contains sub-elements
   * .subEltTree	: an interval tree for layering sub-elements within the feature
   */
  lookupAxisTracksBlock(blockId) {
    let blocks = this.get('blocks'),
    blockState = blocks[blockId] || (blocks[blockId] = this.constructAxisTracksBlock(blockId));
    if (! blockState.hasOwnProperty('subElements')) {
      dLog('lookupAxisTracksBlock', blockId);
    }

    return blockState;
  },
  constructAxisTracksBlock(blockId) {
    let blockState = EmberObject.create();
    let blockS = this.get('stackBlocks')[blockId];
    blockState.subElements = blockS.block.get('isSubElements');
    blockState.region = (blockS.block.get('datasetId._meta.type') === 'QTL') ? 'right' : 'centre';
    blockState.useAxisBlocks = (blockState.region === 'centre') ? useAxisBlocks : false;
    dLog('constructAxisTracksBlock', blockId, blockState);
    return blockState;
  },
  /** Use the interval tree of sub-element data to layer them within
   * the feature.
   */
  layerSubElements(blockId, featureId, geneElementData) {
    let blockState = this.lookupAxisTracksBlock(blockId);
    if (! blockState.subEltTree)
      blockState.subEltTree = {};
    if (! blockState.subEltTree[featureId]) {
      let
      intervalNames = geneElementData.mapBy('description'),
      intervals = geneElementData.map(SubElement.getInterval),
      /** just conforming to the signature of makeTree() - probably no need to index by blockId here. */
      intervalsByBlockId = {};
      intervalsByBlockId[blockId] = intervals;
      blockState.subEltTree[featureId] = this.makeTree(intervalsByBlockId, intervalNames);
    }
    let
    subEltTree = blockState.subEltTree[featureId],
    /** sizeThreshold would be used if the sub-elements were only displayed when
     * zoomed so that their pixel represention was large enough to be
     * useful.
     */
    sizeThreshold = undefined,
    /** passing yDomain to regionOfTree() will hide sub-elements as they move
     * out of scope during zoom/pan; when they re-enter scope they may be
     * layered differently than when all sub-elements are added at the same
     * time, so this is not done (and there is an update issue with rerending in
     * this case).  */
    // yDomain = this.get('yDomain'),
    tracksLayout = regionOfTree(subEltTree.intervalTree[blockId], undefined, sizeThreshold, undefined, false),
    data = tracksLayout.intervals;
    blockState.set('layoutWidth', tracksLayout.nLayers * this.get('trackWidth') * 2);
    return data;
  },


  /** Map .trackBlocksR to the IDs of the track blocks.
   */
  blockIds : computed('trackBlocksR.[]', function () {
    let
    trackBlocksR = this.get('trackBlocksR'),
    blockIds = trackBlocksR.mapBy('id');
    return blockIds;
  }),
  /** Map blocks to an array of values, so that it can be used in a dependency
   * e.g. 'blockComps.@each.layoutWidth'
   * The block components are sub-components of axis-track.
   */
  blockComps : computed('blockIds.[]', function () {
    let
    blocks = this.get('blocks'),
    blockIds = this.get('blockIds'),
    comps = blockIds.map((blockId) => this.lookupAxisTracksBlock(blockId));
    return comps;
  }),

  /** for all blocks in trackBlocksR, sum .layoutWidth
   *
   * Side Effect: assigns block.offset which is the progressive value of the sum,
   * if ! fixedBlockWidth.
   * @return .{centre,right} width
   */
  blockLayoutWidthSum : computed('blockComps.@each.layoutWidth', function () {
    let
    blockIds = this.get('blockIds');

    /*  sum the .layoutWidth for all blockId-s */
    let 
    blocks = this.get('blocks'),
    blockIds2 = Object.keys(blocks),
    trackWidth = this.get('trackWidth'),
    /** initial .offset not needed; g.axis-use will translate(trackWidth) */
    shiftRight = 0,
    initial = axisRegionNames.reduce((o, g) => { o[g] = shiftRight; return o; }, {}),
    widths = blockIds.reduce((sums, blockId) => {
      let block = this.lookupAxisTracksBlock(blockId);
      /** region name is e.g. 'centre', 'right' */
      let region = block.get('region');
      block.offset = sums[region];
      let blockWidth;
      if (block.subElements || ! fixedBlockWidth) {
        blockWidth = block.layoutWidth || block.trackWidth || trackWidth;
      } else {
        blockWidth = block.useAxisBlocks ? 0 : 2 * trackWidth;
      }
      sums[region] += blockWidth;
      return sums;
    },  initial);

    dLog('blockLayoutWidthSum', widths, blockIds.length, blockIds2.length, this.get('blockComps.length'));
    return widths;
  }),
  variableWidthBlocks : filter('trackBlocksR', (block) => block.get('isSubElements')),
  /**
   * @return (region){centre,right} width
   */
  layoutWidth : computed('variableWidthBlocks', function () {
    let
    vwBlocks = this.get('variableWidthBlocks'),
    blockIds = this.get('blockIds'),
    /** Add 50 on the right to avoid clashing with the right axis ticks text,
     * which may later be switched off with CSS.
     * this includes xOffset from blockTransform(blockIds.length-1) 
     * @see blockTransform()
     */
    widths =
      /*40 +*/ this.get('blockLayoutWidthSum') /*+ 20 + 50*/; // same as getAxisExtendedWidth()
    console.log('layoutWidth', blockIds, widths);
    next(() => {
      Object.keys(widths).forEach((region) => {
        let width = widths[region];
        this.get('childWidths')[region].set(this.get('className'), [width, width]);
      });
    });

    return widths;
  }),
  combinedWidth : computed('layoutWidth.centre', 'allocatedWidth', 'axisBlocks.allocatedWidth.[]', function() {
    let
    axisBlocks = this.get('axisBlocks.allocatedWidth'),
    rightBlock = axisBlocks.length && axisBlocks[axisBlocks.length-1],
    axisBlocksEnd = rightBlock ? rightBlock[1] : 0;

    let allocatedWidth = this.get('allocatedWidth');

    let width = ((allocatedWidth && allocatedWidth[1]) ??  this.get('layoutWidth')) + axisBlocksEnd;
    return width;
  }),
  /** Render changes related to a change of .layoutWidth
   */
  layoutWidthEffect : computed('combinedWidth', function () {
    let
    axisID = this.get('axisID'),
    width = this.get('combinedWidth');

    setClipWidth(axisID, width);
    return width;
  }),
  slowDependenciesChanged : 0,
  /** These dependencies will change during the transition started by
   * showTrackBlocks(), so defer them until the transition is settled.
   *
   * featureLength and tracksTree (which depends on @each.featuresLength) are
   * likely triggered by result of feature request API which is also triggered
   * by the zoomedDomain change.
   *
   * Using a task to wrap the transition will probably be a more maintainable
   * alternative (as in axis-ticks-selected.js : labelsTransitionPerform).
   */
  slowDependenciesEffect : computed(
    'tracksTree',
    'axis1d.featureLength',
    function() {
      const axisTransitionTime = 750;
      later(() => (
        !this.isDestroyed && ! this.isDestroying &&
        this.incrementProperty('slowDependenciesChanged')),
            axisTransitionTime + 250);
    }),
  /** Render changes driven by changes of block data or scope.
   */
  showTrackBlocks: computed(
    'slowDependenciesChanged',
    // 'tracksTree',
    /** .yDomain is available; for the dependency -Throttled is used */
    'axis1d.currentPosition.yDomain.{0,1}',	// Throttled
    'axis1d.zoomed', 'axis1d.extended', // 'axis1d.featureLength',
    function() {
      let tracks = this.get('tracksTree');
      let
      axis1d = this.get('axis1d'),
      zoomed = this.get('axis1d.zoomed'),
      isViewed = axis1d.axis.get('isViewed'),
      extended = this.get('axis1d.extended'),
      featureLength = this.get('axis1d.featureLength'),
      yDomain = this.get('yDomain');
      console.log('showTrackBlocks', this, tracks, axis1d, isViewed, /*yDomain*/ this.get('axis1d.currentPosition.yDomainThrottled'), 'axis1d.zoomed', zoomed, extended, featureLength);
      let featuresLength;
      /* This works but doesn't give a transition from tracks to charts
         if (! this.get('trackBlocksR.length') || axis1d.isZoomedRightOut()) {
         this.remove();
         } else
      */
      if (isViewed) {
        let blockIds = d3.keys(tracks.intervalTree);

        // intersect with axis zoom region;  layer the overlapping tracks; draw tracks.
        this.layoutAndDrawTracks.apply(this, [undefined, tracks]);
        featuresLength = blockIds.map((blockId) => [blockId, tracks.intervalTree[blockId].intervals.length]);
        console.log('showTrackBlocks() featuresLength', featuresLength);
      }
      return featuresLength;
    }),
  adjustedWidth : alias('parentView.adjustedWidth'),
  /** Render changes related to component / window resize.
   */
  resizeEffectHere : computed('resizeEffect', 'allocatedWidth.{0,1}', function () {
    let result = this.get('resizeEffect');
    let
    allocatedWidth = this.get('allocatedWidth'),
    allocatedWidthPrev = this.get('allocatedWidthPrev'),
    allocatedWidthChange = ! allocatedWidthPrev || ! isEqual(allocatedWidthPrev, allocatedWidth);
    if (allocatedWidthChange) {
      this.set('allocatedWidthPrev', allocatedWidth);
    }
    dLog('resizeEffectHere in axis-tracks', this.get('axisID'), result,
         allocatedWidthPrev, allocatedWidth, allocatedWidthChange,
         this.get('adjustedWidth'));
    /** @return true if rc[f] indicates a change of field f.
     * if the previous size is not recorded, then treat it as a change.
     */
    function isChanged(rc, f) { return rc ? rc[f] : true; }
    /* these 2 prevent 2-step transition of axis track y update.
     * after confirming this fix, the calculation of changed.viewport{Width,Height} can be sorted out.

     * Side effect : setting viewportHeight = false is ignoring window
     * height resize - feature y position is not updated.
     * So commented out the clearing of changed.viewportHeight - not seeing any 2-step transition (yet) ...
     */
result.changed.viewportWidth = false;
// result.changed.viewportHeight = false;
    let
    widthChanged = isChanged(result.changed, 'viewportWidth') || allocatedWidthChange,
    heightChanged = isChanged(result.changed, 'viewportHeight'),
    anyChange = widthChanged || heightChanged;
    if (anyChange) {
    this.showResize(
      widthChanged, heightChanged, 
      /* , yScaleChanged ? */);
    }
  }),
  flippedEffect : computed('axis1d.flipped', function () {
    /** 'scaleChanged' could be used as an alternate dependency */
    this.showResize(false, false, true);
  }),

  keypress: function(event) {
    console.log("components/axis-tracks keypress", event);
  }


});

