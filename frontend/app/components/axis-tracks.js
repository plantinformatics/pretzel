import Ember from 'ember';

import createIntervalTree from 'npm:interval-tree-1d';
import { eltWidthResizable, noShiftKeyfilter } from '../utils/domElements';
import InAxis from './in-axis';
import {  /* Axes, yAxisTextScale,  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform,*/ eltId, axisEltId, eltIdAll, axisEltIdClipPath /*,highlightId*/ , axisTitleColour }  from '../utils/draw/axis';


/*----------------------------------------------------------------------------*/
/* milliseconds duration of transitions in which feature <rect>-s are drawn / changed.
 * Match with time used by draw-map.js : zoom() and resetZoom() : 750.
 * also @see   dragTransitionTime and axisTickTransitionTime.
 */
const featureTrackTransitionTime = 750;

/** width of track <rect>s */
const trackWidth = 10;

/*------------------------------------------------------------------------*/
/* copied from draw-map.js - will import when that is split */
    /** Setup hover info text over scaffold horizTick-s.
     * @see based on similar configureAxisTitleMenu()
     */
    function  configureHorizTickHover(location)
    {
      // console.log("configureHorizTickHover", location, this, this.outerHTML);
      /** typeof location may also be "number" or "object" - array : syntenyBlocks[x] */
      let text = (location == "string") ? location :  "" + location;
      let node_ = this;
      Ember.$(node_)
        .popover({
          trigger : "click hover",
          sticky: true,
          delay: {show: 200, hide: 3000},
          container: 'div#holder',
          placement : "auto right",
           content : text
        });
    }
/*----------------------------------------------------------------------------*/

function  configureTrackHover(interval)
{
  return configureHorizTickHover.apply(this, [interval.description]);
}

/*----------------------------------------------------------------------------*/

/** filter intervalTree : select those intervals which intersect domain.
 * @param sizeThreshold intervals smaller than sizeThreshold are filtered out;
 * undefined means don't filter.
 * @return {intervals:  array of intervals,
 * layoutWidth : px width allocated for the layered tracks}
 */
function regionOfTree(intervalTree, domain, sizeThreshold)
{
  let intervals = [],
  result = {intervals : intervals};
  function visit(interval) {
    if ((sizeThreshold === undefined) || (interval[1] - interval[0] > sizeThreshold))
      intervals.push(interval);
  }
  intervalTree.queryInterval(domain[0], domain[1], visit);
  // Build another tree with just those intervals which intersect domain.
  let subTree = createIntervalTree(intervals);
  /** for each interval, if it does not have a layer,
   * get list of intervals in subTree it intersects,
   * note the layers of those which already have a layer assigned,
   * give the remainder (starting with the current interval) layers which are not assigned in that group.
   * (this alg is approx, but probably ok;  seems like a bin-packing problem)
   */
  let i1 = subTree.intervals, layers = {}, nextLayer = 0, largestLayer = 0;
  for (let j=0; j<i1.length; j++)
  {
    // could continue if (i1[j].layer)
    let i=i1[j], overlaps = [], layersUsed = [];
    function noteLayers(interval) {
      overlaps.push(interval);
      if (interval.layer) layersUsed[interval.layer] = true; /* or interval*/
    };
    subTree.queryInterval(i[0], i[1], noteLayers);
    function unusedLayers() {
      let unused = [];
      for (let j3 = 0; j<layersUsed.length; j++)
      {
        if (! layersUsed[j3])
          unused.push(j3);
      }
      return unused;
    }
    /** if layersUsed is empty, then ++lastUsed is 0,  */
    let lastUsed = layersUsed.length-1,
    u =  unusedLayers();
    function chooseNext() {
      let next = u.pop() || ++lastUsed;
      return next;
    }
    function assignRemainder(interval) {
    };
    for (let j2 = 0; j2 < overlaps.length; j2++)
    {
      let o = overlaps[j2];
      if (! o.layer)
        o.layer = chooseNext();
    }
    if (lastUsed > largestLayer)
      largestLayer = lastUsed;
  }
  result.layoutWidth = (largestLayer+1) * trackWidth * 2;

  return result;
}

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
  if (cp.attr("width") < width)
  cp
    .attr("width", width);
  let gh = aS.select("g.axis-use > g.axis-html");
  gh
    .attr("transform", "translate(" + width + ")");
  console.log('setClipWidth', axisID, width, aS.node(), cp.node(), cp.attr("width"),  gh.node());
}


/*----------------------------------------------------------------------------*/

/* global d3 */

