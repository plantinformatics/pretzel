import Ember from 'ember';

import { eltWidthResizable, noShiftKeyfilter } from '../utils/domElements';
import InAxis from './in-axis';

const className = "chart", classNameSub = "chartRow";

/*----------------------------------------------------------------------------*/
function breakToDebugger(a, b)
{
  console.log(a, b);
  debugger;
}
/*----------------------------------------------------------------------------*/
/* Copied from draw-map.js */
    /**
     * @return true if a is in the closed interval range[]
     * @param a value
     * @param range array of 2 values - limits of range.
     */
    function inRange(a, range)
    {
      return range[0] <= a && a <= range[1];
    }

function markerLocation(oa, apID, d)
{
  let marker = oa.z[apID][d];
  if (marker === undefined)
  {
    console.log("axis-chart markerY_", apID, oa.z[apID], "does not contain marker", d);
    return undefined;
  }
  else
    return marker.location;
}
  

/* variant of copy from draw-map.js - to merge when that is split out. */
/** Calculate relative marker location in the AP.
 * Result Y is relative to the stack, not the AP,
 * because .foreground does not have the AP transform (APs which are ends
 * of path will have different Y translations).
 *
 * @param oa  object attributes from draw-map : for the marker data z, and scales y and ys ;  later just those values, indexed by apID, will be passed to axis-chart
 * @param apID name of AP  (exists in apIDs[])
 * @param d marker name
 * @param stackRelative true means add the offset for the stacked position of the axis
 */
function markerY_(oa, apID, d, stackRelative)
{
  // z[p][m].location, actual position of marker m in the AP p, 
  // y[p](z[p][m].location) is the relative marker position in the svg
  // if stackRelative, ys is used - the y scale for the stacked position&portion of the AP.
  let yScales = stackRelative ? oa.ys : oa.y,
  ysa = yScales[apID],
  location = markerLocation(oa, apID, d);
  if (location === undefined)
    return location;
  else
  {
    let
  aky = ysa(location),
  apY = stackRelative ? oa.aps[apID].yOffset() : 0;
  // if (! tracedApScale[apID])
  {
    // tracedApScale[apID] = true;
    /* let yDomain = ysa.domain();
     console.log("markerY_", apID, d, z[apID][d].location, aky, apY, yDomain, ysa.range()); */
  }
  return aky + apY;
  }
}

/*
 * A line between a marker's location in APs in adjacent Stacks.
 * @param ak1, ak2 AP names, (exist in apIDs[])
 * @param d1, d2 marker names, i.e. ak1:d1, ak1:d1
 * If d1 != d2, they are connected by an alias.
 */
function markerLineS2(oa, ak1, ak2, d1, d2)
{
  let o = oa.o;
  // o[p], the map location,
  return d3.line([[o[ak1], markerY_(oa, ak1, d1, false)],]);
}
/*----------------------------------------------------------------------------*/


/* global d3 */

