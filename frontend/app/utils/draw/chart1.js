import { assert } from '@ember/debug';

import { getAttrOrCP } from '../ember-devel';
import { configureHorizTickHover } from '../hover';
import {
  eltWidthResizable,
  noShiftKeyfilter
} from '../domElements';
import { logSelectionNodes } from '../log-selection';
import { noDomain } from '../draw/axis';
import { stacks } from '../stacks'; // just for oa.z and .y, don't commit this.
import { inRangeEither, overlapInterval } from './zoomPanCalcs';
import { intervalSize } from '../interval-calcs';
import {
  featureCountDataProperties,
  dataConfigs,
  DataConfig,
  blockDataConfig,
  hoverTextFn,
  middle,
  scaleMaybeInterval,
  datum2LocationWithBlock
} from '../data-types';
import { breakPoint } from '../breakPoint';


const className = "chart", classNameSub = "chartRow";
/** Enables per-chart axes; X axes will be often useful; Y axis might be used if
 * zooming into different regions of an axis.  */
const showChartAxes = true;
const useLocalY = false;

// const transitionDuration = 150;

const trace = 1;

/* global d3 */

/*----------------------------------------------------------------------------*/

/** Introductory notes

The axis charts code is organised into :
. components/axis-charts.js	provides the data feed
. utils/draw/chart1.js	renders the data using d3
. utils/data-types.js	accesses values from the data
It is not essential that they be divided this way, e.g. the Ember and JS classes could be combined, but it seems to provide a good module size, and plays to the strengths of each framework, using Ember as the integration / dynamics layer and d3 as the purely mechanistic rendering layer.

The Ember component connects to other modules, delivering data flows to the rendering functions;  e.g. connections include events such as zoom & resize which trigger render updates.
Using JS classes enables 4 small and closely related classes to be in a single file,  which was useful when the early prototype code was being split into the number of pieces required by the update structure, and moved between levels as the design took shape.

 */

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** Example of the structure of the DOM elements generated.   The .dom.* selections which address them are indicated in comments. 

<g class="axis-use hasChart">   <!-- gAxis -->
  <g class="chart">             <!-- gps, gpa, gp,  -->
    <clipPath id="axis-chart-clip-5ced0aa73156212ab025de3a"><rect x="0" y="0" width="113" height="476"></rect></clipPath>
    <g clip-path="url(#axis-chart-clip-5ced0aa73156212ab025de3a)">      <!-- gc -->
      <g class="blockData" transform="translate(12, 0)">                <!-- gca - multiple Chart1 in an axis -->
        <g class="chart-line" id="chart-line-5ced0aa73156212ab025de3a">         <!-- chart1.g, dom.gs, dom.gsa.
          <path class="chartRow" data-original-title="" title="" d="M0,71.20120793040937L38,71.20120793040937" stroke="rgb(255, 0, 0)"></path>
          <!-- ... -->
        </g>
        <g class="axis axis--x" transform="translate(0,426)" fill="none" font-size="10" font-family="sans-serif" text-anchor="middle">
          <path class="domain" stroke="#000" d="M0.5,6V0.5H73.5V6"></path>
          <g class="tick" opacity="1" transform="translate(3.5,0)"><line stroke="#000" y2="6"></line><text fill="#000" y="9" dy="0.71em">0.1</text></g>
          <!-- ... -->
        </g>
        <circle class="radio toggle chartType pushed" r="6" cx="56.5" cy="466"></circle>
      </g>
      <g class="featureCountData" transform="translate(42, 0)">                 <!-- gca -->
        <g class="chart-line" id="chart-line-5ced0aa73156212ab025de3a">
          <rect class="chartRow" fill="red" data-original-title="" title="" width="5.883523809523809" x="0" y="1.520982501358441" height="12.01679177145495"></rect>
          <!-- ... -->
        </g>
        <g class="axis axis--x" transform="translate(0,426)" fill="none" font-size="10" font-family="sans-serif" text-anchor="middle">
          <path class="domain" stroke="#000" d="M0.5,6V0.5H73.5V6"></path>
          <g class="tick" opacity="1" transform="translate(8.5,0)"><line stroke="#000" y2="6"></line><text fill="#000" y="9" dy="0.71em">0.0005</text></g>
          <!-- ... -->
        </g>
        <circle class="radio toggle chartType pushed" r="6" cx="56.5" cy="466"></circle>
      </g>
    </g>
  </g>

*/

/*----------------------------------------------------------------------------*/

/** Add a .hasChart class to the <g.axis-use> which contains this chart.
 * Currently this is used to hide the <foreignObject> so that hover events are
 * accessible on the chart bars, because the <foreignObject> is above the chart.
 * Later can use e.g. axis-accordion to separate these horizontally;
 * for axis-chart the foreignObject is not used.
 *
 * @param g parent of the chart. this is the <g> with clip-path #axis-chart-clip.
 */
function addParentClass(g) {
  let axisUse=g.node().parentElement.parentElement,
  us=d3.select(axisUse);
  us.classed('hasChart', true);
  console.log('addParentClass', us.node());
};
/*----------------------------------------------------------------------------*/


/*  axis
 * x  .value
 * y  .name Location
 * name chartName, used as index in axis-charts.charts[]
*/
/** 1-dimensional chart, within an axis. */
function Chart1(dataConfig, name)
{
  /* deep copy not required; this enables .scaledConfig() to modify DataConfig
   * datum2LocationScaled (refactor once this is settled).
   * (could bind / curry optional scaleY arg, as is done with rectWidth for datum2Value.)
   */
  this.dataConfig = Object.create(dataConfig);
  this.name = name;
  this.chartLines = {};
  /* yAxis is imported, x & yLine are calculated locally.
   * y is used for drawing - it refers to yAxis or yLine.
   * yLine would be used for .line() if yBand / scaleBand was used for .bars().
   */
  this.scales = { /* yAxis, x, y, yLine */ };
}
Chart1.prototype.barsLine =  true;


class ChartLine {
  constructor(dataConfig, scales) {
    this.dataConfig = dataConfig;
    /* the scales have the same .range() as the parent Chart1, but the .domain() varies. */
    this.scales = scales; // Object.assign({}, scales);
  }
}

