import Ember from 'ember';

import { eltWidthResizable, noShiftKeyfilter } from '../utils/domElements';
import InAxis from './in-axis';

const className = "chart", classNameSub = "chartRow";


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

function featureLocation(oa, axisID, d)
{
  let feature = oa.z[axisID][d];
  if (feature === undefined)
  {
    console.log("axis-chart featureY_", axisID, oa.z[axisID], "does not contain feature", d);
    return undefined;
  }
  else
    return feature.location;
}
  

/*----------------------------------------------------------------------------*/


/* global d3 */

export default InAxis.extend({

  className : className,

  didRender() {
    console.log("components/axis-chart didRender()");
  },

  redraw   : function(axisID, t) {
    let data = this.get(className),
    layoutAndDrawChart = this.get('layoutAndDrawChart');
    console.log("redraw", this, (data === undefined) || data.length, axisID, t);
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
    let values = [];
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
    // initial version supports only 1 split axis; next identify axis by axisID (and possibly stack id)
    // <g class="axis-use">
    // g.axis-outer#id<axisID>
    let
      axisComponent = this.get("axis"),
    axisID = axisComponent.axisID,
    gAxis = d3.select("g.axis-outer#id" + axisID + "> g.axis-use"),
    /** relative to the transform of parent g.axis-outer */
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
    // axisID = gAxis.node().parentElement.__data__,
    yAxis = oa.y[axisID], // this.get('y')
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
  
  /** @param name is a feature or gene name */
    function name2Location(name)
    {
        /** @param ak1 axis name, (exists in axisIDs[])
         * @param d1 feature name, i.e. ak1:d1
         */
      let ak1 = axisID,  d1 = name;
      return featureLocation(oa, ak1, d1);
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
    Chart1.prototype.barsLine =  true;
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
      // datum2LocationScaled() uses me.x rather than the value in the closure in which it was created.
      this.x = x;
      // Used by bars() - could be moved there, along with  datum2LocationScaled().
      this.y = y;
      // line() does not use y;  it creates yLine and uses yRange, to set its range.
      this.yRange = yRange;
      console.log("Chart1", parentW, parentH, xRange, yRange);

      let me = this;
      /* these can be renamed datum2{abscissa,ordinate}{,Scaled}() */
      /* apply y after scale applied by datum2Location */
      function datum2LocationScaled(d) { return me.y(options.datum2Location(d)); }
      function datum2ValueScaled(d) { return me.x(options.datum2Value(d)); }
      this.datum2LocationScaled = datum2LocationScaled;
      this.datum2ValueScaled = datum2ValueScaled;

      let gs = parentG
        .selectAll("g > g")
        .data([1]),
      gsa = gs
        .enter()
        .append("g")  // maybe drop this g, move margin calc to gp
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")"),
      g = gsa.merge(gs);
      this.g = g;

      /**  first draft showed all data;  subsequently adding :
       * + select region from y domain
       * -	place data in tree for fast subset by region
       * +	alternate view : line
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

      this.drawContent();
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
    Chart1.prototype.line = function ()
    {
      // based on https://bl.ocks.org/mbostock/3883245
      if (! this.yLine)
        this.yLine = d3.scaleLinear()
        .rangeRound(this.yRange);
      let y = this.yLine, options = this.options;

      function datum2LocationScaled(d) { return y(options.datum2Location(d)); }

      let line = d3.line()
        .x(this.datum2ValueScaled)
        .y(datum2LocationScaled);

      y.domain(d3.extent(data, this.options.datum2Location));
      console.log("line x domain", this.x.domain(), this.x.range());

      let
        g = this.g,
      ps = g
        .selectAll("g > path." + options.barClassName)
        .data([1]);
      ps
        .enter()
        .append("path")
        .attr("class", options.barClassName + " line")
        .datum([data[0], data[data.length-1]])
        .attr("d", line)
        .merge(ps)
        .datum(data)
        .transition().duration(1500)
        .attr("d", line);
      // data length is constant 1, so .remove() is not needed
      ps.exit().remove();
    };
    /** Alternate between bar chart and line chart */
    Chart1.prototype.toggleBarsLine = function ()
    {
      console.log("toggleBarsLine", this);
      d3.event.stopPropagation();
      this.barsLine = ! this.barsLine;
      this.chartTypeToggle
        .classed("pushed", this.barsLine);
      this.g.selectAll("g > *").remove();
      this.drawContent();
    };
    Chart1.prototype.drawContent = function()
    {
      let chartDraw = this.barsLine ? this.bars : this.line;
      chartDraw.apply(this, []);
    };

    /** datum is value in hash : {value : , description: } and with optional attribute description. */

    /** parent; contains a clipPath, g > rect, text.resizer.  */
    let gps =   gAxis
      .selectAll("g." + className)
      .data([1]),
    gp = gps
      .enter()
      .insert("g", ":first-child")
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
      .append("rect"),          // shape it as a rect
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

    /* It is possible to recreate Chart1 for each call, but that leads to
     * complexity in ensuring that the instance rendered by toggleBarsLineClosure() is
     * the same one whose options.bbox.width is updated from axis-chart.width.
    */
    let chart1 = this.get("chart1");
    if (chart1)
    {
      chart1.options.bbox.width = bbox.width;
    }
    else
    {
      chart1 = new Chart1(g,
             {
               bbox : bbox,
               barClassName : classNameSub,
               datum2Location : datum2Location,
               datum2Value : datum2Value
             });
      this.set("chart1", chart1);
    }
    let b = chart1; // b for barChart

    function toggleBarsLineClosure(e)
    {
      b.toggleBarsLine();
    }

    /** currently placed at g.chart, could be inside g.chart>g (clip-path=). */
    let chartTypeToggle = gp
      .append("circle")
      .attr("class", "radio toggle chartType")
      .attr("r", 6)
      .on("click", toggleBarsLineClosure);
    chartTypeToggle.merge(gps.selectAll("g > circle"))
      .attr("cx", bbox.x + bbox.width / 2)   /* was o[p], but g.axis-outer translation does x offset of stack.  */
      .attr("cy", bbox.height * 0.96)
      .classed("pushed", b.barsLine);
    b.chartTypeToggle = chartTypeToggle;

    b.draw();
  },

  pasteProcess: function(textPlain) {
    console.log("components/axis-chart pasteProcess", textPlain.length);

    let
    parseTextData = this.get('parseTextData'),
    layoutAndDrawChart = this.get('layoutAndDrawChart');

    let chart = parseTextData(textPlain);
    this.set(className, chart); // used by axisStackChanged() : redraw() : layoutAndDrawChart()
    let forTable = chart;
    chart.valueName = "values"; // add user config
    // ; draw chart.
    layoutAndDrawChart.apply(this, [chart]);

    this.set('data.chart', forTable);
  },


});
