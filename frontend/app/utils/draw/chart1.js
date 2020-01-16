import Ember from 'ember';

import { getAttrOrCP } from '../ember-devel';
import { configureHorizTickHover } from '../hover';
import { eltWidthResizable, noShiftKeyfilter } from '../domElements';
import { noDomain } from '../draw/axis';
import { stacks } from '../stacks'; // just for oa.z and .y, don't commit this.
import { inRangeEither } from './zoomPanCalcs';


const className = "chart", classNameSub = "chartRow";

/* global d3 */

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/
/* Copied from draw-map.js */


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

/** If the given value is an interval, convert it to a single value by calculating the middle of the interval.
 * @param location is a single value or an array [from, to]
 * @return the middle of an interval
 */
function middle(location) {
  let result = location.length ?
    location.reduce((sum, val) => sum + val, 0) / location.length
    : location;
  return result;
}
  
/** @return a function to map a chart datum to a y value or interval.
 */
function scaleMaybeInterval(datum2Location, yScale) {
  /* In both uses in this file, the result is passed to middle(), so an argument
   * could be added to scaleMaybeInterval() to indicate the result should be a
   * single value (using mid-point if datum location is an interval).
   */

  function datum2LocationScaled(d) {
    /** location may be an interval [from, to] or a single value. */
    let l = datum2Location(d);
    return l.length ? l.map((li) => yScale(li)) : yScale(l); };
  return datum2LocationScaled;
}

/*----------------------------------------------------------------------------*/
/* based on axis-1d.js: hoverTextFn() and setupHover() */

/** eg: "ChrA_283:A:283" */
function hoverTextFn (feature, block) {
  let
    value = getAttrOrCP(feature, 'value'),
  /** undefined values are filtered out below. */
  valueText = value && (value.length ? ('' + value[0] + ' - ' + value[1]) : value),

  /** block.view is the Stacks Block. */
  blockName = block.view && block.view.longName(),
  featureName = getAttrOrCP(feature, 'name'),
  /** common with dataConfig.datum2Description  */
  description = value && JSON.stringify(value),

  text = [featureName, valueText, description, blockName]
    .filter(function (x) { return x; })
    .join(" : ");
  return text;
};


/** Add a .hasChart class to the <g.axis-use> which contains this chart.
 * Currently this is used to hide the <foreignObject> so that hover events are
 * accessible on the chart bars, because the <foreignObject> is above the chart.
 * Later can use e.g. axis-accordion to separate these horizontally;
 * for axis-chart the foreignObject is not used.
 *
 * @param g parent of the chart. this is the <g> with clip-path axis-clip.
 */
function addParentClass(g) {
  let axisUse=g.node().parentElement.parentElement,
  us=d3.select(axisUse);
  us.classed('hasChart', true);
  console.log(us.node());
};
/*----------------------------------------------------------------------------*/

let oa = stacks.oa,
  axisID0;

  /** @param name is a feature or gene name */
    function name2Location(name)
    {
        /** @param ak1 axis name, (exists in axisIDs[])
         * @param d1 feature name, i.e. ak1:d1
         */
      let ak1 = axisID0,  d1 = name;
      return featureLocation(oa, ak1, d1);
    }

    /** Used for both blockData and parsedData. */
    function datum2Location(d) { return name2Location(d.name); }
    function datum2Value(d) { return d.value; }
    let parsedData = {
      dataTypeName : 'parsedData',
      datum2Location,
      datum2Value : datum2Value,
      datum2Description : function(d) { return d.description; }
    },
    blockData = {
      dataTypeName : 'blockData',
      datum2Location,
      /** The effects data is placed in .value[2] (the interval is in value[0..1]).
       * Use the first effects value by default, but later will combine other values.
       */
      datum2Value : function(d) { let v = d.value[2]; if (v.length) v = v[0]; return v; },
      datum2Description : function(d) { return JSON.stringify(d.value); }
    };


/*----------------------------------------------------------------------------*/