/*----------------------------------------------------------------------------*/

class AxisCharts {
  /*
   ranges;  // .bbox, .height
   dom;  // .gs, .gsa, 
   */

  constructor(axis1d, axisID) {
    this.axis1d = axis1d;
    this.axisID = axisID;
    this.ranges = { };
    this.dom = { };
  }
};

AxisCharts.prototype.setup = function(axisID) {
  this.selectParentContainer(axisID);
  this.getBBox();
};

/**
 * @param allocatedWidth  [horizontal start offset, width]
 * @param yAxisScale  .range() is used to set clip rect y bounds, if !useLocalY
 */
AxisCharts.prototype.setupFrame = function(axisID, charts, allocatedWidth, yAxisScale)
{
  let axisCharts = this;
  axisCharts.setup(axisID);

  let resizedWidth = allocatedWidth[1];
  axisCharts.getRanges3(resizedWidth);

  // axisCharts.size(this.get('yAxisScale'), /*axisID, gAxis,*/   chartData, resizedWidth);  //  -	split size/width and data/draw

  axisCharts.commonFrame(/*axisID, gAxis*/);

  // equivalent to addParentClass();
  axisCharts.dom.gAxis.classed('hasChart', true);

  axisCharts.frame(axisCharts.ranges.bbox, charts, allocatedWidth, yAxisScale);

  axisCharts.getRanges2();
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
  let
    gAxis = this.dom.gAxis,
  gAxisElt = gAxis.node();
  /* If the selection is empty, nothing will be drawn. */
  if (gAxisElt) {
    let
      /** relative to the transform of parent g.axis-outer */
      bbox = gAxisElt.getBBox(),
    yrange = [bbox.y, bbox.height];
    /** bbox.x is 10, probably because the child elements at this point start
     * from 10 (right-edge path and g.tracks).
     * Might need to leave 5px space for brushing the axis.
     */
    if (bbox.x !== 0)
    {
      console.log("x !== 0", bbox);
      bbox.x = 0;
    }
    this.ranges.bbox = bbox;
    this.ranges.yrange = yrange;
  }
};

AxisCharts.prototype.getRanges3 = function (resizedWidth) {
  if (resizedWidth) {
    let
    {bbox} = this.ranges;
    if (bbox)
      bbox.width = resizedWidth;
    dLog('resizedWidth', resizedWidth, bbox);
  }
};

AxisCharts.prototype.getRanges2 =  function ()
{
  // based on https://bl.ocks.org/mbostock/3885304,  axes x & y swapped.
  let
    bbox = this.ranges && this.ranges.bbox;
  if (bbox) {
    let
    /** equivalent logic applies in axis-charts:draw() to enable drawAxes().  */
      margin = showChartAxes && ! this.isFeaturesCounts ?
      {top: 10, right: 20, bottom: 40, left: 20} :
    {top: 0, right: 0, bottom: 0, left: 0},
    // pp=parentG.node().parentElement,
    parentW = bbox.width, // +pp.attr("width")
    parentH = bbox.height, // +pp.attr("height")
    width = parentW - margin.left - margin.right,
    height = parentH - margin.top - margin.bottom;
    this.ranges.drawSize = {width, height};
    dLog('getRanges2', parentW, parentH, this.ranges.drawSize);
  }
};

AxisCharts.prototype.drawAxes = function (charts) {
  let
    dom = this.dom,
  append = dom.gca;
  /** the axes were originally within the gs,gsa of .group(), but are now within the g[clip-path];
   * append here selects the <g> into which the axes will be inserted.
   */
  append.each(Chart1.prototype.drawAxes);
};

AxisCharts.prototype.commonFrame = function()
{
  let axisID = this.axisID,
  gAxis = this.dom.gAxis,
  bbox = this.ranges.bbox;

  /** datum is value in hash : {value : , description: } and with optional attribute description. */

  dLog('commonFrame', gAxis.node());
  /** parent selection ; contains a clipPath, g clip-path, text.resizer.  */
  let gps =   gAxis
    .selectAll("g." + className)
    .data([axisID]),
  gpa = gps
    .enter()
    .insert("g", ":first-child")
    .attr('class', className);
  if (false) { // not completed.  Can base resized() on axis-2d.js
    let text = gpa
      .append("text")
      .attr('class', 'resizer')
      .html("⇹")
      .attr("x", bbox.width-10);
    if (gpa.size() > 0)
      eltWidthResizable("g.axis-use > g." + className + " > text.resizer", resized);
  }
  this.dom.gps = gps;
  this.dom.gpa = gpa;
  this.dom.gp = gpa.merge(gps);
};

AxisCharts.prototype.frameRemove = function() {
  let gp = this.dom && this.dom.gp;
  gp && gp.remove();
};

/**
 * @param allocatedWidth  [horizontal start offset, width]
 * @param yAxisScale  .range() is used to set clip rect y bounds, if !useLocalY
 */