export default InAxis.extend({


  didRender() {
    console.log("components/axis-chart didRender()");
  },

  redraw   : function(apID, t) {
    let data = this.get(className),
    layoutAndDrawChart = this.get('layoutAndDrawChart');
    console.log("redraw", this, (data === undefined) || data.length, apID, t);
    if (data)
      layoutAndDrawChart.apply(this, [data]);
  },

  /** Convert input text to an array.
   * @param tableText text string, TSV, rows separated by \n and/or \r.
   * First row may contain a header with column names, indicated by leading #.
   * Column names "name",  "value" and "description" indicate the columns containing those values,
   * otherwise the default columns are 0, 1, 2 respectively.
   * Other columns are appended to the description value of the row.
   */
  parseTextData(tableText)
  {
    /* can replace most of this function with d3.tsv;
     * It currently implements the feature that header is optional;   to replicate that can use
     * dsv.parse() when header is input and dsv.parseRows() otherwise.
    */
    let apName = "1", values = [];
    let rows = tableText.split(/[\n\r]+/);
    let colIdx = {name : 0, value : 1, description : 2};
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
        colIdx["name"] = col.indexOf("name");
        colIdx["value"] = col.indexOf("value");
        colIdx["description"] = col.indexOf("description");
      }
      else
      {
      let
        rowValue = {
          name : col[colIdx["name"]],
          value : col[colIdx["value"]]
        },
      description = col[colIdx["description"]];
    for (let ic=0; ic<col.length; ic++)
    {
      if ((ic != colIdx["name"]) && (ic !=colIdx["value"]) && (ic != colIdx["description"]))
      {
        description += "_" + col[ic];
      }
    }
        rowValue.description = description;

      values.push(rowValue);
      }
    }

    console.log("parseTextData values.length", values.length);
    let result  = values;
    return result;
  },

  layoutAndDrawChart(chart)
  {
    console.log("layoutAndDrawChart", chart);
    // initial version supports only 1 split axis; next identify axis by APid (and possibly stack id)
    // <g class="axis-use">
    let gAxis = d3.select("g.axis-use"),
    /** relative to the transform of parent g.ap */
    bbox = gAxis.node().getBBox(),
    yrange = [bbox.y, bbox.height];
    if (bbox.x < 0)
    {
      console.log("x < 0", bbox);
      bbox.x = 0;
    }
    let
    barWidth = 10,
    valueName = chart.valueName || "Values",
    oa = this.get('data'),
    apID = gAxis.node().parentElement.__data__,
    yAxis = oa.y[apID], // this.get('y')
    yDomain = [yAxis.invert(yrange[0]), yAxis.invert(yrange[1])],
    pxSize = (yDomain[1] - yDomain[0]) / bbox.height,
    withinZoomRegion = function(d) {
      return inRange(datum2Location(d), yDomain);
    },
    data = chart.filter(withinZoomRegion);
    let resizedWidth = this.get('width');
    console.log(resizedWidth, bbox, yDomain, pxSize, data.length, (data.length == 0) || datum2Location(data[0]));
    if (resizedWidth)
      bbox.width = resizedWidth;
  
  /** @param name is a marker or gene name */
    function name2Location(name)
    {
        /** @param ak1 AP name, (exists in apIDs[])
         * @param d1 marker name, i.e. ak1:d1
         */
      let ak1 = apID,  d1 = name;
      return markerLocation(oa, ak1, d1);
    }
    function datum2Location(d) { return name2Location(d.name); }
    function datum2Value(d) { return d.value; }
    /*  axis
     * x  .value
     * y  .name Location
     */
    /** 1-dimensional chart, within an axis. */
    function Chart1(parentG, options)
    {
      this.parentG = parentG;
      this.options = options;
    }
    Chart1.prototype.draw =  function ()
    {
      // based on https://bl.ocks.org/mbostock/3885304,  axes x & y swapped.
      let
        options = this.options,
      parentG = this.parentG,
        margin = {top: 10, right: 20, bottom: 40, left: 20},
      // pp=parentG.node().parentElement,
      parentW = options.bbox.width, // +pp.attr("width")
      parentH = options.bbox.height, // +pp.attr("height")
      width = parentW - margin.left - margin.right,
      height = parentH - margin.top - margin.bottom;
      let
        xRange = [0, width],
      yRange = [height, 0],
      y = d3.scaleBand().rangeRound(yRange).padding(0.1),
      x = d3.scaleLinear().rangeRound(xRange);
      this.y = y;
      console.log("Chart1", parentW, parentH, xRange, yRange);

      /* these can be renamed datum2{abscissa,ordinate}{,Scaled}() */
      /* apply y after scale applied by datum2Location */
      function datum2LocationScaled(d) { return y(options.datum2Location(d)); }
      function datum2ValueScaled(d) { return x(options.datum2Value(d)); }
      this. datum2LocationScaled = datum2LocationScaled;
      this. datum2ValueScaled = datum2ValueScaled;

      let gs = parentG
        .selectAll("g > g")
        .data([1]),
      gsa = gs
        .enter()
        .append("g")  // maybe drop this g, move margin calc to gp
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")"),
      g = gsa.merge(gs);
      this.g = g;

      /**  first draft will show all data;  next :
       * + select region from y domain
       * place data in tree for fast subset by region
       * -	alternate view : line
       * + transition between views, zoom, stack
       */
      y.domain(data.map(options.datum2Location));
      x.domain([0, d3.max(data, options.datum2Value)]);

      let axisXa =
      gsa.append("g")
      // -  handle .exit() for these 2 also
        .attr("class", "axis axis--x");
      axisXa.merge(gs.selectAll("g > g.axis--x"))
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

      let axisYa =
      gsa.append("g")
        .attr("class", "axis axis--y");
      axisYa.merge(gs.selectAll("g > g.axis--y"))
        .call(d3.axisLeft(y)) // .tickFormat(".2f") ?
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "0.71em")
        .attr("text-anchor", "end")
        .text(valueName);

      this.bars(parentG, options);
    };
    Chart1.prototype.bars = function ()
    {
      let
        options = this.options,
      g = this.g;
      let
        rs = g
      // .select("g." + className + " > g")
        .selectAll("rect." + options.barClassName)
        .data(data),
      re =  rs.enter(), rx = rs.exit();
      let ra = re
      /*g.selectAll("." + options.barClassName)
       .data(data)
       .enter()       */
        .append("rect");
      ra
        .attr("class", options.barClassName)
      /*.each(configureChartHover)*/;
      ra
        .merge(rs)
        .transition().duration(1500)
        .attr("x", 0)
        .attr("y", this.datum2LocationScaled)
        .attr("height", this.y.bandwidth())
        .attr("width", this.datum2ValueScaled);
      rx.remove();
      console.log(gAxis.node(), rs.nodes(), re.nodes());
    };

    /** datum is value in hash : {value : , description: } and with optional attribute description. */

    /** parent; contains a clipPath, g > rect, text.resizer.  */
    let gps =   gAxis
      .selectAll("g." + className)
      .data([1]),
    gp = gps
      .enter()
      .insert("g", ":last-child")
      .attr('class', className);
    if (false) { // not completed.  Can base resized() on axis-2d.js
    let text = gp
      .append("text")
      .attr('class', 'resizer')
      .html("⇹")
      .attr("x", bbox.width-10);
    if (gp.size() > 0)
      eltWidthResizable("g.axis-use > g." + className + " > text.resizer", resized);
  }
    let gpa =
    gp // define the clipPath
      .append("clipPath")       // define a clip path
      .attr("id", "axis-clip") // give the clipPath an ID
      .append("rect"),          // shape it as an ellipse
    gprm = 
    gpa.merge(gps.selectAll("g > clipPath > rect"))
      .attr("x", bbox.x)
      .attr("y", bbox.y)
      .attr("width", bbox.width)
      .attr("height", bbox.height)
    ;
    gp.append("g")
      .attr("clip-path", "url(#axis-clip)"); // clip the rectangle
    let g = 
      gps.merge(gp).selectAll("g." + className+  " > g");

    let b = new Chart1(g,
             {
               bbox : bbox,
               barClassName : classNameSub,
               datum2Location : datum2Location,
               datum2Value : datum2Value
             });
    b.draw();

  },

  pasteProcess: function(textPlain) {
    console.log("components/axis-chart pasteProcess", textPlain.length);

    let
    parseTextData = this.get('parseTextData'),
    layoutAndDrawChart = this.get('layoutAndDrawChart');

    let chart = parseTextData(textPlain);
    this.set(className, chart); // used by axisStackChanged() : layoutAndDrawChart()
    let forTable = chart;
    chart.valueName = "values"; // add user config
    // ; draw chart.
    layoutAndDrawChart.apply(this, [chart]);

    this.set('data.chart', forTable);
  },


});
