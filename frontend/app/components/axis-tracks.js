import Ember from 'ember';

import createIntervalTree from 'npm:interval-tree-1d';

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
 * @return intervals  array of intervals
*/
function regionOfTree(intervalTree, domain)
{
  let intervals = [];
  function visit(interval) {
    intervals.push(interval);
  }
  intervalTree.queryInterval(domain[0], domain[1], visit);
  return intervals;
}

/*----------------------------------------------------------------------------*/

/* global d3 */

export default Ember.Component.extend({

  feed: Ember.inject.service(),

  listen: function() {
    let f = this.get('feed');
    console.log("listen", f);
    if (f === undefined)
      console.log('feed service not injected');
    else {
      f.on('axisStackChanged', this, 'axisStackChanged');
    }
  }.on('init'),

  // remove the binding created in listen() above, upon component destruction
  cleanup: function() {
    let f = this.get('feed');
    f.off('axisStackChanged', this, 'axisStackChanged');
  }.on('willDestroyElement'),


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
    yDomain = [y.invert(yrange[0]), y.invert(yrange[1])],
    data = regionOfTree(t, yDomain);
    console.log(data.length, y(data[0][0]));
    /** datum is interval array : [start, end];   with attribute .description. */
    function yPosn(d) { /*console.log("yPosn", d);*/ return y(d[0]); };
    function height(d)  { return y(d[1]) - y(d[0]); };
    let gp =   gAxis
      .selectAll("g.tracks")
      .data([1])
      .enter()
      .append("g")
      .attr('class', 'tracks');
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
      .attr('x', trackWidth * 2)
      .attr('y', yPosn)
      .attr('height' , height)
    ;
    rx.remove();
    console.log(gAxis.node(), rs.nodes(), re.nodes());

  },

  paste: function(event) {
    console.log("components/axis-tracks paste", event);

    let cb = event.originalEvent.clipboardData;
    if (false)
    for (let i=0; i<cb.types.length; i++)
    {
      console.log(i, cb.types[i], cb.getData(cb.types[i]));
    };
    let i = cb.types.indexOf("text/plain"), textPlain = cb.getData(cb.types[i]),
    parseIntervals = this.get('parseIntervals'),
    layoutAndDrawTracks = this.get('layoutAndDrawTracks');
    let inputElt=Ember.$('.trackData');
    inputElt.empty();
    let tracks = parseIntervals(textPlain);
    this.set('tracks', tracks);
    // intersect with axis zoom region;  layer the overlapping tracks; draw tracks.
    layoutAndDrawTracks.apply(this, [tracks]);
  },
  keypress: function(event) {
    console.log("components/axis-tracks keypress", event);
  },


});
