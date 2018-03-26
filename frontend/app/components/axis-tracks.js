import Ember from 'ember';

import createIntervalTree from 'npm:interval-tree-1d';
import { eltWidthResizable, noShiftKeyfilter } from '../utils/domElements';
import InAxis from './in-axis';

/*----------------------------------------------------------------------------*/
/* copied from draw-map.js - will import when that is split */
    /** Setup hover info text over scaffold horizTick-s.
     * @see based on similar configureAPtitleMenu()
     */
    function  configureHorizTickHover(location)
    {
      console.log("configureHorizTickHover", location, this, this.outerHTML);
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
 * @param sizeThreshold intervals smaller than sizeThreshold are filtered out
 * @return intervals  array of intervals
*/
function regionOfTree(intervalTree, domain, sizeThreshold)
{
  let intervals = [];
  function visit(interval) {
    if (interval[1] - interval[0] > sizeThreshold)
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
  let trackWidth = 10;
  setClipWidth((largestLayer+1) * trackWidth * 2);

  return intervals;
}

function setClipWidth(width)
{
  /** This will need APid. */
  let cp = d3.select("g.axis-use > g.tracks > clipPath#axis-clip > rect");
  cp
    .attr("width", width);
  let gh = d3.select("g.axis-use > g.axis-html");
  gh
    .attr("transform", "translate(" + width + ")");
}


/*----------------------------------------------------------------------------*/

/* global d3 */

export default InAxis.extend({

  className : "tracks",
  
  actions: {

    selectionChanged: function(selA) {
      console.log("selectionChanged in components/axis-tracks", selA);
      for (let i=0; i<selA.length; i++)
        console.log(selA[i].marker, selA[i].position);
    },

    putContent : function(object, event) {
      console.log("putContent in components/axis-tracks", object, event, event.type, event.target.innerText);
    }

  },

  didRender() {
    console.log("components/axis-tracks didRender()");
  },

  axisStackChanged : function() {
    let tracks = this.get('tracks'),
    layoutAndDrawTracks = this.get('layoutAndDrawTracks');
    console.log("axisStackChanged in components/axis-tracks", this, (tracks === undefined) || tracks.length);
    if (tracks)
      layoutAndDrawTracks.apply(this, [tracks]);
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
    let apName = "1", intervals = {}, intervalNames = new Set(), intervalTree = {};
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
      // let apName = mapChrName2AP(mapChrName);
      if (intervals[apName] === undefined)
        intervals[apName] = [];
      intervals[apName].push(interval);
      let intervalName = col[colIdx["start"]] + "_" + col[colIdx["end"]]; //makeIntervalName(mapChrName, [col[1], + col[2]]);
      intervalNames.add(intervalName);
      }
    }
    /* input data errors such as [undefined, undefined] in intervals passed to createIntervalTree() can cause
     * e.g. RangeError: Maximum call stack size exceeded in Array.sort().
     */
    d3.keys(intervals).forEach(function (apName) {
      //Build tree
      intervalTree[apName] = createIntervalTree(intervals[apName]);
    });

    // scaffolds and intervalNames operate in the same way - could be merged or factored.
    let domain = Array.from(intervalNames.keys());
    console.log("parseIntervals intervalNames.keys().length", domain.length);
    let result = 
    {
      'intervalNames' : intervalNames,
      'intervalTree' : intervalTree
    };
    return result;
  },

  layoutAndDrawTracks(tracks)
  {
    console.log("layoutAndDrawTracks", tracks, tracks.intervalNames, tracks.intervalTree);
    // initial version supports only 1 split axis; next identify axis by APid (and possibly stack id)
    // <g class="axis-use">
    let gAxis = d3.select("g.axis-use"),
    /** relative to the transform of parent g.ap */
    bbox = gAxis.node().getBBox(),
    yrange = [bbox.y, bbox.height];
    let t = tracks.intervalTree["1"],
    trackWidth = 10,
    oa = this.get('data'),
    apID = gAxis.node().parentElement.__data__,
    y = oa.y[apID],
    yDomain = [y.invert(yrange[0]), y.invert(yrange[1]*0.8)],
    pxSize = (yDomain[1] - yDomain[0]) / bbox.height,
    data = regionOfTree(t, yDomain, pxSize * 1/*5*/);
    console.log(data.length, (data.length == 0) || y(data[0][0]));
    /** datum is interval array : [start, end];   with attribute .description. */
    function xPosn(d) { /*console.log("xPosn", d);*/ return ((d.layer || 0) + 1) *  trackWidth * 2; };
    function yPosn(d) { /*console.log("yPosn", d);*/ return y(d[0]); };
    function height(d)  { return y(d[1]) - y(d[0]); };
    /** parent; contains a clipPath, g > rect, text.resizer.  */
    let gp =   gAxis
      .selectAll("g.tracks")
      .data([1])
      .enter()
      .append("g")  // .insert(, ":last-child")
      .attr('class', 'tracks');
    if (false) { // not completed.  Can base resized() on axis-2d.js
    let text = gp
      .append("text")
      .attr('class', 'resizer')
      .html("⇹")
      .attr("x", bbox.width-10);
    if (gp.size() > 0)
      eltWidthResizable("g.axis-use > g.tracks > text.resizer", resized);
  }
    gp // define the clipPath
      .append("clipPath")       // define a clip path
      .attr("id", "axis-clip") // give the clipPath an ID
      .append("rect")          // shape it as an ellipse
      .attr("x", bbox.x)
      .attr("y", bbox.y)
      .attr("width", bbox.width)
      .attr("height", bbox.height)
    ;
    let g = gp.append("g")
      .attr("clip-path", "url(#axis-clip)"); // clip the rectangle
    let
      rs = gAxis.select("g.tracks > g").selectAll("rect.track").data(data),
    re =  rs.enter(), rx = rs.exit();
    let ra = re
      .append("rect");
    ra
      .transition().duration(1500)
      .attr('width', trackWidth)
      .attr('class', 'track')
      .each(configureTrackHover);
    ra
      .merge(rs)
      .transition().duration(1500)
      .attr('x', xPosn)
      .attr('y', yPosn)
      .attr('height' , height)
    ;
    rx.remove();
    console.log(gAxis.node(), rs.nodes(), re.nodes());

  },

  pasteProcess: function(textPlain) {
    console.log("components/axis-tracks pasteProcess", textPlain.length);

    let
    parseIntervals = this.get('parseIntervals'),
    layoutAndDrawTracks = this.get('layoutAndDrawTracks');

    let tracks = parseIntervals(textPlain);
    this.set('tracks', tracks); // used by axisStackChanged() : layoutAndDrawTracks()
    let forTable = tracks.intervalTree[1].intervals.map(intervalToStartEnd);
    // intersect with axis zoom region;  layer the overlapping tracks; draw tracks.
    layoutAndDrawTracks.apply(this, [tracks]);

    function intervalToStartEnd(interval) {
      interval.start = interval[0];
      interval.end = interval[0];
      return interval;
    };
    this.set('data.tracks', forTable);
  },

  keypress: function(event) {
    console.log("components/axis-tracks keypress", event);
  },


});
