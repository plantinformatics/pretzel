import Ember from 'ember';
const { inject: { service } } = Ember;

import { className, layoutAndDrawChart /*Chart1*/ } from '../utils/draw/chart1';
import InAxis from './in-axis';

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
 * @param axis  axisComponent;   parent axis-2d component
 * @param axisID  axisID
 * @param data oa
 * @param width resizedWidth
 *----------------
 * data attributes created locally, not passed in :
 * @param chart1
 */
export default InAxis.extend({
  blockService: service('data/block'),

  className : className,

  didRender() {
    console.log("components/axis-chart didRender()");
  },

  blockFeatures : Ember.computed('block', 'block.features.[]', 'axis.axis1d.domainChanged', function () {
    if (this.get('block.isChartable'))
      this.drawBlockFeatures0();
  }),
  featuresCounts : Ember.computed('block', 'block.featuresCounts.[]', 'axis.axis1d.domainChanged', function () {
    /* perhaps later draw both, for the moment just draw 1, and since all data
     * blocks have featuresCounts, plot the features of those blocks which are
     * chartable, so that we can see both capabilities are working.
     */
    if (! this.get('block.isChartable'))
      this.drawBlockFeaturesCounts();
    return this.get('block.featuresCounts');
  }),

  drawBlockFeatures0 : function() {
    let features = this.get('block.features');
    let domain = this.get('axis.axis1d.domainChanged');
    console.log('blockFeatures', features.length, domain);
    if (features.length)  // -	should also handle drawing when .length changes to 0
    {
      if (features.hasOwnProperty('promise'))
        features = features.toArray();
      if (features[0] === undefined)
        dLog('drawBlockFeatures0', features.length, domain);
      else
        this.drawBlockFeatures(features);
    }
  },
  drawBlockFeaturesCounts : function() {
    let featuresCounts = this.get('block.featuresCounts');
    let domain = this.get('axis.axis1d.domainChanged');
    if (featuresCounts) {
      console.log('drawBlockFeaturesCounts', featuresCounts.length, domain, this.get('block.id'));

      /** example element of array f : */
      const dataExample = 
        {
          "_id": {
            "min": 100,
            "max": 160
          },
          "count": 109
        };
      let f = featuresCounts.toArray(),
      /** the min, max will be passed also - first need to factor out part of axis-chart for featuresCounts. */
      fa = f; // .map(function (f0) { return f0.count;});
      console.log('drawBlockFeaturesCounts', f);
      let 
        featureCountData = {
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
          }
        };
      // pass alternate dataConfig to layoutAndDrawChart(), defining alternate functions for {datum2Value, datum2Location }
      this.layoutAndDrawChart(fa, featureCountData);
    }
  },
  drawBlockFeatures : function(features) {
    let f = features.toArray(),
    fa = f.map(function (f0) { return f0._internalModel.__data;});

    let axisID = this.get("axis.axisID"),
    oa = this.get('data'),
    za = oa.z[axisID];
    /* if za has not been populated with features, it will have just .dataset
     * and .scope, i.e. .length === 2 */
    if (Object.keys(za).length == 2) {
      dLog('drawBlockFeatures()', axisID, za, fa);
      // add features to za.
      fa.forEach((f) => za[f.name] = f.value);
    }

    this.layoutAndDrawChart(fa);
  },

  redraw   : function(axisID, t) {
    let data = this.get(className),
    layoutAndDrawChart = this.get('layoutAndDrawChart');
    if (data) {
    console.log("redraw", this, (data === undefined) || data.length, axisID, t);
    if (data)
      layoutAndDrawChart.apply(this, [data]);
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

  layoutAndDrawChart(chart, dataConfig) {
    layoutAndDrawChart(this, chart, dataConfig);
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
    layoutAndDrawChart.apply(this, [chart]);

    this.set('data.chart', forTable);
  },

  /*--------------------------------------------------------------------------*/


});

