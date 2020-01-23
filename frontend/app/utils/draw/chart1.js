import Ember from 'ember';

import { getAttrOrCP } from '../ember-devel';
import { configureHorizTickHover } from '../hover';
import { eltWidthResizable, noShiftKeyfilter } from '../domElements';
import { noDomain } from '../draw/axis';
import { stacks } from '../stacks'; // just for oa.z and .y, don't commit this.
import { inRangeEither } from './zoomPanCalcs';


const className = "chart", classNameSub = "chartRow";
/** Enables per-chart axes; X axes will be often useful; Y axis might be used if
 * zooming into different regions of an axis.  */
const showChartAxes = true;

/* global d3 */

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/
/* Copied from draw-map.js */

let blockFeatures = stacks.oa.z;

function featureLocation(blockId, d)
{
  let feature = blockFeatures[blockId][d];
  if (feature === undefined)
  {
    console.log("axis-chart featureY_", blockId, blockFeatures[blockId], "does not contain feature", d);
  }
  let location = feature && feature.location;
  return location;
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

class DataConfig {
  /*
   dataTypeName;
   datum2Location;
   datum2Value;
   datum2Description;
   */
  constructor (properties) {
    if (properties)
      Object.assign(this, properties);
  }
};


/** @param name is a feature or gene name */
function name2Location(name, blockId)
{
  /** @param ak1 axis name, (exists in axisIDs[])
   * @param d1 feature name, i.e. ak1:d1
   */
  return featureLocation(blockId, name);
}

/** Used for both blockData and parsedData. */
function datum2LocationWithBlock(d, blockId) { return name2Location(d.name, blockId); }
function datum2Value(d) { return d.value; }
let parsedData = {
  dataTypeName : 'parsedData',
  // datum2LocationWithBlock assigned later,
  datum2Value : datum2Value,
  datum2Description : function(d) { return d.description; }
},
blockData = {
  dataTypeName : 'blockData',
  // datum2LocationWithBlock assigned later,
  /** The effects data is placed in .value[2] (the interval is in value[0..1]).
   * Use the first effects value by default, but later will combine other values.
   */
  datum2Value : function(d) { let v = d.value[2]; if (v.length) v = v[0]; return v; },
  datum2Description : function(d) { return JSON.stringify(d.value); }
};


/*----------------------------------------------------------------------------*/

class AxisCharts {
  /*
   dataConfig;  // DataConfig (options)
   ranges;  // .bbox, .height
   dom;  // .gs, .gsa, 
   */

  constructor(axisID, dataConfig) {
    this.axisID = axisID;
    this.dataConfig = dataConfig;
    this.ranges = { };
    this.dom = { };
    // this will move to Chart1.
    this.scales = { /* x, y, yLine */ };
  }
};

/**
 * @param yAxisScale 
 */
function layoutAndDrawChart(axisID, axisCharts, chart1, chartData, block, dataConfig, yAxisScale, resizedWidth)
{

  axisCharts.selectParentContainer(axisID);
  axisCharts.getBBox();
  axisCharts.scales.yAxis = yAxisScale;

  if (! chart1)
    chart1 = new Chart1(axisCharts.dom.g, dataConfig);

  // Plan is for Axischarts to own .ranges and Chart1 to own .scales, but for now there is some overlap.
  if (chart1 && ! chart1.ranges) {
    chart1.ranges = axisCharts.ranges;
    chart1.scales = axisCharts.scales;
  }

  /* dataConfig may be set up (for featuresCounts) by countsChart(),
   * or (for blockData and parsedData) by .getRanges().
   * In coming commits the latter will be factored out so that DataConfig it is
   * uniformly passed in to Chart1().  This copying of .dataConfig is just provisional.
   */
  if (! dataConfig && ! axisCharts.dataConfig && chart1 && chart1.dataConfig)
    axisCharts.dataConfig = chart1.dataConfig;
  axisCharts.getRanges(chartData, block.get('id'), resizedWidth);
  if (! dataConfig && chart1 && ! chart1.dataConfig && axisCharts.dataConfig)
    chart1.dataConfig = axisCharts.dataConfig;
  axisCharts.getRanges3(chartData, resizedWidth);

  // axisCharts.size(this.get('yAxisScale'), /*axisID, gAxis,*/   chartData, resizedWidth);  //  -	split size/width and data/draw

  axisCharts.commonFrame(/*axisID, gAxis*/);

  addParentClass(axisCharts.dom.gc);

  if (dataConfig)
    axisCharts.configure(dataConfig);
  axisCharts.controls(chart1);

  // following are from b.draw(data)
  axisCharts.getRanges2();

  chart1.prepareScales(chartData, axisCharts.ranges.drawSize);

  chart1.g =
    axisCharts.group(axisCharts.dom.gc, 'axis-chart');
  if (showChartAxes)
    axisCharts.drawAxes(chartData);
  chart1.block = block;  // used in Chart1:bars() for hover text.
  chart1.data(chartData);



  return chart1;
};

AxisCharts.prototype.selectParentContainer = function (axisID)
{
  this.axisID = axisID;
  // to support multiple split axes,  identify axis by axisID (and possibly stack id)
  // <g class="axis-use">
  // g.axis-outer#id<axisID>
  let gAxis = d3.select("g.axis-outer#id" + axisID + "> g.axis-use");
  if (! gAxis.node()) { /* probably because axisShowExtend() has not added the g.axis-use yet - will sort out the dependencies ... . */
    dLog('layoutAndDrawChart', d3.select("g.axis-outer#id" + axisID).node(), 'no g.axis-use', this, axisID);
  }
  this.dom.gAxis = gAxis;
  return gAxis;
};
AxisCharts.prototype.getBBox = function ()
{
  let axisID = this.axisID,
  gAxis = this.dom.gAxis;
  let
    /** relative to the transform of parent g.axis-outer */
    bbox = gAxis.node().getBBox(),
  yrange = [bbox.y, bbox.height];
  if (bbox.x < 0)
  {
    console.log("x < 0", bbox);
    bbox.x = 0;
  }
  this.ranges.bbox = bbox;
  this.ranges.yrange = yrange;
};
AxisCharts.prototype.getRanges = function (chart, blockId, resizedWidth) {
  let
  {yrange } = this.ranges,
  {yAxis } = this.scales,
  /** isBlockData is not used if dataConfig is defined.  this can be moved out to the caller. */
  isBlockData = chart.length && (chart[0].description === undefined),
  // axisID = gAxis.node().parentElement.__data__,

  yAxisDomain = yAxis.domain(), yDomain;
  if (noDomain(yAxisDomain) && chart.length) {
    yAxisDomain = [chart[0]._id.min, chart[chart.length-1]._id.max];
    yAxis.domain(yAxisDomain);
    yDomain = yAxisDomain;
  }
  else
    yDomain = [yAxis.invert(yrange[0]), yAxis.invert(yrange[1])];

  let dataConfig = this.dataConfig;
  if (! dataConfig) {
    let dataConfigProperties = isBlockData ? blockData : parsedData;
    dataConfigProperties.datum2Location = 
      (d) => datum2LocationWithBlock(d, blockId);
    this.dataConfig = dataConfig = 
      new DataConfig(dataConfigProperties);
    if (! dataConfig.hoverTextFn)
      dataConfig.hoverTextFn = hoverTextFn;
    if (dataConfig.valueIsArea === undefined)
      dataConfig.valueIsArea = false;
  }
  if (dataConfig) {
    if (! dataConfig.barClassName)
      dataConfig.barClassName = classNameSub;
    if (! dataConfig.valueName)
      dataConfig.valueName = chart.valueName || "Values";
  }

  this.ranges.pxSize = (yDomain[1] - yDomain[0]) / this.ranges.bbox.height;
};
AxisCharts.prototype.getRanges3 = function (chart, resizedWidth) {

  let
  {bbox} = this.ranges,
  {yAxis} = this.scales,
  yDomain = yAxis.domain(),
  withinZoomRegion = (d) => {
    return inRangeEither(this.dataConfig.datum2Location(d), yDomain);
  },
  data = chart.filter(withinZoomRegion);

  console.log(resizedWidth, bbox, yDomain, data.length, (data.length == 0) || this.dataConfig.datum2Location(data[0]));
  if (resizedWidth)
    bbox.width = resizedWidth;
};


/*  axis
 * x  .value
 * y  .name Location
 */
/** 1-dimensional chart, within an axis. */
function Chart1(parentG, dataConfig)
{
  this.parentG = parentG;
  this.dataConfig = dataConfig;
}
Chart1.prototype.barsLine =  true;
AxisCharts.prototype.getRanges2 =  function ()
{
  // based on https://bl.ocks.org/mbostock/3885304,  axes x & y swapped.
  let
    // parentG = this.parentG,
    bbox = this.ranges.bbox,
  margin = showChartAxes ?
    {top: 10, right: 20, bottom: 40, left: 20} :
  {top: 0, right: 0, bottom: 0, left: 0},
  // pp=parentG.node().parentElement,
  parentW = bbox.width, // +pp.attr("width")
  parentH = bbox.height, // +pp.attr("height")
  width = parentW - margin.left - margin.right,
  height = parentH - margin.top - margin.bottom;
  this.ranges.drawSize = {width, height};
  dLog('getRanges2', parentW, parentH, this.ranges.drawSize);
};
Chart1.prototype.prepareScales =  function (data, drawSize)
{
  /** The chart is perpendicular to the usual presentation.
   * The names x & y (in {x,y}Range and yLine) match the orientation on the
   * screen, rather than the role of abscissa / ordinate; the data maps
   * .name (location) -> .value, which is named y -> x.
   */
  let
    dataConfig = this.dataConfig,
  width = drawSize.width,
  height = drawSize.height,
  xRange = [0, width],
  yRange = [0, height],
  // yRange is used as range of yLine by this.scaleLinear().
  /* scaleBand would suit a data set with evenly spaced or ordinal / nominal y values.
   * yBand = d3.scaleBand().rangeRound(yRange).padding(0.1),
   */
  y = this.scaleLinear(yRange, data),
  x = d3.scaleLinear().rangeRound(xRange);
  // datum2LocationScaled() uses me.scales.x rather than the value in the closure in which it was created.
  this.scales.x = x;
  // Used by bars() - could be moved there, along with  datum2LocationScaled().
  this.scales.y = y;
  console.log("Chart1", xRange, yRange, dataConfig.dataTypeName);

  let me = this;
  /* these can be renamed datum2{abscissa,ordinate}{,Scaled}() */
  /* apply y after scale applied by datum2Location */
  let datum2LocationScaled = scaleMaybeInterval(dataConfig.datum2Location, me.scales.y);
  /** related @see rectWidth().  */
  function datum2ValueScaled(d) { return me.scales.x(dataConfig.datum2Value(d)); }
  dataConfig.datum2LocationScaled = datum2LocationScaled;
  dataConfig.datum2ValueScaled = datum2ValueScaled;
};

AxisCharts.prototype.group = function (parentG, groupClassName) {
  /** parentG is g.axis-use.  add g.(groupClassName);
   * within parentG there is also a sibling g.axis-html. */
  let data = parentG.data(),
  gs = parentG
    .selectAll("g > g." + groupClassName)
    .data(data), // inherit g.datum(), or perhaps [groupClassName]
  gsa = gs
    .enter()
    .append("g")  // maybe drop this g, move margin calc to gp
  // if drawing internal chart axes then move them inside the clip rect
  // .attr("transform", "translate(" + margin.left + "," + margin.top + ")"),
    .attr("class", groupClassName),
  g = gsa.merge(gs);
  dLog('group', this, parentG, g.node());
  this.dom.g = g;
  this.dom.gs = gs;
  this.dom.gsa = gsa;
  return g;
};

AxisCharts.prototype.drawAxes = function (data) {

  /**  first draft showed all data;  subsequently adding :
   * + select region from y domain
   * -	place data in tree for fast subset by region
   * +	alternate view : line
   * + transition between views, zoom, stack
   */
  // scaleBand() domain is a list of all y values.
  // yBand.domain(data.map(dataConfig.datum2Location));

  let
  {height} = this.ranges.drawSize,
  {x, y} = this.scales,
  {gs, gsa} = this.dom,
  dataConfig = this.dataConfig;

  x.domain([0, d3.max(data, dataConfig.rectWidth.bind(dataConfig, /*scaled*/false, /*gIsData*/false))]);

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
  // can option this out if !valueName
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", "0.71em")
    .attr("text-anchor", "end")
    .text(dataConfig.valueName);
};
Chart1.prototype.data = function (data)
{
  let 
    dataConfig = this.dataConfig;
  data = data.sort((a,b) => middle(dataConfig.datum2Location(a)) - middle(dataConfig.datum2Location(b)));
  this.drawContent(data);
  this.currentData = data;
};
Chart1.prototype.bars = function (data)
{
  let
    dataConfig = this.dataConfig,
  block = this.block,
  g = this.g;
  let
    rs = g
  // .select("g." + className + " > g")
    .selectAll("rect." + dataConfig.barClassName)
    .data(data),
  re =  rs.enter(), rx = rs.exit();
  let ra = re
    .append("rect");
  ra
    .attr("class", dataConfig.barClassName)
  /** parent datum is currently 1, but could be this.block;
   * this.parentElement.parentElement.__data__ has the axis id (not the blockId),
   */
    .each(function (d) { configureHorizTickHover.apply(this, [d, block, dataConfig.hoverTextFn]); });
  ra
    .merge(rs)
    .transition().duration(1500)
    .attr("x", 0)
    .attr("y", (d) => { let li = dataConfig.datum2LocationScaled(d); return li.length ? li[0] : li; })
  // yBand.bandwidth()
    .attr("height", dataConfig.rectHeight.bind(dataConfig, /*gIsData*/false)) // equiv : (d, i, g) => dataConfig.rectHeight(false, d, i, g)
    .attr("width", dataConfig.rectWidth.bind(dataConfig, /*scaled*/true, /*gIsData*/false));
  rx.remove();
  console.log(rs.nodes(), re.nodes());
};
/** Calculate the height of rectangle to be used for this data point
 * @param this  is DataConfig, not DOM element.
 * @param scaled  true means apply scale (x) to the result
 * @param gIsData true meangs g is __data__, otherwise it is DOM element, and has .__data__ attribute.
 * gIsData will be true when called from d3.max(), and false for d3 attr functions.
 */
DataConfig.prototype.rectWidth = function (scaled, gIsData, d, i, g)
{
  Ember.assert('rectWidth arguments.length === 5', arguments.length === 5);
  /** The scale is linear, so it is OK to scale before dividing by rectHeight.
   * Otherwise could use datum2Value() here and apply this.x() before the return.
   */
  let d2v = (scaled ? this.datum2ValueScaled : this.datum2Value),
  width = d2v(d);
  if (this.valueIsArea) {
    let h;
    width /= (h = this.rectHeight(gIsData, d, i, g));
    // dLog('rectWidth', h, width, gIsData);
  }
  return width;
};
/** Calculate the height of rectangle to be used for this data point
 * @param this  is DataConfig, not DOM element.
 * @param gIsData true meangs g is __data__, otherwise it is DOM element, and has .__data__ attribute.
 * gIsData will be true when called from d3.max(), and false for d3 attr functions.
 */
DataConfig.prototype.rectHeight = function (gIsData, d, i, g)
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
      /* constant value OK - don't expect to be called if g.length is 0.
       * this.scales.y.range() / 10;
       */
      height = 10;
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
  if (! this.scales.yLine)
    this.scales.yLine = d3.scaleLinear();
  let y = this.scales.yLine;
  y.rangeRound(yRange);
  let
    /** location may be an interval, so flatten the result.
     * Later Array.flat() can be used.
     */
    yFlat = data
    .map(this.dataConfig.datum2Location)
    .reduce((acc, val) => acc.concat(val), []);
  y.domain(d3.extent(yFlat));
  console.log('scaleLinear domain', y.domain(), yFlat);
  return y;
};
Chart1.prototype.line = function (data)
{
  let y = this.scales.yLine, dataConfig = this.dataConfig;

  let datum2LocationScaled = scaleMaybeInterval(dataConfig.datum2Location, y);
  let line = d3.line()
    .x(dataConfig.rectWidth.bind(dataConfig, /*scaled*/true, /*gIsData*/false))
    .y((d) => middle(datum2LocationScaled(d)));

  console.log("line x domain", this.scales.x.domain(), this.scales.x.range());

  let
    g = this.g,
  ps = g
    .selectAll("g > path." + dataConfig.barClassName)
    .data([1]);
  ps
    .enter()
    .append("path")
    .attr("class", dataConfig.barClassName + " line")
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

AxisCharts.prototype.commonFrame = function container()
{
  let axisID = this.axisID,
  gAxis = this.dom.gAxis,
  bbox = this.ranges.bbox;

  /** datum is value in hash : {value : , description: } and with optional attribute description. */

  dLog('container', gAxis.node());
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
  if (! gp.empty() ) {
    addParentClass(g);
    /* .gc is <g clip-path=​"url(#axis-clip-{{axisID}})​">​</g>​
     * .g (assigned later) is g.axis-chart
     */
    this.dom.gc = g;
    this.dom.gp = gp;
    this.dom.gps = gps;
  }
};

/*
 class AxisChart {
 bbox;
 data;
 gp;
 gps;
 };
 */
AxisCharts.prototype.configure = function configure(dataConfig)
{
  this.dataConfig = dataConfig;
};

AxisCharts.prototype.controls = function controls(chart1)
{
  let
    bbox = this.ranges.bbox,
  gp = this.dom.gp,
  gps = this.dom.gps;

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
};

/*----------------------------------------------------------------------------*/

/* layoutAndDrawChart() has been split into class methods of AxisCharts and Chart1,
 * and replaced with a proxy which calls them, and can next be re-distributed into axis-chart. */
export { layoutAndDrawChart, AxisCharts, /*AxisChart,*/ className, Chart1, DataConfig };