AxisCharts.prototype.frame = function(bbox, charts, allocatedWidth, yAxisScale)
{
  let
    gps = this.dom.gps,
  gpa = this.dom.gpa;

  let clipY = useLocalY ? [ bbox.y, bbox.height ] : yAxisScale.range();

  /** datum is axisID, so id and clip-path can be functions.
   * e.g. this.dom.gp.data() is [axisID]
   */
  function axisClipId(axisID) { return "axis-chart-clip-" + axisID; }
  /** gpa is the .enter().append() (insert) of g.chart, and gPa is the result of
   * .append()-ing clipPath to that selection. */
  let gPa =
    gpa // define the clipPath
    .append("clipPath")       // define a clip path
    .attr("id", axisClipId) // give the clipPath an ID
    .append("rect"),          // shape it as a rect
  gprm = 
    gPa.merge(gps.selectAll("g > clipPath > rect"))
    .attr("x", bbox.x)
    .attr("y", clipY[0])
    .attr("width", bbox.width + 250)
    .attr("height", clipY[1])
  ;
  let [startOffset, width] = allocatedWidth;
  /* allocatedWidth[0] is currently min, so use 0 instead.  */
  startOffset = 0;
  let gcp1 =
    gpa.append("g")
    .attr("clip-path", (d) => "url(#" + axisClipId(d) + ")"), // clip with the rectangle
   gcp2 = gpa.merge(gps).selectAll("g.chart > g[clip-path]"),
   dataTypeNames = Object.values(charts).mapBy('dataConfig.dataTypeName'),
   dataTypeNamesSelector = 'g[clip-path] > g' + (dataTypeNames.length ? '.' : '') + dataTypeNames.join(', g[clip-path] > g.'),
   gcs = (gpa.size() ? gcp1 : gcp2)
    .selectAll(dataTypeNamesSelector)
    // g.<dataTypeName> does not have a unique id, so use a key function.
    .data(Object.values(charts), Chart1.keyFn),
   gca = gcs
    .enter()
    .append("g")
    .attr('class', (d) => d.dataConfig.dataTypeName)
  ;
  gca.merge(gcs)
    .attr("transform", (chart, i) => chart.transform(i))
  ;
  /* handle removal of chart types   */
  gcs.exit().remove();

  let g = 
    this.dom.gp.selectAll("g." + className+  " > g");
  if (! gpa.empty() ) {
    addParentClass(g);
  }
    /* .gc is <g clip-path=​"url(#axis-chart-clip-{{axisID}})​">​</g>​
     * .g (assigned later) is all g.chart-line, i.e. all chart-lines of all Chart1-s of this axis
     * .gca contains a g for each chartType / dataTypeName, i.e. per Chart1.
     *   It is used to append elements which added once per chart, e.g. controls() and drawAxes()
     * .gcp is the parentG g.<dataTypeName> (blockData, featureCountData).
     *   It is a copy of .gca when it was first non-empty.
     */
    this.dom.gc = g;
    this.dom.gca = gca;
  if (! gca.empty() || ! this.dom.gcp) {
    this.dom.gcp = gca;
  }
};


AxisCharts.prototype.controls = function controls()
{
  let
    bbox = this.ranges.bbox,
  append = this.dom.gca,
  select = this.dom.gc;

  function toggleBarsLineClosure(chart /*, i, g*/)
  {
    d3.event.stopPropagation();
    chart.toggleBarsLine();
  }

  /** currently placed at g.chart, could be inside g.chart>g (clip-path=). */
  let chartTypeToggle = append
    .append("circle")
    .attr("class", "radio toggle chartType graph-btn")
    .attr("r", 6)
    .on("click", toggleBarsLineClosure);
  chartTypeToggle.merge(select.selectAll("g > circle"))
    .attr("cx", bbox.x + bbox.width / 2)   /* was o[p], but g.axis-outer translation does x offset of stack.  */
    .attr("cy", bbox.height - 10)
    .classed("pushed", (chart1) => { return chart1.barsLine; });
  chartTypeToggle.each(function(chart) { chart.chartTypeToggle = d3.select(this); } );
};

/*----------------------------------------------------------------------------*/

/*
 class AxisChart {
 bbox;
 data;
 gp;
 gps;
 };
 */

/*----------------------------------------------------------------------------*/

/** For use in web inspector console, e.g.
 * d3.selectAll('g.chart > g[clip-path] > g').each((d) => d.logSelectionNodes2())
 * or from Ember inspector /axis-chart : $E.chart.logSelectionNodes2()
 */
Chart1.prototype.logSelectionNodes2 = function(dom)
{
  if (! dom)
    dom = this.dom;
  Object.keys(dom).forEach((k) => {dLog(k); logSelectionNodes(dom[k]); });
};


/** For use in web inspector console, e.g.
 * d3.selectAll('g.chart > g[clip-path] > g').each((d) => d.logScales());
 */
Chart1.prototype.logScales = function() {
  let scales = this.scales; 
  Object.keys(scales).forEach((k) => {var s = scales[k]; console.log(k, s.domain(), s.range()); });
};


Chart1.prototype.overlap = function(axisCharts) {
  let chart1 = this;
  // Plan is for AxisCharts to own .ranges, but for now there is some overlap.
  if (! chart1.ranges) {
    chart1.ranges = axisCharts.ranges;
    chart1.dom = axisCharts.dom;
  }
};
Chart1.prototype.removeChartLine = function(blockId) {
  let chartLine = this.chartLines[blockId];
  if (chartLine) {
    chartLine.remove();
    delete this.chartLines[blockId];
  }
  let empty = Object.keys(this.chartLines).length === 0;
  return empty;
};
Chart1.prototype.remove = function() {
  let thisGcp = this.dom.gcp.filter((chart) => chart===this);
  dLog('remove', this.dom.gcp.nodes(), thisGcp.node(), thisGcp.nodes());
  thisGcp.remove();
  this.dom.gcp = this.dom.gcp.filter((elt) => elt.isConnected);
};
/** @return a unique id for the chart within this split axis (g[clip-path])
 */
Chart1.keyFn = function(chart) {
  /** keys(chart.chartLines) are the blockIds, which may appear in multiple
   * charts (chartTypes), so prepend dataTypeName for uniqueness.
   */
  return chart.dataConfig.dataTypeName + '_' + Object.keys(chart.chartLines).join('_');
};
/** Currently chartsArray() constructs chartName via (dataTypeName + '_' +
 * blockId) which is equivalent to keyFn, and passes chartName to addChart().
 * This function might be used for verification, e.g. chart.name === chart.chartName().
 */
Chart1.prototype.chartName = function() {
  return Chart1.constructor.keyFn.apply(this, [this]);
}

/**
 * @param resizedWidth  width
 */
