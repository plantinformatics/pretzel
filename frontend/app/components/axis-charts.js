import { alias, filter } from '@ember/object/computed';
import { later, bind, next } from '@ember/runloop';
import EmberObject, { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import { union, difference } from 'lodash/array';

import InAxis from './in-axis';
import { className, AxisCharts, Chart1 } from '../utils/draw/chart1';
import {
  DataConfig,
  dataConfigs,
  blockData,
  parsedData
} from '../utils/data-types';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

const showToggleBarLine = false;

const CompName = 'components/axis-charts';

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
 * @param charts  map of Chart1, indexed by dataTypeName
 * @param blocksData  map of features, indexed by dataTypeName, blockId,
 */
export default InAxis.extend({
  blockService: service('data/block'),
  controls : service(),
  axisZoom: service('data/axis-zoom'),

  className : className,

  chartBlocks : alias('axisBlocks.chartBlocks'),

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
      this.set('blocksData', EmberObject.create());
      this.set('charts', EmberObject.create());
      // axisID isn't planned to change for this component
      this.set('axisCharts',  new AxisCharts(this.axis.axis1d, this.get('axisID')));
    }
  },

  didRender() {
    this._super.apply(this, arguments);
    dLog(CompName + " didRender()", this.get('axisID'));

    if (! this.drawIfG()) {
      later(() => this.drawIfG(), 500);
    }
  },
  drawIfG() {
    let
    axisID = this.get('axisID'),
    axisCharts = this.get('axisCharts'),
    gAxis = axisCharts && axisCharts.selectParentContainer(axisID),
    ok = ! gAxis.empty();
    if (ok) {
      this.draw();
    }
    return ok;
  },
  willDestroyElement() {
    dLog(CompName + " willDestroyElement()");
    this.undraw();

    this._super(...arguments);
  },


  axisID : alias('axis.axisID'),

  gAxis : computed('axisID', function () {
    let axisID = this.get('axisID');
    let axisCharts = this.get('axisCharts');
    let gAxis = axisCharts.selectParentContainer(axisID);
    return gAxis;
  }),

  yAxisScale : alias('axis.axis1d.y'),

  get transitionTime() {
    return this.get('axisZoom.axisTransitionTime');
  },

  /** Similar to blockService.viewedChartable, but don't exclude blocks which
   * are .isZoomedOut.  This means the block-view continues to exist - it is not
   * destroyed / re-created as the user zooms in / out.
   */
  blockViews : computed(
    /** to get just the chartable blocks on this axis, using axis1d.dataBlocks instead of blockService.viewed */
    'axis1d.dataBlocks.@each.{featuresCounts,isChartable}',
    function () {
      let
      blocks =
        this.get('axis1d.dataBlocks')
        .filter(function (block) {
          let
          featuresCounts = !!block.get('featuresCounts'),
          line = block.get('isChartable');
          return featuresCounts || line;
        });
      dLog('blockViews', blocks, blocks.mapBy('datasetId.name'));
      return blocks;
    }),


  blocksDataCount : 0,
  chartTypesAll : computed(
    /** from fgrep dataTypeName frontend/app/utils/data-types.js */
    'blocksData.{parsedData,blockData,featureCountAutoData,featureCountData}',
    'blocksDataCount',
    function () {
    let blocksData = this.get('blocksData'),
    /** during operation, blocksData is acquiring these extra fields, since
     * upgrade to Ember3; may change Ember.Object.create() to {}, in conjunction
     * with changing .get accesses. */
    ignoreFields = ["_oldWillDestroy", "_super", "willDestroy"],
    chartTypes = Object.keys(blocksData)
      .filter((fieldName) => ignoreFields.indexOf(fieldName) === -1);
      if (Object.keys(blocksData).length > chartTypes.length) {
        dLog('chartTypes blocksData keys', Object.keys(blocksData));
      }
    dLog('chartTypes', chartTypes);
    return chartTypes;
  }),
  /** filter out {featureCountAutoData,featureCountData} - they are handled via featureCountBlocks and given 1 chart per block.  */
  chartTypes : filter('chartTypesAll', (dataTypeName) => ! dataTypeName.startsWith('featureCount')),

  /** Filter blocksData to just .{featureCountAutoData,featureCountData}
   */
  featureCountBlocks : computed(
    'blocksData.{featureCountAutoData,featureCountData}',
    'blocksDataCount',
    function () {
      let blocksData = this.get('blocksData'),
          typeBlockIds = 
          ['featureCountAutoData', 'featureCountData'].reduce(function (blocks, dataTypeName) {
            let blocksData1 = blocksData[dataTypeName];
            if (blocksData1) {
              blocks[dataTypeName] = Object.keys(blocksData1);
            }
            return blocks;
          }, {});
      return typeBlockIds;
    }),
  /** Number of blocks of type featureCount*Data  */
  nFeatureCountData : computed(
    'featureCountBlocks.{featureCountAutoData,featureCountData}.[]',
    function () { 
      let
      typeBlockIds = this.get('featureCountBlocks'),
      n = Object.keys(typeBlockIds).reduce(function (nBlocks, dataTypeName) {
        let blocksData1 = typeBlockIds[dataTypeName];
        if (blocksData1) {
          nBlocks += blocksData1.length;
        }
        return nBlocks;
      }, 0);
      return n;
    }),
  /** For each dataTypeName present in .blocksData, construct a Chart1, which
   * will contain one ChartLine per block.
   * For featureCount{,Auto}Data dataTypeName, after 327f2bcd, each block is
   * given its own block; this enables each block to be scaled independently
   * into a constant width.
   */
  chartsArray : computed(
    'chartTypes.[]',
    'featureCountBlocks.{featureCountAutoData,featureCountData}.[]',
    'chartBlocks.[]',
    function () {
      /* The result is roughly equivalent to Object.values(this.get('charts')),
       * but for any chartType which doesn't have an element in .charts, add
       * it. */
      let
      chartTypes = this.get('chartTypes'),
      typeBlockIds =  this.get('featureCountBlocks');

      let
      chartsAllBlocks = chartTypes
        .reduce((result, dataTypeName) => { if (! dataTypeName.startsWith('featureCount')) result.push(this.addChart(dataTypeName, dataTypeName)); return result;}, []),
      charts1Block = Object.keys(typeBlockIds).map((dataTypeName) => {
        let blockIds = typeBlockIds[dataTypeName];
        let
        /** draw() filters by axisBlocksIds, so do the same here. */
        axisBlocks=this.get('chartBlocks'),
        axisBlocksIds = axisBlocks.mapBy('id'),
        enabledBlockIds = blockIds.filter((blockId) => axisBlocksIds.includes(blockId))
        /** QTLs are display outside axis, no featuresCounts charts shown.  */
          .filter((blockId) => {
            let block = this.get('blockService').id2Block(blockId),
                ok = ! block || ! block.isQTL;
            return ok;
          }),
        addedCharts = enabledBlockIds.map((blockId) => {
          let chartName = dataTypeName + '_' + blockId;
          return this.addChart(dataTypeName, chartName);
        });
        return addedCharts;
      }),
      charts = [chartsAllBlocks, charts1Block].flat(2);

      return charts;
    }),

  /** chartsArray minus those which use space allocated by axisBlocks */
  chartsVariableWidth : filter('chartsArray',  (chart) => !chart.useAllocatedWidth()),
  /** chartsArray which use space allocated by axisBlocks */
  chartsFixedWidth : filter('chartsArray',  (chart) => chart.useAllocatedWidth()),

  addChart(dataTypeName, chartName) {
    let chart = this.charts[chartName];
    if (! chart) {
      let
      dataConfig = dataConfigs[dataTypeName];
      dataConfig.getTransitionTime ||= () => this.get('transitionTime');
      dataConfig.selectionToTransition ||= (selection) => this.get('axisZoom').selectionToTransition(selection);
      chart = this.charts[chartName] = new Chart1(dataConfig, chartName);
      chart.barsLine = this.get('chartBarLine');
      // for allocatedWidthForBlock().
      chart.axisBlocks = this.get('axisBlocks');
      chart.getAllocatedWidth = bind(this, this.getAllocatedWidth);
      dLog('chartsArray', dataTypeName, chartName, chart, this.charts, this);
      let axisCharts = this.get('axisCharts');
      chart.overlap(axisCharts);
    }
    return chart;
  },

  getAllocatedWidth() {
    let width = this.get('allocatedWidth');
    dLog('getAllocatedWidth', width);
    return width;
  },

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

  resizeEffectHere : computed('resizeEffect', function () {
    dLog('resizeEffectHere in axis-charts', this.get('axisID'));
  }),
  drawContentEffect : computed(
    /** .zoomedDomain is (via InAxis) axis1d.zoomedDomain; for this dependency use the -Debounced
     * and -Throttled so that it maintains a steady update and catches the last update.
     * equiv : this.axis1d.{zoomedDomainThrottled,zoomedDomainDebounced}
     */
  'axis1d.currentPosition.{yDomainDebounced,yDomainThrottled}',
  'axis1d.flipped',
  'axis1d.extended',
  'blockViews.@each.isZoomedOut',
    /** .@each.x.y is no longer supported; if these dependencies are needed, can
     * define block.featuresCounts{,Results}Length
     */
  'blockViews.@each.featuresCounts',
  'blockViews.@each.featuresCountsResults',
  // possibly add 'chartsArray.[]', 
  function () {
    dLog('drawContentEffect in axis-charts', this.get('axisID'));
    this.checkViewedContent();
    this.drawContent();
  }),

  draw() {
    // probably this function can be factored out as AxisCharts:draw()
    let axisCharts = this.get('axisCharts'),
    charts = this.get('charts'),
    trackWidth = this.get('trackWidth'),
    /** [startOffset, width] */
    allocatedWidthCharts = this.get('allocatedWidth'),
    /** array of [startOffset, width]. */
    blocksWidths = this.get('axisBlocks.allocatedWidth'),
    axisBlocks=this.get('chartBlocks');
    if (allocatedWidthCharts[1] === 0) {
      allocatedWidthCharts[1] = trackWidth * (2 + 1);
    }
    let
    chartTypes = this.get('chartTypes'),
    /** ensure .charts is populated for chartTypes. */
    chartsArray = this.get('chartsArray'),
    typeBlockIds = this.get('featureCountBlocks'),
    typeBlockIdsArray = Object.keys(typeBlockIds).map((dataTypeName) => typeBlockIds[dataTypeName]).flat(),
    nFeatureCountData = this.get('nFeatureCountData'),
    /** equivalent logic applies in AxisCharts:getRanges2() to determine margin. */
    isFeaturesCounts = nFeatureCountData > 0, // (chartTypes.length && chartTypes[0] === 'featureCountData'),
    frameWidth = isFeaturesCounts ?
      // blocksWidths[] is empty when !isZoomedOut().
      (blocksWidths && blocksWidths.length ? blocksWidths[0] : [0,0]) : 
      allocatedWidthCharts;
    /** this and showChartAxes / drawAxes will likely move into Chart1. */
    axisCharts.isFeaturesCounts = isFeaturesCounts;
    dLog('draw', axisCharts, charts, trackWidth, allocatedWidthCharts, blocksWidths, axisBlocks, chartTypes, isFeaturesCounts, frameWidth);
    axisCharts.setupFrame(
      this.get('axisID'),
      charts, frameWidth, this.get('yAxisScale'));

    let
    /** provide a comprehensive list of blocks for setupChart() to lookup by id.
     * This can include blocks which are ! isZoomedOut.
     */
    blocksAll = union(this.get('blocks'), axisBlocks),
    /** blocksAll minus featureCount blocks */
    blocksCharts = blocksAll.filter((block) => block.get('isChartable')),
    // equiv : charts && Object.keys(charts).length,
    nCharts = this.get('chartsVariableWidth.length');
    if (nCharts > 1) {
      // this is a CP result so copy before modifying.
      allocatedWidthCharts = allocatedWidthCharts.slice();
      allocatedWidthCharts[1] = allocatedWidthCharts[1] / nCharts;
    }
    dLog('draw blocksCharts', blocksCharts, typeBlockIds, typeBlockIdsArray, blocksAll, nCharts);

    /** later : bi = axisBlocks.indexOf(blocks[i])
     *  blocksWidths[bi][1] */
    let allocatedWidth = allocatedWidthCharts[1];

    if (blocksCharts.length) {
      chartTypes.forEach(
        (dataTypeName) => this.drawChart(dataTypeName, dataTypeName, allocatedWidth, blocksCharts));
    }

    // for featureCountData
    allocatedWidth = (blocksWidths && blocksWidths.length ? blocksWidths[0][1] : 0);
    let axisBlocksIds = axisBlocks.mapBy('id');
    Object.keys(typeBlockIds).forEach((dataTypeName) => {
      let blockIds = typeBlockIds[dataTypeName];
      blockIds.forEach((blockId) => {
        if (typeBlockIdsArray.indexOf(blockId) !== -1) {
          let chartName = dataTypeName + '_' + blockId;
          if (axisBlocksIds.indexOf(blockId) === -1) {
            this.removeChartLine(chartName, blockId);
          } else {
          this.drawChart(dataTypeName, chartName, allocatedWidth, [this.get('blockService').id2Block(blockId)]);
          }
        }
      });
    });

    this.reportWidth();

    /** drawAxes() uses the x scale updated in drawChart() -> prepareScales(), called above. */
    const showChartAxes = true;
    if (showChartAxes && ! isFeaturesCounts)
      axisCharts.drawAxes(charts);

    // place controls after the ChartLine-s group, so that the toggle is above the bars and can be accessed.
    if (showToggleBarLine) {
      axisCharts.controls();
    }

  },

  /** Calculate the sum of chart widths and report it via childWidths to axis-2d. */
  reportWidth() {
    let
    charts = this.get('chartsVariableWidth'),
    chartWidths = charts.mapBy('allocatedWidth')
      .filter((aw) => aw),
    widthSum = chartWidths.reduce((sum, w) => sum += w, 0),
    chartWidth = this.childWidths.get(className);
    if (chartWidth && chartWidth[1] !== widthSum) {
    // later allocate each chart, for separate offsets : (this.get('className') + '_' + chart.name)
    next(() => {
      let childWidths = this.get('childWidths'),
          className = this.get('className'),
          chartWidth = childWidths.get(className);
      if (! chartWidth /**|| chartWidth[1] !== widthSum*/) {
        childWidths.set(className, [widthSum, widthSum]);
      }
    });
    }
  },

  /**
   * @param allocatedWidth  width
   */
  drawChart(dataTypeName, chartName, allocatedWidth, blocksAll) {
    // this function could be factored out as axis-chart:draw()
    let
    axisCharts = this.get('axisCharts'),
    chart = this.get('charts')[chartName];
    if (chart)
    /*if (! chart.ranges)*/ {
      let
      blocksData = this.get('blocksData'),
      /** data is the (dataTypeName) data for all axes; blocksAll are the data blocks on this axis : chart.
       * {<blockId> : data array, ... }
       */
      data = blocksData.get(dataTypeName),
      yDomain = chart.scales.yAxis && chart.scales.yAxis.domain(),
      /** filtered by block.isViewed and by y domain of data.
       * (called y because the chart is displayed rotated 90deg; it is the
       * domain of the data, not co-domain / range).
       * Result form is the same as data, i.e. {<blockId> : data array, ... }
       */
      filteredData = blocksAll.reduce((filtered, block) => {
        if (data[block.id] && block.get('isViewed')) {
          let db = data[block.id];
          if (yDomain) {
            db = db.filter(Chart1.withinZoomRegion(chart.dataConfig, yDomain));
          }
          filtered[block.id] = db;
        }
        return filtered;
      }, {}),
      dataConfig = chart.dataConfig;

      if (Object.keys(filteredData).length === 0) {
        if (chart) {
          this.removeChart(chartName);
        }
      } else {
        chart.setupChart(
          this.get('axisID'), axisCharts, filteredData, blocksAll,
          dataConfig, this.get('yAxisScale'), allocatedWidth);

        // let empty =
        chart.drawChart(axisCharts, filteredData);
        // drawChart() will remove ChartLines which are not in filteredData (i.e. no longer isViewed).
        let empty = Object.keys(chart.chartLines).length === 0;
        if (empty) {
          this.removeChart(chartName);
        }
      }
    }
  },

  removeChart(chartName) {
    let chart = this.charts[chartName];
    if (chart) {
      chart.remove();
      delete this.get('charts')[chartName];
    }
  },

  removeChartLine(chartName, blockId) {
    let chart = this.charts[chartName];
    if (chart) {
      let empty = chart.removeChartLine(blockId);
      if (empty) {
        this.removeChart(chartName);
      }
    }
  },

  undraw() {
    this.get('axisCharts').frameRemove();
  },

  chartBarLine : alias('controls.view.chartBarLine'),
  /** when user toggles bar/line mode in view panel, call .toggleBarsLine() for each chart.   */
  toggleChartTypeEffect : computed('chartBarLine', function() {
    /** this could instead use Evented view-controls to listen for this action. */
    let mode = this.get('chartBarLine');
    let charts = this.get('chartsArray');
    if (charts)
      charts.forEach((chart) => (mode === chart.barsLine) || chart.toggleBarsLine());
    return mode;
  }),

  drawContent() {
    /** checkViewedContent() is called before drawContent(). */
    let charts = this.get('chartsArray');
    /* y axis has been updated, so redrawing the content will update y positions. */
    if (charts)
      charts.forEach((chart) => chart.drawContent());
  },
  checkViewedContent() {
    let charts = this.get('chartsArray');
    if (charts) {
      charts.forEach((chart) => {
        let empty = chart.removeUnViewedChartLines();
        if (empty) {
          this.removeChart(chart.name);
        }
      });
    }
  },

  /** Called via in-axis:{zoomed or resized}() -> redrawDebounced() -> redrawOnce()
   * Redraw the chart content.
   * In the case of resize, the chart frame will need to be resized (not yet
   * done; the setup functions are designed to be called again - in that case
   * they will update sizes rather than add new elements).
   */
  redraw   : function(axisID, t) {
    this.checkViewedContent();
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
    axisBlocks=this.get('chartBlocks'),
    blocksAll = union(this.get('blocks'), axisBlocks),
    yAxisScale = this.get('yAxisScale'),
    dataConfig = dataConfigs[dataTypeName],
    resizedWidth = this.get('width'),
    chart1 = this.get('charts')[dataTypeName];
    /* These have been split out of setupChart() and hence will need to be added as calls here :
     */
    chart1.overlap(axisCharts);
    if (showToggleBarLine) {
      axisCharts.controls();
    }
    /* setupFrame() is now a method of AxisCharts;  setupChart() and drawChart() are now methods of Chart1.
     */
    chart1 = chart1.setupChart(
      axisID, axisCharts, chartData, blocksAll, dataConfig, yAxisScale, resizedWidth);
    chart1.drawChart(axisCharts, chartData);
    /* .charts is normally initialised in createAttributes().
     * This was used when called via : redraw_from_paste() -> layoutAndDrawChart() -> pasteProcess().
     */
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
    dLog(CompName + " pasteProcess", textPlain.length);

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
