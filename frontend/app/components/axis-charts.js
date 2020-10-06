import Ember from 'ember';
const { inject: { service } } = Ember;

import InAxis from './in-axis';
import { className, AxisCharts, Chart1 } from '../utils/draw/chart1';
import { DataConfig, dataConfigs, blockData, parsedData } from '../utils/data-types';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;


/*----------------------------------------------------------------------------*/


/* global d3 */

/** Display data which has a numeric value for each y axis position (feature).
 * Shown as a line curve or bar chart, with the y axis of the graph as the baseline.
 *
 * @param block	a block returned by viewedChartable()
 * @param chart data (field name is className); may be either :
 * result of parseTextData() : array of {name : , value : , description : }
 * or chartBlock passed in : .features
 * @param axis  axisComponent;   parent axis-2d component -	
 * @param gContainer  -	
 * @param axisID  axisID  -	local value ?
 * @param data oa -	
 * @param width resizedWidth
 *----------------
 * data attributes created locally, not passed in :
 * @param charts  map of Chart1, indexed by typeName
 * @param blocksData  map of features, indexed by typeName, blockId,
 */
export default InAxis.extend({
  blockService: service('data/block'),

  className : className,

  /** blocks-view sets blocksData[blockId]. */
  blocksData : undefined,
  /** {dataTypeName : Chart1, ... } */
  charts : undefined,

  didReceiveAttrs() {
    this._super(...arguments);

    this.createAttributes();
  },

  createAttributes() {
    /** these objects persist for the life of the object. */
    if (! this.get('blocksData')) {
      this.set('blocksData', Ember.Object.create());
      this.set('charts', Ember.Object.create());
      // axisID isn't planned to change for this component
      this.set('axisCharts',  new AxisCharts(this.get('axisID')));
    }
  },

  didRender() {
    console.log("components/axis-chart didRender()", this.get('axisID'));

    let axisID = this.get('axisID'),
    axisCharts = this.get('axisCharts'),
    gAxis = axisCharts && axisCharts.selectParentContainer(axisID);
    if (! gAxis.empty())
      this.draw();
    else
      Ember.run.later(() => this.draw(), 500);
  },
  willDestroyElement() {
    console.log("components/axis-chart willDestroyElement()");
    this.undraw();

    this._super(...arguments);
  },


  axisID : Ember.computed.alias('axis.axisID'),

  gAxis : Ember.computed('axisID', function () {
    let axisID = this.get('axisID');
    let axisCharts = this.get('axisCharts');
    let gAxis = axisCharts.selectParentContainer(axisID);
    return gAxis;
  }),

  yAxesScales : Ember.computed('data', function () {
    let oa = this.get('data');
    return oa.y;
  }),
  yAxisScale : Ember.computed('axisID', 'yAxesScales', function () {
    let yAxesScales = this.get('yAxesScales'),
    axisID = this.get('axisID'),
    yAxis = yAxesScales[axisID];
    dLog('yAxisScale', axisID, yAxis && yAxis.domain());
    return yAxis;
  }),


  chartTypes : Ember.computed('blocksData.@each', function () {
    let blocksData = this.get('blocksData'),
    chartTypes = Object.keys(blocksData);
    dLog('chartTypes', chartTypes);
    return chartTypes;
  }),
  chartsArray : Ember.computed('chartTypes.[]',  function () {
    /* The result is roughly equivalent to Object.values(this.get('charts')),
     * but for any chartType which doesn't have an element in .charts, add
     * it. */
    let
      chartTypes = this.get('chartTypes'),
    charts = chartTypes.map((typeName) => {
      let chart = this.charts[typeName];
      if (! chart) {
        let
        dataConfig = dataConfigs[typeName];
        /** at this time axisCharts.dom is empty, and chartsArray is not updated because chartTypes is constant.
            parentG = this.get('axisCharts.dom.g'); // this.get('gAxis'),
         */
        chart = this.charts[typeName] = new Chart1(/*parentG*/undefined, dataConfig);
        let axisCharts = this.get('axisCharts');
        chart.overlap(axisCharts);
      }
      return chart;
    });
    return charts;
  }),



  /** Retrieve charts handles from the DOM.
   * This could be used as verification - the result should be the same as
   * this.get('chartsArray').
   */
  chartHandlesFromDom () {
    /** this value is currently the g.axis-outer, which is 2
     * levels out from the g.axis-use, so this is a misnomer - 
     * will change either the name or the value.
     * The result is the same because there is just 1 g.chart inside 'g.axis-outer > g.axis-all > g.axis-use'.
     */
    let axisUse = this.get('axis.axisUse'),
    g = axisUse.selectAll('g.chart > g[clip-path] > g'),
    charts = g.data();
    return charts;
  },

  resizeEffectHere : Ember.computed('resizeEffect', function () {
    dLog('resizeEffectHere in axis-charts', this.get('axisID'));
  }),
  zoomedDomainEffect : Ember.computed('zoomedDomain', function () {
    dLog('zoomedDomainEffect in axis-charts', this.get('axisID'));
    this.drawContent();
  }),

  draw() {
    // probably this function can be factored out as AxisCharts:draw()
    let axisCharts = this.get('axisCharts'),
    charts = this.get('charts'),
    /** [startOffset, width] */
    allocatedWidthCharts = this.get('allocatedWidth'),
    /** array of [startOffset, width]. */
    blocksWidths = this.get('axisBlocks.allocatedWidth'),
    axisBlocks=this.get('axisBlocks.blocks');
    let
    chartTypes = this.get('chartTypes'),
    /** equivalent logic applies in AxisCharts:getRanges2() to determine margin. */
    isFeaturesCounts = (chartTypes.length && chartTypes[0] === 'featureCountData'),
    frameWidth = isFeaturesCounts ?
      blocksWidths[0] :
      allocatedWidthCharts;
    /** this and showChartAxes / drawAxes will likely move into Chart1. */
    axisCharts.isFeaturesCounts = isFeaturesCounts;

    if (frameWidth < 50) {
      frameWidth = 50;
    }
    axisCharts.setupFrame(
      this.get('axisID'),
      charts, frameWidth);

    let
    // equiv : charts && Object.keys(charts).length,
    nCharts = chartTypes && chartTypes.length;
    if (nCharts)
      allocatedWidthCharts[1] = allocatedWidthCharts[1] / nCharts;
    chartTypes.forEach((typeName) => {
      // this function could be factored out as axis-chart:draw()
      let
        chart = charts[typeName];
      /*if (! chart.ranges)*/ {
        let
          blocksData = this.get('blocksData'),
        data = blocksData.get(typeName),
        dataConfig = chart.dataConfig;
        let blocks = this.get('blocks');
        /** later : bi = axisBlocks.indexOf(blocks[i])
         *  blocksWidths[bi][1] */
        let allocatedWidth = (typeName === 'featureCountData') ?
            blocksWidths[0][1] :
            allocatedWidthCharts[1];
        chart.setupChart(
          this.get('axisID'), axisCharts, data, blocks,
          dataConfig, this.get('yAxisScale'), allocatedWidth);

        chart.drawChart(axisCharts, data);
      }
    });

    /** drawAxes() uses the x scale updated in drawChart() -> prepareScales(), called above. */
    const showChartAxes = true;
    if (showChartAxes && ! isFeaturesCounts)
      axisCharts.drawAxes(charts);

    // place controls after the ChartLine-s group, so that the toggle is above the bars and can be accessed.
    axisCharts.controls();

  },

  undraw() {
    this.get('axisCharts').frameRemove();
  },

  drawContent() {
    let charts = this.get('chartsArray');
    /* y axis has been updated, so redrawing the content will update y positions. */
    if (charts)
      charts.forEach((chart) => chart.drawContent());
  },

  /** Called via in-axis:{zoomed or resized}() -> redrawDebounced() -> redrawOnce()
   * Redraw the chart content.
   * In the case of resize, the chart frame will need to be resized (not yet
   * done; the setup functions are designed to be called again - in that case
   * they will update sizes rather than add new elements).
   */
  redraw   : function(axisID, t) {
    this.drawContent();
  },
  /** for use with @see pasteProcess() */
  redraw_from_paste   : function(axisID, t) {
    let data = this.get(className),
    layoutAndDrawChart = this.get('layoutAndDrawChart');
    if (data) {
      console.log("redraw", this, (data === undefined) || data.length, axisID, t);
      if (data)
        layoutAndDrawChart.apply(this, [data, undefined]);
    }
  },

  /*--------------------------------------------------------------------------*/
  /* These 2 functions provide a way to paste an array of data to be plotted in the chart.
   * This was used in early prototype; an alternative is to use upload tab to
   * add a data block - maybe this more direct and lightweight approach could
   * have some use.
   */

  /** Convert input text to an array.
   * Used to process text from clip-board, by @see pasteProcess().
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

  /** this function was used in all cases in the original development, but is
   * now restricted to pasteProcess() / redraw_from_paste(); the paste
   * functionality is not a current focus, so this is not up to date with some
   * changes.
   */
  layoutAndDrawChart(chartData, dataTypeName) {
    let
      axisID = this.get("axisID"),
    axisCharts = this.get('axisCharts'),
    blocks = this.get('blocks'),
    yAxisScale = this.get('yAxisScale'),
    dataConfig = dataConfigs[dataTypeName],
    resizedWidth = this.get('width'),
    chart1 = this.get('charts')[dataTypeName];
    /* These have been split out of setupChart() and hence will need to be added as calls here :
     */
    chart1.overlap(axisCharts);
    axisCharts.controls();
    /* setupFrame() is now a method of AxisCharts;  setupChart() and drawChart() are now methods of Chart1.
     */
    chart1 = chart1.setupChart(
      axisID, axisCharts, chartData, blocks, dataConfig, yAxisScale, resizedWidth);
    chart1.drawChart(axisCharts, chartData);
    if (! this.get('charts') && chart1)
      this.set('charts', chart1);
  },


  /** Process text pasted into clipboard .pasteData
   * Used by InAxis : paste().
   *
   * If block is not defined, the template renders a content-editable for the
   * user to paste data into.  Use in prototype, not used currently.
   */
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
    layoutAndDrawChart.apply(this, [chart, 'parsedData']);

    this.set('data.chart', forTable);
  },

  /*--------------------------------------------------------------------------*/


});