Chart1.prototype.setupChart = function(axisID, axisCharts, chartData, blocks, dataConfig, yAxisScale, resizedWidth)
{
  this.scales.yAxis = yAxisScale;
  this.allocatedWidth = resizedWidth;

  //----------------------------------------------------------------------------

  /* ChartLine:setup() makes a copy of Chart1's .dataConfig, so augment it
   * before then (called in createLine()).
   */
  /* pasteProcess() may set .valueName, possibly provided by GUI;
   * i.e. Object.values(chartData).mapBy('valueName').filter(n => n)
   * and that can be passed to addedDefaults().
   */
  dataConfig.addedDefaults();

  //----------------------------------------------------------------------------

  let
    blocksById = blocks.reduce(
      (result, block) => { result[block.get('id')] = block; return result; }, []),
  blockIds = Object.keys(chartData);
  blockIds.forEach((blockId) => {
    let block = blocksById[blockId];
    /** if block then blockId is on this axis / chart. */
    if (block) {
      // ensure the chartLine is created.
      this.createLine(blockId, block);
    }
  });
  /** devel - verify gcp / parentG */
  let parentGS = this.dom.gc.selectAll('g.' + this.dataConfig.dataTypeName);
  let parentG = parentGS.filter((chart) => chart === this);
  /** passed to group(). */
  let parentGarg;
  if (! parentGarg && ! parentG.empty()) {
    parentGarg = parentG;
  }

  this.group(parentGarg, 'chart-line');

  //----------------------------------------------------------------------------

  this.getRanges(this.ranges, chartData);

  return this;
};

/** draw the chartData.
 * If the blocks of any of this.chartLines have un-viewed, they will not be in chartData, and are removed.
 */
Chart1.prototype.drawChart = function(axisCharts, chartData)
{
  /** possibly don't (yet) have chartData for each of blocks[],
   * i.e. blocksById may be a subset of blocks.mapBy('id').
   */
  let blockIds = Object.keys(chartData);

  let empty = this.removeUnViewedChartLines(blockIds);
  if (! empty) {
    blockIds.forEach((blockId) => {
      this.data(blockId, chartData[blockId]);
    });

    if (this.allocatedWidth === 0) {
      this.allocatedWidth = axisCharts.ranges.drawSize;
    }
    this.prepareScales(chartData, this.ranges.drawSize);
    blockIds.forEach((blockId) => {
      this.chartLines[blockId].scaledConfig(); } );

    this.drawContent();
  }
  return empty;
};
/** Remove un-viewed ChartLines
 * @param blockIds caller (as in the case of Chart1:drawChart()) may provide an
 * array of blockIds which are viewed.
 * if blockIds is undefined then block.get('isViewed') is used.
 * @return true if this chart the last ChartLine of this chart is removed (the caller will then remove this chart). 
 */
Chart1.prototype.removeUnViewedChartLines = function(blockIds)
{
  let empty;
  Object.keys(this.chartLines).forEach((blockId) => {
    let isViewed = blockIds ?
      (blockIds.indexOf(blockId) !== -1) :
      this.chartLines[blockId].block.get('isViewed');
    if (! isViewed) {
      empty = this.removeChartLine(blockId);
    }
  });
  return empty;
};


Chart1.prototype.getRanges = function (ranges, chartData) {
  let
  {yrange } = ranges,
  {yAxis } = this.scales,
  // if needed, use the first data array to calculate domain
  chart = Object.values(chartData),
  // axisID = gAxis.node().parentElement.__data__,

  yAxisDomain = yAxis.domain(), yDomain;
  if (chart) 
    chart = chart[0];
  if (noDomain(yAxisDomain) && chart.length) {
    // this assumes featureCountData;  don't expect to need this.
    yAxisDomain = [chart[0]._id.min, chart[chart.length-1]._id.max];
    yAxis.domain(yAxisDomain);
    yDomain = yAxisDomain;
  }
  else
    yDomain = [yAxis.invert(yrange[0]), yAxis.invert(yrange[1])];

  if (ranges && ranges.bbox)
    ranges.pxSize = (yDomain[1] - yDomain[0]) / ranges.bbox.height;
};




/**
 * @param drawSize  {width, height}
 */
Chart1.prototype.prepareScales =  function (data, drawSize)
{
  /** The chart is perpendicular to the usual presentation.
   * The names x & y (in {x,y}Range and yLine) match the orientation on the
   * screen, rather than the role of abscissa / ordinate; the data maps
   * .name (location) -> .value, which is named y -> x.
   */
  let
    dataConfig = this.dataConfig,
  scales = this.scales,
  width = drawSize.width,
  height = drawSize.height,
  /** leave 10px space at right side (trackWidth).
   *
   * Start xRange from 1px because <1px is shown as a sub-pixel gradation and is
   * nearly invisible; < several px is very hard to see anyway.
   * i.e. if the value is close to domain[0] it should still be clearly visible
   * - the fact that there is a value there is significant.
   */
  xRange = [1, width-10],
  yRange = [0, height],
  // yRange is used as range of yLine by this.scaleLinear().
  /* scaleBand would suit a data set with evenly spaced or ordinal / nominal y values.
   * yBand = d3.scaleBand().rangeRound(yRange).padding(0.1),
   */
  y = useLocalY ? this.scaleLinear(yRange, data) : scales.yAxis;
  scales.xWidth = 
    d3.scaleLinear().range(xRange);
  if (dataConfig.barAsHeatmap) {
    scales.xColour = d3.scaleOrdinal().range(d3.schemeCategory20);
  }
  // datum2LocationScaled() uses me.scales.x rather than the value in the closure in which it was created.
  scales.x = dataConfig.barAsHeatmap ? scales.xColour : scales.xWidth;

  // Used by bars() - could be moved there, along with  datum2LocationScaled().
  scales.y = y;
  console.log("Chart1", xRange, yRange, dataConfig.dataTypeName);

  this.scaleXDomain(data);
};
/**
 * @param data  {<blockId> : data array, ... }
 */
Chart1.prototype.scaleXDomain = function (data)
{
  let
  dataConfig = this.dataConfig,
  scales = this.scales,
  startFrom0 = this.dataConfig.isFeaturesCounts(),
  valueWidthFn = dataConfig.rectWidth.bind(dataConfig, /*scaleX*/undefined, /*gIsData*/true),
  valueCombinedDomain = this.domain(valueWidthFn, data);
  /** in the case of featureCountData the data are non-empty bins - the domain starts from > 0.
   * Starting the domain from 0 makes the width proportional to count.
   */
  if (startFrom0 && (valueCombinedDomain[0] > 0)) {
    valueCombinedDomain[0] = 0;
  }

  scales.xWidth.domain(valueCombinedDomain);
  if (scales.xColour)
    scales.xColour.domain(valueCombinedDomain);
};

