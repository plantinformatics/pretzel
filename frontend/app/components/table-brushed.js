import $ from 'jquery';

import Component from '@ember/component';
import { observer } from '@ember/object';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';


import { eltClassName } from '../utils/domElements';

import config from '../config/environment';

/* global d3 */
/* global Handsontable */

const trace = 0;
const dLog = console.debug;

/** Provide default types for feature .values fields
 */
const featureValuesTypes = {
  location : 'number'
};
/** Provide additional column attributes for feature .values fields
 */
const featureValuesColumnsAttributes = {
  ref : { className: "htCenter"},
  alt : { className: "htCenter"},
  Reference : {className : 'htNoWrap' },
};
/** Provide default widths for feature .values fields
 */
const featureValuesWidths = {
  ref : 40,
  alt : 40,
};


export default Component.extend({
  ontology : service('data/ontology'),

  actions : {

    /**
     * @param d array of e.g.
     * {Chromosome: "599bca87501547126adea117", Feature: "featureL", Position: "1.2"}
     */
    showData : function(d)
    {
      if (trace)
        dLog("showData", d);
      let table = this.get('table');
      if (table)
      {
        /** filter out empty rows in d[] */
        let data = d.filter(function(d1) { return d1.Chromosome; });
        table.loadData(data);
      }
    }

  },


  didInsertElement() {
    dLog("components/table-brushed.js: didInsertElement");
  },

  /** Destroy the HandsOnTable so that it does not clash with the HandsOnTable
   * created by paths-table.
   */
  willDestroyElement() {
    let table = this.get('table');
    if (table) {
      dLog('willDestroyElement', table);
      table.destroy();
      this.set('table', undefined);
    }

    this._super(...arguments);
  },


  didRender() {
    dLog("components/table-brushed.js: didRender");
    let table = this.get('table');
    if (table === undefined)
      this.get('createTable').apply(this);
  },

  /** @return true if any of the features in data have an end position : .value[1]
   */
  positionEnd : computed('data.[]', function () {
    let
    data = this.get('data'),
    positionEnd = data.any((datum) => datum.feature.value && (datum.feature.value.length > 1));
    return positionEnd;
  }),
  extraColumnsNames : computed('data.[]', function () {
    let
    data = this.get('data'),
    nameSet = data.reduce(
      (result, datum) => {
        let feature = datum.feature;
        if (feature.values) {
          Object.keys(feature.values).forEach((n) => result.add(n));
        }
        return result;
      },
      new Set()),
    names = Array.from(nameSet.values());
    dLog('extraColumnsNames', names, data);
    return names;
  }),
  extraColumns : computed('extraColumnsNames.[]', function () {
    return this.get('extraColumnsNames').map(
      (name) => {
        let c = {
          data: name,
          type: featureValuesTypes[name] || 'text'
        };
        let a = featureValuesColumnsAttributes[name];
        if (a) {
          Object.keys(a).forEach((k) => c[k] = a[k]);
        }
        return c;
      });
  }),

  extraColumnsHeaders : computed('extraColumnsNames.[]', function () {
    return this.get('extraColumnsNames').map((name) => name.capitalize());
  }),
  extraColumnsWidths : computed('extraColumnsNames.[]', function () {
    /** ref, alt are configured in featureValuesWidths; default value
     * for other columns, which may be user-defined. */
    return this.get('extraColumnsNames').map((columnName) => featureValuesWidths[columnName] || 120);
  }),

  dataForHoTable : computed('data', function () {
    let data = this.get('data').map((f) => {
      /** remove .feature from structure because it causes Handsontable to give errors. */
      let {feature, ...rest} = f,
          values = feature.values;
      if (values) {
        Object.keys(values).forEach((valueName) => rest[valueName] = values[valueName]);
        let o = rest.Ontology, name;
        if (o && (name = this.get('ontology').getName(o))) {
          rest.Ontology += ' : ' + name;
        }
      }
      if (feature.value && (feature.value.length > 1)) {
        // .Position is .value[0]
        rest.PositionEnd = feature.value[1];
      }
      return rest;
    });
    return data;
  }),
  createTable: function() {
    var that = this;
    dLog("createTable", this);

    let tableDiv = $("#table-brushed")[0];
    dLog("tableDiv", tableDiv);
    let
    columns = [
          {
            data: 'Chromosome',
            type: 'text'
          },
          {
            data: 'Feature',
            type: 'text'
          },
          {
            data: 'Position',
            type: 'numeric',
            numericFormat: {
              pattern: '0,0.*'
            }
          }
    ],
    colHeaders = [
          '<span title = "e.g. chromosome or linkage group">Block</span>',
          '<span title = "e.g. marker / gene">Feature</span>',
          'Position'
    ],
    colWidths = [100, 135, 60];
    function addColumns(cols, headers, widths) {
      columns = columns.concat(cols);
      colHeaders = colHeaders.concat(headers);
      colWidths = colWidths.concat(widths);
    }
    if (this.get('positionEnd')) {
      addColumns(
        [{
            data: 'PositionEnd',
            type: 'numeric',
            numericFormat: {
              pattern: '0,0.*'
            }
        }],
        ['End'],
        [60]
      );
    }
    addColumns(this.get('extraColumns'), this.get('extraColumnsHeaders'), this.get('extraColumnsWidths'));

    let me = this;
    function afterSelection(row, col) {
      me.afterSelection(this, row, col);
    }

      var table = new Handsontable(tableDiv, {
        data: this.get('dataForHoTable') || [['', '', '']],
        minRows: 1,
        rowHeaders: true,
        columns,
        colHeaders,
        headerTooltips: true,
        colWidths,
        height: 600,
        manualRowResize: true,
        manualColumnResize: true,
        manualRowMove: true,
        // manualColumnMove: true,
        copyPaste: {
          /** increase the limit on copy/paste.  default is 1000 rows. */
          rowsLimit: 10000
        },
        contextMenu: true,
        sortIndicator: true,
        columnSorting: {
          column: 2,
          sortOrder: true
        },
        /* see comment re. handsOnTableLicenseKey in frontend/config/environment.js */
        licenseKey: config.handsOnTableLicenseKey,
        afterSelection,
      });
      that.set('table', table);
      $("#table-brushed").on('mouseleave', function(e) {
        that.highlightFeature();
      }).on("mouseover", function(e) {
        if (e.target.tagName == "TD") {
          var tr = e.target.parentNode;
          if (tr.childNodes[2]) {
            var feature_name = $(tr.childNodes[2]).text();
            if (feature_name.indexOf(" ") == -1) {
              that.highlightFeature(feature_name);
              return;
            }
          }
        }
        that.highlightFeature();
      });
  },

  afterSelection(table, row, col) {
    const
    ranges = table.selection?.selectedRange?.ranges,
    data = this.get('data'),
    features = ranges && ranges.reduce((fs, r) => {
      /** from,to are in the order selected by the user's click & drag.
       * ^A can select row -1.
       */
      dLog('afterSelection', r.from.row, r.to.row);
      let ft = [r.from.row, r.to.row].sort();
      for (let i = Math.max(0, ft[0]); i <= ft[1]; i++) {
        let f = data[i];
        fs.push(f);
      }
      return fs;
    }, []);
    dLog('afterSelection', features, table, row, col);
    this.set('tableSelectedFeatures', features);
    this.highlightFeature(features);
  },

  onSelectionChange: observer('dataForHoTable', function () {
    let data = this.get('dataForHoTable'),
    me = this,
    table = this.get('table');
    if (table)
    {
      if (trace)
        dLog("table-brushed.js", "onSelectionChange", table, data.length);
      me.send('showData', data);
      table.updateSettings({data:data});
    }
  }),

  /** @param feature may be name of one feature, or an array of features.
   */
  highlightFeature: function(feature) {
    d3.selection.prototype.moveToFront = function() {
      return this.each(function(){
        this.parentNode.appendChild(this);
      });
    };
    d3.selectAll("g.axis-outer > circle")
      .attr("r", 2)
      .style("fill", "red")
      .style("stroke", "red");
    if (feature) {
      if (Array.isArray(feature)) {
        feature.forEach((f) => this.highlightFeature1(f.Feature)); // equiv .feature.name
      } else {
        this.highlightFeature1(feature);
      }
    }
  },
  /** Highlight 1 feature, given feature .name */
  highlightFeature1: function(featureName) {
      /** see also handleFeatureCircleMouseOver(). */
      d3.selectAll("g.axis-outer > circle." + eltClassName(featureName))
        .attr("r", 5)
        .style("fill", "yellow")
        .style("stroke", "black")
        .moveToFront();
  },



});
