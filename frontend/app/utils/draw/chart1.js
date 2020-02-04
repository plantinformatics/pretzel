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
const useLocalY = false;

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
 * @param g parent of the chart. this is the <g> with clip-path #axis-chart-clip.
 */
function addParentClass(g) {
  let axisUse=g.node().parentElement.parentElement,
  us=d3.select(axisUse);
  us.classed('hasChart', true);
  console.log('addParentClass', us.node());
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

class ChartLine {
  constructor(dataConfig, scales) {
      this.dataConfig = dataConfig;
      /* the scales have the same .range() as the parent Chart1, but the .domain() varies. */
      this.scales = scales; // Object.assign({}, scales);
  }
}

/*----------------------------------------------------------------------------*/

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

/** Determine the appropriate DataConfig for the given data.
 */
function blockDataConfig(chart) {
  let
  isBlockData = chart.length && (chart[0].description === undefined);

  let dataConfigProperties = isBlockData ? blockData : parsedData;
  return dataConfigProperties;
}




/*----------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------*/

class AxisCharts {
  /*
  ranges;  // .bbox, .height
  dom;  // .gs, .gsa, 
   */

  constructor(axisID) {
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
 */
function setupFrame(axisID, axisCharts, charts, allocatedWidth)
{
  axisCharts.setup(axisID);

  let resizedWidth = allocatedWidth[1];
  axisCharts.getRanges3(resizedWidth);

  // axisCharts.size(this.get('yAxisScale'), /*axisID, gAxis,*/   chartData, resizedWidth);  //  -	split size/width and data/draw

  axisCharts.commonFrame(/*axisID, gAxis*/);

  // equivalent to addParentClass();
  axisCharts.dom.gAxis.classed('hasChart', true);

  axisCharts.frame(axisCharts.ranges.bbox, charts, allocatedWidth);

  axisCharts.getRanges2();
}
function setupChart(axisID, axisCharts, chart1, chartData, blocks, dataConfig, yAxisScale, resizedWidth)
{
  // Plan is for Axischarts to own .ranges, but for now there is some overlap.
  if (! chart1.ranges) {
    chart1.ranges = axisCharts.ranges;
    chart1.dom = axisCharts.dom;
  }
  chart1.scales.yAxis = yAxisScale;

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
    chart1.createLine(blockId, block);
  });
  chart1.group(axisCharts.dom.gca, 'chart-line');
  // place controls after the ChartLine-s group, so that the toggle is above the bars and can be accessed.
  axisCharts.controls();
  //----------------------------------------------------------------------------



  chart1.getRanges(axisCharts.ranges, chartData);

  return chart1;
};

function drawChart(axisCharts, chart1, chartData)
{
  /** possibly don't (yet) have chartData for each of blocks[],
   * i.e. blocksById may be a subset of blocks.mapBy('id').
    */
  let blockIds = Object.keys(chartData);
  blockIds.forEach((blockId) => {
    chart1.data(blockId, chartData[blockId]);
  });

  chart1.prepareScales(chartData, axisCharts.ranges.drawSize);
  blockIds.forEach((blockId) => {
    chart1.chartLines[blockId].scaledConfig(); } );

  chart1.drawContent();
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

    ranges.pxSize = (yDomain[1] - yDomain[0]) / ranges.bbox.height;
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
ChartLine.prototype.setup = function(blockId) {
  /* Some types (blockData, parsedData) require a block to lookup the feature
   * name for location.  They are denoted by .datum2Location not being in their
   * pre-defined config.
   */
  if (! this.dataConfig.datum2Location) {
    // copy dataConfig to give a custom value to this ChartLine.
    let d = new DataConfig(this.dataConfig);
      d.datum2Location = 
      (d) => datum2LocationWithBlock(d, blockId);
    this.dataConfig = d;
  }
};
/** Filter given data according to this.scales.yAxis.domain()
 * and set .currentData
 */
ChartLine.prototype.filterToZoom = function(chart) {
    let
    {yAxis} = this.scales,
    yDomain = yAxis.domain(),
    withinZoomRegion = (d) => {
      return inRangeEither(this.dataConfig.datum2Location(d), yDomain);
    },
    data = chart.filter(withinZoomRegion);
    this.currentData = data;

    dLog(yDomain, data.length, (data.length == 0) || this.dataConfig.datum2Location(data[0]));
  return data;
};

AxisCharts.prototype.getRanges3 = function (resizedWidth) {
  if (resizedWidth) {
    let
    {bbox} = this.ranges;
    bbox.width = resizedWidth;
    dLog('resizedWidth', resizedWidth, bbox);
  }
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
      this.chartLines = {};
      /* yAxis is imported, x & yLine are calculated locally.
       * y is used for drawing - it refers to yAxis or yLine.
       * yLine would be used for .line() if yBand / scaleBand was used for .bars().
       */
      this.scales = { /* yAxis, x, y, yLine */ };
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
      scales = this.scales,
      width = drawSize.width,
      height = drawSize.height,
      xRange = [0, width],
      yRange = [0, height],
      // yRange is used as range of yLine by this.scaleLinear().
      /* scaleBand would suit a data set with evenly spaced or ordinal / nominal y values.
       * yBand = d3.scaleBand().rangeRound(yRange).padding(0.1),
       */
      y = useLocalY ? this.scaleLinear(yRange, data) : scales.yAxis;
      scales.xWidth = 
       d3.scaleLinear().rangeRound(xRange);
      if (dataConfig.barAsHeatmap) {
        scales.xColour = d3.scaleOrdinal().range(d3.schemeCategory20);
      }
      // datum2LocationScaled() uses me.scales.x rather than the value in the closure in which it was created.
      scales.x = dataConfig.barAsHeatmap ? scales.xColour : scales.xWidth;

      // Used by bars() - could be moved there, along with  datum2LocationScaled().
      scales.y = y;
      console.log("Chart1", xRange, yRange, dataConfig.dataTypeName);

      let
        valueWidthFn = dataConfig.rectWidth.bind(dataConfig, /*scaled*/false, /*gIsData*/true),
      valueCombinedDomain = this.domain(valueWidthFn, data);
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
    /** Enables use of the scales which are set up in .prepareScales().
     */
    ChartLine.prototype.scaledConfig = function ()
    {
      let
        dataConfig = this.dataConfig,
        scales = this.scales;

      /* these can be renamed datum2{abscissa,ordinate}{,Scaled}() */
      /* apply y after scale applied by datum2Location */
      let datum2LocationScaled = scaleMaybeInterval(dataConfig.datum2Location, scales.y);
      /** related @see rectWidth().  */
      function datum2ValueScaled(d) { return scales.x(dataConfig.datum2Value(d)); }
      dataConfig.datum2LocationScaled = datum2LocationScaled;
      dataConfig.datum2ValueScaled = datum2ValueScaled;
    };

Chart1.prototype.group = function (parentG, groupClassName) {
      /** parentG is g.{{dataTypeName}}, within : g.axis-use > g.chart > g[clip-path] > g.{{dataTypeName}}.
       * add g.(groupClassName);
       * within g.axis-use there is also a sibling g.axis-html. */
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
    .attr('id', (chartLine) => groupClassName + '-' + chartLine.block.id)
    // .data((chartLine) => chartLine.currentData)
  ,
  // parentG.selectAll("g > g." + groupClassName); // 
  g = gsa.merge(gs);
  dLog('group', this, parentG.node(), parentG, g.node());
      this.dom.g = g;
      this.dom.gs = gs;
      this.dom.gsa = gsa;
  // set ChartLine .g;   used by ChartLine.{lines,bars}.
  gsa.each(function(chartLine, i) { chartLine.g = d3.select(this) ; } );
  return g;
};

AxisCharts.prototype.drawAxes = function (charts) {
  let
      dom = this.dom,
      /** the axes were originally within the gs,gsa of .group();  hence the var names.
       * gs selects the <g> into which the axes will be inserted, and gpa is the
       * .enter().append() of that selection.
       */
      gs = dom.gc,
  gsa = dom.gca;
  gsa.each(Chart1.prototype.drawAxes);
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
  if (block) {
    chartLine.block = block;
    chartLine.setup(blockId);
    // .setup() will copy dataConfig if need for custom config.
  }
};
Chart1.prototype.data = function (blockId, data)
{
  let chartLine = this.chartLines[blockId];

  function m(d) { return middle(chartLine.dataConfig.datum2Location(d)); }
  data = data.sort((a,b) => m(a) - m(b));
  data = chartLine.filterToZoom(data);
};
/** Draw a single ChartLine of this chart.
 * To draw all ChartLine of this chart, @see Chart1:drawContent()
 */
Chart1.prototype.drawLine = function (blockId, block, data)
{
  let chartLine = this.chartLines[blockId];
  chartLine.drawContent(this.barsLine);
};
    ChartLine.prototype.bars = function (data)
    {
      let
        dataConfig = this.dataConfig,
      block = this.block,
      g = this.g;
      if (dataConfig.barAsHeatmap)
        this.scales.x = this.scales.xColour;
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
        .attr("height", dataConfig.rectHeight.bind(dataConfig, /*scaled*/true, /*gIsData*/false)) // equiv : (d, i, g) => dataConfig.rectHeight(true, false, d, i, g);
      ;
      let barWidth = dataConfig.rectWidth.bind(dataConfig, /*scaled*/true, /*gIsData*/false);
      ra
        .attr("width", dataConfig.barAsHeatmap ? 20 : barWidth);
      if (dataConfig.barAsHeatmap)
      ra
        .attr('fill', barWidth);
      rx.remove();
      console.log(rs.nodes(), re.nodes());
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
        .data(data),
      re =  rs.enter(), rx = rs.exit();
      let datum2LocationScaled = scaleMaybeInterval(dataConfig.datum2Location, scales.y);
      let line = d3.line();

      function horizLine(d, i, g) {
        let barWidth = dataConfig.rectWidth(/*scaled*/true, /*gIsData*/false, d, i, g);
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
        .transition().duration(1500)
        .attr('d', horizLine)
        .attr("stroke", 'red')
      ;

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
        // Factor the width consistently by h, don't sometimes use scaled (i.e. pass scaled==false).
        width /= (h = this.rectHeight(false, gIsData, d, i, g));
        // dLog('rectWidth', h, width, gIsData);
      }
      return width;
    };
    /** Calculate the height of rectangle to be used for this data point
     * @param this  is DataConfig, not DOM element.
     * @param scaled  true means apply scale (y) to the result
     * @param gIsData true meangs g is __data__, otherwise it is DOM element, and has .__data__ attribute.
     * gIsData will be true when called from d3.max(), and false for d3 attr functions.
     */
    DataConfig.prototype.rectHeight = function (scaled, gIsData, d, i, g)
    {
      Ember.assert('rectHeight arguments.length === 5', arguments.length === 5);
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
      console.log('ChartLine domain', domain, yFlat);
      return domain;
    };
    ChartLine.prototype.line = function (data)
    {
      let y = this.scales.y, dataConfig = this.dataConfig;
      this.scales.x = this.scales.xWidth;

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
      Object.keys(this.chartLines).forEach((blockId) => {
        let chartLine = this.chartLines[blockId];
        chartLine.drawContent(this.barsLine);
      });
    };
    /** Draw, using .currentData, which is set by calling .filterToZoom().
     * @param barsLine	if true, draw .bars, otherwise .line.
     */
    ChartLine.prototype.drawContent = function(barsLine)
    {
      let 
        data = this.currentData;
      /** The effects data takes the form of an array of 5 probabilities, in the 3rd element of feature.value */
      let isEffectsData = data.length && data[0].name && data[0].value && (data[0].value.length === 3) && (data[0].value[2].length === 6);
      let bars = isEffectsData ? this.linebars : this.bars;
      let chartDraw = barsLine ? bars : this.line;
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
  this.dom.gps = gps;
  this.dom.gp = gp;
};

AxisCharts.prototype.frame = function container(bbox, charts, allocatedWidth)
{
  let
  gps = this.dom.gps,
  gp = this.dom.gp;

    /** datum is axisID, so id and clip-path can be functions.
     * e.g. this.dom.gp.data() is [axisID]
     */
    function axisClipId(axisID) { return "axis-chart-clip-" + axisID; }
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
  let [startOffset, width] = allocatedWidth;
  let gca =
    gp.append("g")
      .attr("clip-path", (d) => "url(#" + axisClipId(d) + ")") // clip with the rectangle
      .selectAll("g[clip-path]")
      .data(Object.values(charts))
      .enter()
      .append("g")
      .attr('class', (d) => d.dataConfig.dataTypeName)
      .attr("transform", (d, i) => "translate(" + (startOffset + (i * 30)) + ", 0)")
  ;

    let g = 
      gps.merge(gp).selectAll("g." + className+  " > g");
  if (! gp.empty() ) {
    addParentClass(g);
    /* .gc is <g clip-path=​"url(#axis-chart-clip-{{axisID}})​">​</g>​
     * .g (assigned later) is g.axis-chart
.chart-line ?
     * .gca contains a g for each chartType / dataTypeName, i.e. per Chart1.
     */
    this.dom.gc = g;
    this.dom.gca = gca;
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

AxisCharts.prototype.controls = function controls()
{
  let
    bbox = this.ranges.bbox,
  gp = this.dom.gca,
  gps = this.dom.gc;

    function toggleBarsLineClosure(chart /*, i, g*/)
    {
      chart.toggleBarsLine();
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
    .classed("pushed", (chart1) => { return chart1.barsLine; });
  chartTypeToggle.each(function(chart) { chart.chartTypeToggle = d3.select(this); } );
};

/*----------------------------------------------------------------------------*/

/* layoutAndDrawChart() has been split into class methods of AxisCharts and Chart1,
 * and replaced with a proxy which calls them, and can next be re-distributed into axis-chart. */
export { setupFrame, setupChart, drawChart, AxisCharts, /*AxisChart,*/ className, Chart1, DataConfig, blockData, parsedData };