Chart1.prototype.drawContent = function ()
{
  Object.keys(this.chartLines).forEach((blockId) => {
    let chartLine = this.chartLines[blockId];
    chartLine.drawContent(this.barsLine);
  });
};

Chart1.prototype.group = function (parentG, groupClassName) {
  /** parentG is g.{{dataTypeName}}, within : g.axis-use > g.chart > g[clip-path] > g.{{dataTypeName}}.
   * add g.(groupClassName);
   * within g.axis-use there is also a sibling g.axis-html. */
  /* on subsequent calls (didRender() is called whenever params change),
   * parentG is empty, and hence g is empty.
   * so this is likely to need a change to handle addition/removal of chartlines after first render.
   */
  let // data = parentG.data(),
    gs = parentG
    .selectAll("g > g." + groupClassName)
    .data((chart) => Object.values(chart.chartLines)),
  gsa = gs
    .enter()
    .append("g")  // maybe drop this g, move margin calc to gp
  // if drawing internal chart axes then move them inside the clip rect
  // .attr("transform", "translate(" + margin.left + "," + margin.top + ")"),
    .attr("class", (chartLine) => groupClassName)
  /* chartLine.block may not be set; could use
   * chartLine.scales.yAxis.domain().join('_') to get a more unique id.
   */
    .attr('id', (chartLine, i) => groupClassName + '-' + (chartLine.block ? chartLine.block.id : i))
    // also x offset by .allocatedWidths[className][0] as x offset; that is defined after the chart is first rendered.
    /* this transform is achieved by Chart1:transform() in frame(), so this
     * would only be used if the g.chart-line s within a chart were offset
     * separately
     * .attr('transform', (chartLine, i) => this.blockTransform(chartLine))	// trackWidth
     */
  // .data((chartLine) => chartLine.currentData)
  ,
  // parentG.selectAll("g > g." + groupClassName); // 
  g = gsa.merge(gs);
  gs.exit().remove();
  dLog('group', this, parentG.node(), parentG, g.node());
  this.dom.gs = gs;
  this.dom.gsa = gsa;
  // set ChartLine .g;   used by ChartLine.{lines,bars}.
  gsa.each(function(chartLine, i) { chartLine.g = d3.select(this) ; } );
  return g;
};

/** useful in checking that unview and re-view have not caused
 * g.featureCountData and g.chart-line to become out of sync with their .__data__
 * When debugging this can be called after code which might break sync.
 * This was useful when checking impact of .remove(); adding keyFn() keeps these in sync.
 */
Chart1.verify = function () {
  let cl = d3.selectAll('g.chart-line');
  Object.keys(cl.nodes()).forEach(
    (i) => {
      if (cl.nodes()[i].id !== 'chart-line-' + cl.data()[i].block.id) {
        console.log('Chart1 verify', cl.nodes()[i], cl.data()[i].block.id);
        debugger;
      }
    });
};

/** For positions allocated by axisBlocks, i.e. featureCountData
 */
Chart1.prototype.blockOffset = function (chartLine) {
  let
  allocatedWidth = 
  this.axisBlocks.allocatedWidthForBlock(chartLine.block.id),
  xOffset = allocatedWidth && allocatedWidth[0];
  return xOffset;
};

/** Charts of type featureCountData have a separate x translation for each block.
 * For other chart types return undefined - no transform.
 */
Chart1.prototype.blockTransform = function (chartLine) {
  let transform;
  if (this.useAllocatedWidth()) {
    let xOffset = this.blockOffset(chartLine);
    transform = 'translate(' + xOffset + ')';
  }
  return transform;
};

/** Charts of type featureCountData have a separate x translation for each block.
 * For other chart types return undefined - no transform.
 * @param i d3 selection index
 */
Chart1.prototype.transform = function (i) {
  let allocatedWidth, transform;
  if (this.useAllocatedWidth()) {
    let blockWidths = this.axisBlocks.get('allocatedWidth'),
    /** useAllocatedWidth implies just 1 block. */
    blockId = Object.keys(this.chartLines)[0];

    /** for a new chart .chartLines is populated after .transform is first
     * called; returning undefined will omit the transform initially;
     * blockWidths[i] may also be undefined (it is otherwise equivalent).  */
    allocatedWidth = blockId && this.axisBlocks.allocatedWidthForBlock(blockId);
    dLog('Chart1:transform', allocatedWidth, blockId, blockWidths[i], i);
  } else {
    allocatedWidth = this.getAllocatedWidth();
  }
  if (allocatedWidth) {
    let xOffset = allocatedWidth[0];
    if (xOffset) {
      transform = "translate(" + xOffset + ", 0)";
    }
  }
  return transform;
};


/** @return true if horizontal space is allocated for each block / ChartLine of this chart by axisBlocks.
 */
Chart1.prototype.useAllocatedWidth = function () {
  /** match featureCount{,Auto}Data */
  return this.dataConfig.isFeaturesCounts();
};

Chart1.prototype.drawAxes = function (chart, i, g) {

  /**  first draft showed all data;  subsequently adding :
   * + select region from y domain
   * -	place data in tree for fast subset by region
   * +	alternate view : line
   * + transition between views, zoom, stack
   */
  // scaleBand() domain is a list of all y values.
  // yBand.domain(data.map(dataConfig.datum2Location));

  let
    chart1 = this.__data__,
  {height} = chart1.ranges.drawSize,
  {x, y} = chart1.scales,
  dom = chart1.dom,
  gs = dom.gc,
  /** selection into which to append the axes. */
  gsa = d3.select(this),
  dataConfig = chart1.dataConfig;

  let axisXa =
    gsa.append("g")
  // -  handle .exit() for these 2 also
    .attr("class", "axis axis--x");
  axisXa.merge(gs.selectAll("g > g.axis--x"))
    .attr("transform", "translate(0," + height + ")");
  if (! dataConfig.barAsHeatmap)
    axisXa
    .call(d3.axisBottom(x));

  if (useLocalY) {
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
  }
};
/**
 * @param block hover
 * used in Chart1:bars() for hover text.  passed to hoverTextFn() for .longName() 
 */

