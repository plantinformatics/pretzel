import Ember from 'ember';
const { inject: { service } } = Ember;

import { className, AxisCharts, setupFrame, setupChart, drawChart, Chart1, DataConfig, blockData, parsedData } from '../utils/draw/chart1';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** example element of array f : */
const featureCountDataExample = 
  {
    "_id": {
      "min": 100,
      "max": 160
    },
    "count": 109
  };

const featureCountDataProperties = {
  dataTypeName : 'featureCountData',
  datum2Location : function datum2Location(d) { return [d._id.min, d._id.max]; },
  datum2Value : function(d) { return d.count; },
  /** datum2Description() is not used;  possibly intended for the same
   * purpose as hoverTextFn(), so they could be assimilated.  */
  datum2Description : function(d) { return JSON.stringify(d._id); },
  hoverTextFn : function (d, block) {
    let valueText = '[' + d._id.min + ',' + d._id.max + '] : ' + d.count,
    blockName = block.view && block.view.longName();
    return valueText + '\n' + blockName;
  },
  valueIsArea : true
};

const dataConfigs = 
  [featureCountDataProperties, blockData, parsedData]
  .reduce((result, properties) => { result[properties.dataTypeName] = new DataConfig(properties); return result; }, [] );



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
export default Ember.Component.extend({
  blockService: service('data/block'),

  className : className,

  /** blocks-view sets blocksData[blockId]. */
  blocksData : undefined,
  /** {dataTypeName : Chart1, ... } */
  charts : undefined,

  init() {
    this._super(...arguments);
    this.set('blocksData', Ember.Object.create());
    this.set('charts', Ember.Object.create());
  },

  didRender() {
    console.log("components/axis-chart didRender()");
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

  axisCharts : Ember.computed(function () {
    return new AxisCharts(this.get('axisID'));
  }),


  chartTypes : Ember.computed('blocksData.@each', function () {
    let blocksData = this.get('blocksData'),
    chartTypes = Object.keys(blocksData);
    dLog('chartTypes', chartTypes);
    return chartTypes;
  }),

  chartTypesEffect : Ember.computed('chartTypes.[]', function () {
    let blocksData = this.get('blocksData'),
    chartTypes = this.get('chartTypes'),
    charts = this.get('charts');
        let axisCharts = this.get('axisCharts');

    chartTypes.forEach((typeName) => {
      if (! charts[typeName]) {
        let data = blocksData.get(typeName),
        /** same as Chart1.blockIds(). */
        blockIds = Object.keys(data),
        /** may use firstBlock for isBlockData. */
        firstBlock = data[blockIds[0]],

        dataConfig = dataConfigs[typeName],
        parentG = this.get('axisCharts.dom.g'), // this.get('gAxis'),
        chart = new Chart1(parentG, dataConfig);
        charts[typeName] = chart;
      }
    });
    setupFrame(
      this.get('axisID'), axisCharts,
      charts, /*resizedWidth*/undefined);


    chartTypes.forEach((typeName) => {
      let
        chart = charts[typeName];
      if (! chart.ranges) {
        let data = blocksData.get(typeName),
          dataConfig = chart.dataConfig;
        let blocks = this.get('blocks');

        setupChart(
          this.get('axisID'), axisCharts, chart, data,
          dataConfig, this.get('yAxisScale'), /*resizedWidth*/undefined);

        drawChart(axisCharts, chart, data, blocks);
      }
    });
    const showChartAxes = true;
    if (showChartAxes)
      axisCharts.drawAxes(charts);

    return chartTypes;
  }),

  drawBlockFeaturesCounts : function(featuresCounts) {
    if (! featuresCounts)
      featuresCounts = this.get('featuresCounts');
    let domain = this.get('axis.axis1d.domainChanged');
    if (featuresCounts) {
      console.log('drawBlockFeaturesCounts', featuresCounts.length, domain, this.get('block.id'));

      // pass alternate dataConfig to layoutAndDrawChart(), defining alternate functions for {datum2Value, datum2Location }
      this.layoutAndDrawChart(featuresCounts, 'featureCountData');
    }
  },


  redraw   : function(axisID, t) {
    let data = this.get(className),
    layoutAndDrawChart = this.get('layoutAndDrawChart');
    if (data) {
    console.log("redraw", this, (data === undefined) || data.length, axisID, t);
    if (data)
      layoutAndDrawChart.apply(this, [data, undefined]);
    }
    else {  // use block.features or block.featuresCounts when not using data parsed from table.
      if (this.get('block.isChartable'))
        this.drawBlockFeatures0();
      else
        this.drawBlockFeaturesCounts();
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

  layoutAndDrawChart(chartData, dataTypeName) {
    let
      axisID = this.get("axisID"),
    axisCharts = this.get('axisCharts'),
    blocks = this.get('blocks'),
    yAxisScale = this.get('yAxisScale'),
    dataConfig = dataConfigs[dataTypeName],
    resizedWidth = this.get('width'),
    chart1 = this.get('charts')[dataTypeName];
    chart1 = setupChart(
      axisID, axisCharts, chart1, chartData, dataConfig, yAxisScale, resizedWidth);
    drawChart(axisCharts, chart1, chartData, blocks);
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