function layoutAndDrawChart(axisChart, chart, dataConfig)
  {
    console.log("layoutAndDrawChart", chart, dataConfig && dataConfig.dataTypeName);
    // initial version supports only 1 split axis; next identify axis by axisID (and possibly stack id)
    // <g class="axis-use">
    // g.axis-outer#id<axisID>
    let
      axisComponent = axisChart.get("axis"),
    axisID = axisComponent.axisID,
    gAxis = d3.select("g.axis-outer#id" + axisID + "> g.axis-use");
    if (! gAxis.node()) { /* probably because axisShowExtend() has not added the g.axis-use yet - will sort out the dependencies ... . */
      dLog('layoutAndDrawChart', d3.select("g.axis-outer#id" + axisID).node(), 'no g.axis-use', this, axisComponent, axisID);
      return;
    }
    let
    /** relative to the transform of parent g.axis-outer */
    bbox = gAxis.node().getBBox(),
    yrange = [bbox.y, bbox.height];
    axisID0 = axisID;
    if (bbox.x < 0)
    {
      console.log("x < 0", bbox);
      bbox.x = 0;
    }
    let
    barWidth = 10,
    /** isBlockData is not used if dataConfig is defined.  this can be moved out to the caller. */
    isBlockData = chart.length && (chart[0].description === undefined),
    valueName = chart.valueName || "Values",
    oa = axisChart.get('data'),
    // axisID = gAxis.node().parentElement.__data__,
    yAxis = oa.y[axisID], // this.get('y')
    yAxisDomain = yAxis.domain(), yDomain;
    if (noDomain(yAxisDomain) && chart.length) {
      yAxisDomain = [chart[0]._id.min, chart[chart.length-1]._id.max];
      yAxis.domain(yAxisDomain);
      yDomain = yAxisDomain;
    }
    else
      yDomain = [yAxis.invert(yrange[0]), yAxis.invert(yrange[1])];

    if (! dataConfig) {
      dataConfig = isBlockData ? blockData : parsedData;
      if (! dataConfig.hoverTextFn)
        dataConfig.hoverTextFn = hoverTextFn;
      if (dataConfig.valueIsArea === undefined)
        dataConfig.valueIsArea = false;
    }

    let
    pxSize = (yDomain[1] - yDomain[0]) / bbox.height,
    withinZoomRegion = function(d) {
      return inRangeEither(dataConfig.datum2Location(d), yDomain);
    },
    data = chart.filter(withinZoomRegion);
    let resizedWidth = axisChart.get('width');
    console.log(resizedWidth, bbox, yDomain, pxSize, data.length, (data.length == 0) || dataConfig.datum2Location(data[0]));
    if (resizedWidth)
      bbox.width = resizedWidth;
  
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
    Chart1.prototype.draw =  function (data)
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
      /** The chart is perpendicular to the usual presentation.
       * The names x & y (in {x,y}Range and yLine) match the orientation on the
       * screen, rather than the role of abscissa / ordinate; the data maps
       * .name (location) -> .value, which is named y -> x.
       */
      let
        xRange = [0, width],
      yRange = [0, height],
      // yRange is used as range of yLine by this.scaleLinear().
      /* scaleBand would suit a data set with evenly spaced or ordinal / nominal y values.
       * yBand = d3.scaleBand().rangeRound(yRange).padding(0.1),
       */
      y = this.scaleLinear(yRange, data),
      x = d3.scaleLinear().rangeRound(xRange);
      // datum2LocationScaled() uses me.x rather than the value in the closure in which it was created.
      this.x = x;
      // Used by bars() - could be moved there, along with  datum2LocationScaled().
      this.y = y;
      console.log("Chart1", parentW, parentH, xRange, yRange, options.dataTypeName);

      let me = this;
      /* these can be renamed datum2{abscissa,ordinate}{,Scaled}() */
      /* apply y after scale applied by datum2Location */
      let datum2LocationScaled = scaleMaybeInterval(options.datum2Location, me.y);
      /** related @see rectWidth().  */
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
      // scaleBand() domain is a list of all y values.
      // yBand.domain(data.map(options.datum2Location));
      x.domain([0, d3.max(data, this.rectWidth.bind(this, /*scaled*/false, /*gIsData*/false))]);

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

      data = data.sort((a,b) => middle(this.options.datum2Location(a)) - middle(this.options.datum2Location(b)));
      this.drawContent(data);
      this.currentData = data;
    };
    Chart1.prototype.bars = function (data)
    {
      let
        options = this.options,
      block = this.block,
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
        /** parent datum is currently 1, but could be this.block;
         * this.parentElement.parentElement.__data__ has the axis id (not the blockId),
         */
        .each(function (d) { configureHorizTickHover.apply(this, [d, block, options.hoverTextFn]); });
      ra
        .merge(rs)
        .transition().duration(1500)
        .attr("x", 0)
        .attr("y", (d) => { let li = this.datum2LocationScaled(d); return li.length ? li[0] : li; })
        // yBand.bandwidth()
        .attr("height", this.rectHeight.bind(this, /*gIsData*/false)) // equiv : (d, i, g) => this.rectHeight(false, d, i, g)
        .attr("width", this.rectWidth.bind(this, /*scaled*/true, /*gIsData*/false));
      rx.remove();
      console.log(gAxis.node(), rs.nodes(), re.nodes());
    };
    /** Calculate the height of rectangle to be used for this data point
     * @param this  is Chart1, not DOM element.
     * @param scaled  true means apply scale (x) to the result
     * @param gIsData true meangs g is __data__, otherwise it is DOM element, and has .__data__ attribute.
     * gIsData will be true when called from d3.max(), and false for d3 attr functions.
     */
  Chart1.prototype.rectWidth = function (scaled, gIsData, d, i, g)
    {
      Ember.assert('rectWidth arguments.length === 5', arguments.length === 5);
      /** The scale is linear, so it is OK to scale before dividing by rectHeight.
       * Otherwise could use datum2Value() here and apply this.x() before the return.
       */
      let d2v = (scaled ? this.datum2ValueScaled : this.options.datum2Value),
      width = d2v(d);
      if (this.options.valueIsArea) {
        let h;
        width /= (h = this.rectHeight(gIsData, d, i, g));
        // dLog('rectWidth', h, width, gIsData);
      }
      return width;
    };
    /** Calculate the height of rectangle to be used for this data point
     * @param this  is Chart1, not DOM element.
     * @param gIsData true meangs g is __data__, otherwise it is DOM element, and has .__data__ attribute.
     * gIsData will be true when called from d3.max(), and false for d3 attr functions.
     */
  Chart1.prototype.rectHeight = function (gIsData, d, i, g)
    {
      Ember.assert('rectHeight arguments.length === 4', arguments.length === 4);
      let height, locationScaled;
      /* if locationScaled is an interval, calculate height from it.
       * Otherwise, use adjacent points to indicate height.
       */
      if ((locationScaled = this.datum2LocationScaled(d)).length) {
        height = Math.abs(locationScaled[1] - locationScaled[0]);
      }
      else {
        /* the boundary between 2 adjacent points is midway between them.
         * So sum that half-distance for the previous and next points.
         * the y range distance from the previous point to the next point.
         * If this point is either end, simply double the other half-distance.
         */
        if (! g.length)
          height = this.yLine.range() / 10;
        else {
          let r = [];
          function gData(i) { let gi = g[i]; return gIsData ? gi : gi.__data__; };
          if (i > 0)
            r.push(gData(i));
          r.push(d);
          if (i < g.length-1)
            r.push(gData(i+1));
          let y =
            r.map(this.datum2LocationScaled);
          height = Math.abs(y[y.length-1] - y[0]) * 2 / (y.length-1);
          dLog('rectHeight', gIsData, d, i, /*g,*/ r, y, height);
          if (! height)
            height = 1;
        }
      }
      return height;
    };
    Chart1.prototype.scaleLinear = function (yRange, data)
    {
      // based on https://bl.ocks.org/mbostock/3883245
      if (! this.yLine)
        this.yLine = d3.scaleLinear();
      let y = this.yLine;
      y.rangeRound(yRange);
      let
        /** location may be an interval, so flatten the result.
         * Later Array.flat() can be used.
         */
        yFlat = data
        .map(this.options.datum2Location)
        .reduce((acc, val) => acc.concat(val), []);
      y.domain(d3.extent(yFlat));
      console.log('scaleLinear domain', y.domain(), yFlat);
      return y;
    };
    Chart1.prototype.line = function (data)
    {
      let y = this.yLine, options = this.options;

      let datum2LocationScaled = scaleMaybeInterval(options.datum2Location, y);
      let line = d3.line()
        .x(this.rectWidth.bind(this, /*scaled*/true, /*gIsData*/false))
        .y((d) => middle(datum2LocationScaled(d)));

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
        .datum(data)
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
      this.drawContent(this.currentData);
    };
    Chart1.prototype.drawContent = function(data)
    {
      let chartDraw = this.barsLine ? this.bars : this.line;
      chartDraw.apply(this, [data]);
    };

    /** datum is value in hash : {value : , description: } and with optional attribute description. */

    /** parent; contains a clipPath, g > rect, text.resizer.  */
    let gps =   gAxis
      .selectAll("g." + className)
      .data([axisID]),
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
    /** datum is axisID, so id and clip-path could be functions. */
    let axisClipId = "axis-clip-" + axisID;
    let gpa =
    gp // define the clipPath
      .append("clipPath")       // define a clip path
      .attr("id", axisClipId) // give the clipPath an ID
      .append("rect"),          // shape it as a rect
    gprm = 
    gpa.merge(gps.selectAll("g > clipPath > rect"))
      .attr("x", bbox.x)
      .attr("y", bbox.y)
      .attr("width", bbox.width)
      .attr("height", bbox.height)
    ;
    gp.append("g")
      .attr("clip-path", "url(#" + axisClipId + ")"); // clip with the rectangle

    let g = 
      gps.merge(gp).selectAll("g." + className+  " > g");

    /* It is possible to recreate Chart1 for each call, but that leads to
     * complexity in ensuring that the instance rendered by toggleBarsLineClosure() is
     * the same one whose options.bbox.width is updated from axis-chart.width.
    */
    let chart1 = axisChart.get("chart1");
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
               dataTypeName : dataConfig.dataTypeName,
               datum2Location : dataConfig.datum2Location,
               datum2Value : dataConfig.datum2Value,
               datum2Description : dataConfig.datum2Description,
               hoverTextFn : dataConfig.hoverTextFn,
               valueIsArea : dataConfig.valueIsArea
             });
      chart1.block = axisChart.get('block');
      axisChart.set("chart1", chart1);
      addParentClass(g);
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
      .attr("cy", bbox.height - 10)
      .classed("pushed", b.barsLine);
    b.chartTypeToggle = chartTypeToggle;

    b.draw(data);
  }
;

/*----------------------------------------------------------------------------*/

/* subsequent step will move layoutAndDrawChart into class Chart1, and export that instead. */
export { className, layoutAndDrawChart /*Chart1*/ };