Chart1.prototype.createLine = function (blockId, block)
{
  let chartLine = this.chartLines[blockId];
  if (! chartLine) 
    chartLine = this.chartLines[blockId] = new ChartLine(this.dataConfig, this.scales);
  if (block && ! chartLine.block) {
    chartLine.block = block;
    chartLine.setup(blockId);
    // .setup() will copy dataConfig if need for custom config.
  }
};
Chart1.prototype.data = function (blockId, data)
{
  let chartLine = this.chartLines[blockId];
  if (! chartLine) {
    data = [];
  } else {
    function m(d) { return middle(chartLine.dataConfig.datum2Location(d)); }
    data = data.sort((a,b) => m(a) - m(b));
    data = chartLine.filterToZoom(data);
  }
  return data;
};
/** Draw a single ChartLine of this chart.
 * To draw all ChartLine of this chart, @see Chart1:drawContent()
 */
Chart1.prototype.drawLine = function (blockId, block, data)
{
  let chartLine = this.chartLines[blockId];
  chartLine.drawContent(this.barsLine);
};

Chart1.prototype.scaleLinear = function (yRange, data)
{
  /* based on https://bl.ocks.org/mbostock/3883245
   * now at https://web.archive.org/web/20170711093831/https://bl.ocks.org/mbostock/3885304
   * It uses rangeRound() but rounding doesn't seem applicable here.
   */
  if (! this.scales.yLine)
    this.scales.yLine = d3.scaleLinear();
  let y = this.scales.yLine;
  y.rangeRound(yRange);
  let 
    d2l = this.dataConfig.datum2Location || Object.values(this.chartLines)[0].dataConfig.datum2Location;
  let combinedDomain = this.domain(d2l, data);
  y.domain(combinedDomain);
  console.log('scaleLinear domain', combinedDomain);
  return y;
};
/** Combine the domains of each of the component ChartLine-s.
 * @param valueFn  e.g. datum2Location or datum2Value
 */
Chart1.prototype.domain = function (valueFn, blocksData)
{
  let blockIds = Object.keys(blocksData),
  domains = blockIds.map((blockId) => {
    let
      data = blocksData[blockId],
    chartLine = this.chartLines[blockId];
    return chartLine.domain(valueFn, data);
  });
  /** Union the domains. */
  let domain = domains
    .reduce((acc, val) => acc.concat(val), []);
  return domain;
};
/** Alternate between bar chart and line chart */
Chart1.prototype.toggleBarsLine = function ()
{
  console.log("toggleBarsLine", this);
  this.barsLine = ! this.barsLine;
  if (this.chartTypeToggle) {
    this.chartTypeToggle
      .classed("pushed", this.barsLine);
  }
  Object.keys(this.chartLines).forEach((blockId) => {
    let chartLine = this.chartLines[blockId];
    chartLine.g.selectAll("g > *").remove();
    chartLine.drawContent(this.barsLine);
  });
};

/*----------------------------------------------------------------------------*/

ChartLine.prototype.setup = function(blockId) {
  /* Some types (blockData, parsedData) require a block to lookup the feature
   * name for location.  They are denoted by .datum2Location not being in their
   * pre-defined config.
   */
  if (! this.dataConfig.datum2Location) {
    const
    datum2Location = (d) => datum2LocationWithBlock(d, blockId);
    // copy dataConfig to give a custom value to this ChartLine.
    /* this.dataConfig has been constructed by new DataConfig().
     * i.e. this.dataConfig.constructor === DataConfig 
     */
    let d = Object.assign(this.dataConfig, {datum2Location});
    this.dataConfig = d;
  }
};
/** @return a filter function
 * @desc
 * this could be a (static) method of either Chart1 or ChartLine.
 */
Chart1.withinZoomRegion = function (dataConfig, yDomain) {
  /* This will accept features which overlap the domain. Use inRangeEither() to
   * accept only features which are entirely within the domain.  */
  return (d) => overlapInterval(dataConfig.datum2Location(d), yDomain);
},
/** Filter given data according to this.scales.yAxis.domain()
 * and set .currentData
 * @param chart data array
 */
ChartLine.prototype.filterToZoom = function(chart) {
  let
  {yAxis} = this.scales,
  yDomain = yAxis.domain(),

  data = chart.filter(Chart1.withinZoomRegion(this.dataConfig, yDomain));
  this.currentData = data;

  dLog(yDomain, data.length, (data.length == 0) || this.dataConfig.datum2Location(data[0]));
  return data;
};

/** Enables use of the scales which are set up in .prepareScales().
 */
ChartLine.prototype.scaledConfig = function ()
{
  let
    dataConfig = this.dataConfig;

  /* these can be renamed datum2{abscissa,ordinate}{,Scaled}() */
  /* apply y after scale applied by datum2Location */
  let datum2LocationScaled = scaleMaybeInterval(dataConfig.datum2Location, this.scales.y);
  /** related @see rectWidth().  */
  dataConfig.datum2LocationScaled = datum2LocationScaled;
};

ChartLine.prototype.blockColour = function ()
{
  const fnName = 'ChartLine blockColour';
  /** BlockAxisView / block-axis-view (was Stacks : Block) */
  let blockS = this.block && this.block.get('view');

  if (! blockS) {
    breakPoint(fnName, this.block, this);
  } else  {
    let 
    axis = blockS.axis,
    axis1d = axis;
    if (! (axis && axis1d) || axis1d.isDestroying ) {
      breakPoint(fnName, blockS, blockS.axisName, axis, axis1d, this.block.get('id'),
      this.block, this, axis1d && [axis1d.isDestroying, axis1d.isDestroyed]);
    }
  }

  if (! blockS || ! blockS.axisTitleColour()) {
    if (trace > 1) {
      dLog('blockColour', blockS);
    }
  }
  let
  /* For axes without a reference, i.e. GMs, there is a single data block with colour===undefined. */
  colour = (blockS && blockS.axisTitleColour()) || 'red';
  return colour;
};