export default InAxis.extend({

  className : "tracks",
  
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

  didInsertElement() {
    this._super(...arguments);
    let parentView = this.get('parentView'),
    axisID = this.get('axisID'),
    width = this.get('layoutWidth');
    parentView.send('contentWidth', 'axis-tracks', axisID, width);
  },

  didRender() {
    console.log("components/axis-tracks didRender()");
    let trackBlocks = this.get('trackBlocks');
    if (trackBlocks && trackBlocks.length)
      this.showTrackBlocks();
  },

  axisStackChanged : function() {
    console.log("axisStackChanged in components/axis-tracks", this);
    this.showResize(true, true);
  },
  zoomed : function() {
    console.log("zoomed in components/axis-tracks", this);
    /* axisStackChanged() will be called before zoomed, otherwise
     * widthChanged==false could shadow the true passed by axisStackChanged(),
     * because of .throttle() */
    this.showResize(false, false, true);
  },
  showResize : function(widthChanged, heightChanged, yScaleChanged) {
    let tracks = this.get('tracks'),
    resized = {width : widthChanged, height : heightChanged, yScale : yScaleChanged};
    console.log((tracks === undefined) || tracks.length);
    let args = [resized, tracks];
    console.log('showResize args', args);
    if (tracks)
      Ember.run.throttle(this, this.layoutAndDrawTracks, args, 500, true);
  },

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

  /**
   * @param resized	undefined or {width, height}, which are true if the caller is a resize event.
   * @param tracks	result of tracksTree
   */
  layoutAndDrawTracks(resized, tracks)
  {
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
    oa = this.get('axis').drawMap.oa, // or pass in this.get('data'),
    axis = oa.axes[axisID];
    if (! axis.extended)
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
    function trackBlocksData(blockId) {
      let t = tracks.intervalTree[blockId],
      block = oa.stacks.blocks[blockId],
      axis = block.getAxis(),
      /** if zoomed in, tracks are not filtered by sizeThreshold.
       * The logic is : if the user is zooming in, they are interested in
       * features regardless of size, e.g. smaller than a pixel.
       */
      sizeThreshold = axis.zoomed ? undefined : pxSize * 1/*5*/,
      tracksLayout = regionOfTree(t, yDomain, sizeThreshold),
      data = tracksLayout.intervals;
      if (false)  // actually need to sum the .layoutWidth for all blockId-s, plus the block offsets which are calculated below
      setClipWidth(axisID, tracksLayout.layoutWidth);
      console.log('trackBlocksData', blockId, data.length, (data.length == 0) || y(data[0][0]));
      return data;
    };
    // a block with 1 feature will have pxSize == 0.  perhaps just skip the filter.
    if (pxSize == 0)
      console.log('pxSize is 0', yrange, yDomain);
    /** datum is interval array : [start, end];   with attribute .description. */
    function xPosn(d) { /*console.log("xPosn", d);*/ return ((d.layer || 0) + 1) *  trackWidth * 2; };
    function yPosn(d) { /*console.log("yPosn", d);*/ return y(d[0]); };
    function height(d)  { return y(d[1]) - y(d[0]); };
    function blockTransform(blockId, i) {
      /** -	plus tracksLayout.layoutWidth for each of the blockId-s to the left of this one. */
      let xOffset = (i+1) * 2 * trackWidth;
      return 'translate(' + xOffset + ',0)';
    }
    /** parent; contains g > rect, maybe later a text.resizer.  */
    let gp =   gAxis
      .selectAll("g.tracks")
      .data(blockIds)
      .enter()
      .append("g")  // .insert(, ":last-child")
      .attr('id', function (blockId) { return blockId; })
      .attr('transform', blockTransform)
      .attr('class', 'tracks');
    /* this is for resizing the width of axis-tracks; may instead scale width of
     * rectangles to fit available width. */
    if (false) { // not completed.  Can base resizedParentElt() on axis-2d.js : resized()
    let text = gp
      .append("text")
      .attr('class', 'resizer')
      .html("⇹")
      .attr("x", bbox.width-10);
    if (gp.size() > 0)
      eltWidthResizable("g.axis-use > g.tracks > text.resizer", resizedParentElt);
  }
    /** define the clipPath.  1 clipPath per axis. */
    let clipRect =
      gAxis.selectAll('clipPath')
      .data([axisID])
      .enter()
      .append("clipPath")       // define a clip path
      .attr("id", axisEltIdClipPath) // give the clipPath an ID
      .append("rect")          // shape it as a rect
    ;
    /* During zoom calcs, axis-ticks positions elements before the data is
     * re-filtered, causing gAxis bbox to be large.  Don't resize to that.
     * No longer using bbox.height anyway
     * (resized && (resized.width || resized.height) && )
     */
    if (clipRect.size() == 0)
    {
      clipRect = gAxis.selectAll("clipPath > rect");
      console.log('clipRect', clipRect.size(), bbox, clipRect.node());
    }
    if (bbox.x < 0)
      bbox.x = 0;
    bbox.y = yrange[0] ;
    bbox.width = this.get('layoutWidth');
    bbox.height = yrange[1] - yrange[0];
    clipRect
      .attr("x", bbox.x)
      .attr("y", bbox.y)
      .attr("width", bbox.width)
      .attr("height", bbox.height)
    ;
    if (clipRect.size())
    {
      console.log('clipRect', bbox.width, clipRect.node());
    }
    let g = gp.append("g")
      .attr("clip-path", "url(#" + axisEltIdClipPath(axisID) + ")"); // clip the rectangle
    function trackKeyFn(featureData) { return featureData.description; }
    /** Add the <rect> within <g clip-path...>  */
    let
      rs = gAxis.selectAll("g.axis-use > g.tracks > g").selectAll("rect.track")
      .data(trackBlocksData, trackKeyFn),
    re =  rs.enter(), rx = rs.exit();
    let ra = re
      .append("rect");
    ra
      .attr('class', 'track')
      .transition().duration(featureTrackTransitionTime)
      .attr('width', trackWidth)
      .each(configureTrackHover);
    ra
      .merge(rs)
      .transition().duration(featureTrackTransitionTime)
      .attr('x', xPosn)
      .attr('y', yPosn)
      .attr('height' , height)
      .attr('stroke', function (b) {
        let blockId = this.parentElement.__data__,
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
      })
    ;
    console.log(gAxis.node(), rs.nodes(), re.nodes(), rx.size());
    rx.remove();

    /** record the positions (index) of the elements g.selector
     * This is used in assigning colours to block <g>-s.
     */
    function blockIndexes(selection) {
      let blockIndex = {};
      selection.each(function (d, i) { blockIndex[d] = i; });
      return blockIndex;
    }
    let blockIndex = blockIndexes(d3.selectAll('g.tracks'));

    function blockColour(selector) {
    function blockTrackColour(d,i,g) {
      d3.select(this).selectAll(selector)
        // .transition().duration(featureTrackTransitionTime)
        .attr('stroke', function (b) {
          // console.log(d,i,b);
          // index into axis.blocks[] = <g.tracks> index + 1
          return axisTitleColour(d, i+1) || 'black';
        });
    }
      return blockTrackColour;
    }
    let blockTrackColour = blockColour('rect.track');
    if (false)
    // gp
     d3.selectAll('g.tracks')
      .each(blockTrackColour);

  },

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
  tracksTree : Ember.computed('trackBlocks', function () {
    console.log('tracksTree', this);
    let axisID = this.get('axisID'),
    trackBlocks = this.get('trackBlocks'),
    /** similar to : axis-1d.js : showTickLocations(), which also does .filter(inRange)
     */
    intervals = trackBlocks.reduce(
      function (blockFeatures, block) {
        let blockR = block.block,
        blockId = blockR.get('id'),
        features = blockR.get('features')
         .toArray()  //  or ...
          .map(function (feature) {
            let interval = feature.get('range') || feature.get('value');
            if (! interval.length)
              interval = [interval, interval];
            interval.description = feature.get('name');
            return interval;
          });
        blockFeatures[blockId] = features;
        return blockFeatures;
      }, {}),
    intervalNames = d3.keys(intervals),
    tracks = this.makeTree(intervals, intervalNames);
    // now that this is a computed function, don't need to store the result.
    this.set('tracks', tracks); // used by axisStackChanged() : passed to layoutAndDrawTracks()
    return tracks;
  }),
  layoutWidth : Ember.computed('trackBlocks', function () {
    let
    trackBlocks = this.get('trackBlocks'),
    blockIds = trackBlocks.map(function (block) { return block.axisName; }),
    /** Add 50 on the right to avoid clashing with the right axis ticks text,
     * which may later be switched off with CSS.
     * this includes xOffset from blockTransform(blockIds.length-1) 
     * @see blockTransform()
     */
    width =
      40 + blockIds.length * 2 * trackWidth + 20 + 50;
    console.log('layoutWidth', blockIds, width);
    return width;
  }),
  showTrackBlocks: function() {
    console.log('showTrackBlocks', this);
    let tracks = this.get('tracksTree');
    let blockId = d3.keys(tracks.intervalTree)[0];
    let forTable = tracks.intervalTree[blockId].intervals.map(this.intervalToStartEnd);
    // intersect with axis zoom region;  layer the overlapping tracks; draw tracks.
    this.layoutAndDrawTracks.apply(this, [undefined, tracks]);
  },

  keypress: function(event) {
    console.log("components/axis-tracks keypress", event);
  },


});