ChartLine.prototype.selectG = function ()
{
  if (! this.g || this.g.empty()) {
    this.g = d3.selectAll("g.chart-line#chart-line-" + this.block.id)
      .filter((chartLine) => chartLine === this);
    dLog('ChartLine.selectG', this.g.nodes(), this);
  }
};

ChartLine.prototype.bars = function (data)
{
  let
    dataConfig = this.dataConfig,
  block = this.block;
  this.selectG(); // devel
  let
  g = this.g;
  if (dataConfig.barAsHeatmap)
    this.scales.x = this.scales.xColour;
  let
    rs = g
  // .select("g." + className + " > g")
    .selectAll("rect." + dataConfig.barClassName)
    .data(data, dataConfig.keyFn.bind(dataConfig)),
  re =  rs.enter(), rx = rs.exit();
  let ra = re
    .append("rect");
  ra
    .attr("class", dataConfig.barClassName)
    .attr("fill", (d) => this.blockColour())
    .attr("stroke", (d) => this.blockColour())
  /** parent datum is currently 1, but could be this.block;
   * this.parentElement.parentElement.__data__ has the axis id (not the blockId),
   */
    .each(function (d) { configureHorizTickHover.apply(this, [d, block, dataConfig.hoverTextFn]); })
    .attr("x", 0)
  ;

  function attrY(selection) {
    selection.attr("y", (d) => { let li = dataConfig.datum2LocationScaled(d); return li.length ? li[0] : li; });
  }
  /** start new elements with final y position and width 0, and transition to final width. */
  ra
    .attr("width", 0)
    .attr('stroke-opacity', 0.25)
    .attr('fill-opacity', 0.25)
    .call(attrY)
    .call(attrHeight);

  /** The transition from length 0 looks noisy when zooming in, but smooth when zooming out.
   * default to false when prevDomain initially not defined.
   */
  let idWidth = data[0] && dataConfig.rectHeight(/*scaled*/false, /*gIsData*/false, data[0], 0, []),
      idWidthChanged = this.prev_idWidth !== idWidth;
  this.prev_idWidth = idWidth;
  let zoomingIn = ! this.prevDomain || (intervalSize(this.block.zoomedDomain) <= intervalSize(this.prevDomain));
  this.prevDomain = this.block.zoomedDomain;

  let
  rm =
    ra
    .merge(rs),
  r = dataConfig.selectionToTransition(rm)
    .attr('stroke-opacity', 1)
    .attr('fill-opacity', 1)
    .call(attrY)
    .call(attrHeight);
  function attrHeight(selection) {
    selection
  // yBand.bandwidth()
    .attr("height", dataConfig.rectHeight.bind(dataConfig, /*scaled*/true, /*gIsData*/false)) // equiv : (d, i, g) => dataConfig.rectHeight(true, false, d, i, g);
    ;
  }

  let barWidth = dataConfig.rectWidth.bind(dataConfig, /*scaleX*/this.scales.xWidth, /*gIsData*/false);
  /** Use transition from width 0 when zooming out */
  (zoomingIn || idWidthChanged ? rm : r)
    .attr("width", dataConfig.barAsHeatmap ? 20 : barWidth);
  if (dataConfig.barAsHeatmap)
    ra
    .attr('fill', barWidth);
  rx
    /* quick fade out */
    .transition().duration(dataConfig.getTransitionTime() / 5)
    .attr('stroke-opacity', 0.25)
    .attr('fill-opacity', 0.25)
    .remove()
  ;
  if (trace > 1) {
    dLog(rs.nodes(), re.nodes());
  }
};

/** A single horizontal line for each data point.
 * Position is similar to the rectangle which would be drawn by bars():
 * X limits are the same as the rectangle limits (left, right)
 * and Y position is at the middle of the equivalent rectangle.
 */
ChartLine.prototype.linebars = function (data)
{
  let
    dataConfig = this.dataConfig,
  block = this.block,
  scales = this.scales,
  g = this.g;
  let
    rs = g
  // .select("g." + className + " > g")
    .selectAll("path." + dataConfig.barClassName)
    .data(data, dataConfig.keyFn.bind(dataConfig)),
  re =  rs.enter(), rx = rs.exit();
  let datum2LocationScaled = scaleMaybeInterval(dataConfig.datum2Location, scales.y);
  let line = d3.line();

  function horizLine(d, i, g) {
    let barWidth = dataConfig.rectWidth(/*scaleX*/scales.xWidth, /*gIsData*/false, d, i, g);
    let y = middle(datum2LocationScaled(d)),
    l =  line([
      [0, y],
      [barWidth, y]]);
    return [l];
  }

  let ra = re
    .append("path");
  ra
    .attr("class", dataConfig.barClassName)
  // same comment re parent datum as for bars()
    .each(function (d) { configureHorizTickHover.apply(this, [d, block, dataConfig.hoverTextFn]); });
  ra
    .merge(rs)
    .transition().duration(dataConfig.getTransitionTime())
    .attr('d', horizLine)
    .attr("stroke", (d) => this.blockColour())
  ;

  rx.remove();
  if (trace > 1) {
    dLog(rs.nodes(), re.nodes());
  }
};

/** Calculate the domain of some function of the data, which may be the data value or location.
 * This can be used in independent of axis-chart, and can be factored out
 * for more general use, along with Chart1:domain().
 * @param valueFn  e.g. datum2Location or datum2Value
 * In axis-chart, value is x, location is y.
 */
ChartLine.prototype.domain = function (valueFn, data)
{
  let
    /** location may be an interval, so flatten the result.
     * Later Array.flat() can be used.
     * Value is not an interval (yet), so that .reduce is a no-op).
     */
    yFlat = data
    .map(valueFn)
    .reduce((acc, val) => acc.concat(val), []);
  let domain = d3.extent(yFlat);
  if (trace > 1) {
    console.log('ChartLine domain', domain, yFlat);
  }
  return domain;
};

ChartLine.prototype.line = function (data)
{
  let y = this.scales.y, dataConfig = this.dataConfig;
  let x = this.scales.x = this.scales.xWidth;

  let datum2LocationScaled = scaleMaybeInterval(dataConfig.datum2Location, y);
  let line = d3.line()
    .x(dataConfig.rectWidth.bind(dataConfig, /*scaleX*/x, /*gIsData*/false))
    .y((d) => middle(datum2LocationScaled(d)));

  console.log("line x domain", x.domain(), x.range());

  let
    g = this.g,
  ps = g
    .selectAll("g > path." + dataConfig.barClassName)
    .data([this]);
  ps
    .enter()
    .append("path")
    .attr("class", dataConfig.barClassName + " line")
    .attr("stroke", (d) => this.blockColour())
    /* line is a single path for all data points; .datum() doesn't receive a keyFn.
     * d3 does some tweening in the transition, but it is not closely connected
     * to the insertion / deletion of data points.
     */
    .datum(data)
    .attr("d", line)
    .merge(ps)
    .datum(data)
    .transition().duration(dataConfig.getTransitionTime())
    .attr("d", line);
  // data length is constant 1, so .remove() is not needed
  ps.exit().remove();
};



/** Draw, using .currentData, which is set by calling .filterToZoom().
 * @param barsLine	if true, draw .bars, otherwise .line.
 */
ChartLine.prototype.drawContent = function(barsLine)
{
  let 
    /** could pick up data from this.g.data(). */
    data = this.currentData;
  if (data) {
    /** The Effects probabilities data is keyed by a location which is a SNP, so linebars() is a sensible representaion.
     * This uses the data shape to recognise Effects data; this is provisional
     * - we can probably lookup the tag 'EffectsPlus' in dataset tags (refn resources/tools/dev/effects2Dataset.pl).
     * The effects data takes the form of an array of 5 probabilities, in the 3rd element of feature.value.
     * Generalising this : the array can be any length; each value will be plotted in a separate line.
     * (currently just the first value is plotted).
     */
    let isEffectsData = data.length && data[0].name && data[0].value && (data[0].value.length === 3) && (data[0].value[2].length > 0 /*=== 6*/);
    let bars = isEffectsData ? this.linebars : this.bars;
    let chartDraw = barsLine ? bars : this.line;
    /** featureCountData is drawn only when block.isZoomedOut, chartable data is always drawn.  */
    if (! this.block.get('isChartable') && ! this.block.get('isZoomedOut'))
      data = [];
    chartDraw.apply(this, [data]);
  }
};

/** Remove the g.chart-line added via Chart1.prototype.group */
ChartLine.prototype.remove = function() {
  dLog('remove', this.g.node());
  this.g.remove();
}



/*----------------------------------------------------------------------------*/

DataConfig.prototype.isFeaturesCounts = function () {
  return this.dataTypeName.startsWith('featureCount');
}

DataConfig.prototype.keyFn = function (d, i, g) {
  let key = this.datum2Location(d, i, g);
  /** looking at d3 bindKey() : it appends the result of the key function to
   * "$", which works fine for both a single-value location and an interval;
   * e.g. the interval [54.7, 64.8] -> keyValue "$54.7,64.8". Including the
   * upper bound of the interval may improvide the identifying power of the key
   * in some cases.  If there was a problem with this, an interval can be
   * reduced to a single value, i.e.
  if (key.length)
    key = key[0]; */
  return key;
};

/** Calculate the width of rectangle to be used for this data point
 * @param this  is DataConfig, not DOM element.
 * @param scaleX  undefined, or apply scaleX (x) to the result
 * @param gIsData true means g is __data__, otherwise it is DOM element, and has .__data__ attribute.
 * gIsData will be true when called from d3.max(), and false for d3 attr functions.
 */
DataConfig.prototype.rectWidth = function (scaleX, gIsData, d, i, g)
{
  assert('rectWidth arguments.length === 5', arguments.length === 5);
  let d2v = this.datum2Value,
  width = d2v(d);
  if (this.valueIsArea) {
    /** the last bucket of GM has 0 height : id: {min: 238.2272359, max: 238.2272359}, so treat it as 1. */
    let h = this.rectHeight(false, gIsData, d, i, g);
    // Factor the width consistently by h, don't sometimes use scaled (i.e. pass scaled==false).
    width /= (h || 1);
    // dLog('rectWidth', h, width, gIsData);
  }
  if (scaleX) {
    width = scaleX(width);
  }
  return width;
};
/** Calculate the height of rectangle to be used for this data point
 * @param this  is DataConfig, not DOM element.
 * @param scaled  true means apply scale (y) to the result
 * @param gIsData true means g is __data__, otherwise it is DOM element, and has .__data__ attribute.
 * gIsData will be true when called from d3.max(), and false for d3 attr functions.
 */
DataConfig.prototype.rectHeight = function (scaled, gIsData, d, i, g)
{
  const fnName = 'rectHeight';
  assert('rectHeight arguments.length === 5', arguments.length === 5);
  let height,
  d2l = (scaled ? this.datum2LocationScaled : this.datum2Location),
  location;
  /* if location is an interval, calculate height from it.
   * Otherwise, use adjacent points to indicate height.
   */
  if ((location = d2l(d)).length) {
    height = Math.abs(location[1] - location[0]);
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
        r.map(d2l);
      height = Math.abs(y[y.length-1] - y[0]) * 2 / (y.length-1);
      if (trace > 2) {
        dLog('rectHeight', gIsData, d, i, /*g,*/ r, y, height);
      }
      if (! height)
        height = 1;
    }
  }
  if (trace && isNaN(height)) {
    dLog(fnName, location, scaled, gIsData, d, i);
  }
  return height;
};

DataConfig.prototype.addedDefaults = function(valueName) {
  if (! this.hoverTextFn)
    this.hoverTextFn = hoverTextFn;
  if (this.valueIsArea === undefined)
    this.valueIsArea = false;

  if (! this.barClassName)
    this.barClassName = classNameSub;
  if (! this.valueName)
    this.valueName = valueName || "Values";
};

/*----------------------------------------------------------------------------*/


/* layoutAndDrawChart() has been split into class methods of AxisCharts and Chart1,
 * and replaced with a proxy which calls them, and can next be re-distributed into axis-chart. */
export { AxisCharts, /*AxisChart,*/ className, Chart1 };
