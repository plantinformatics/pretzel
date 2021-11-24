import $ from 'jquery';

import Component from '@ember/component';
import { observer } from '@ember/object';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { later } from '@ember/runloop';


import { featureEdit } from '../components/form/feature-edit';
import { eltClassName } from '../utils/domElements';

import config from '../config/environment';

/* global d3 */
/* global Handsontable */

/*----------------------------------------------------------------------------*/

const trace = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

let formFeatureEditEnable;

class FeatureEditor extends Handsontable.editors.BaseEditor {
  createElements() {
    super.createElements();

    this.wrapperDiv = this.hot.rootDocument.createElement('div');
    dLog('featureEdit', featureEdit, this.wrapperDiv);
    this.wrapperDiv.setAttribute('id', 'formFeatureEditTarget');

    this.wrapperDiv.setAttribute('data-hot-input', true); // Makes the element recognizable by HOT as its own component's element.
    this.wrapperdivStyle = this.WRAPPERDIV.style;
    this.wrapperdivStyle.width = 0;
    this.wrapperdivStyle.height = 0;

    Handsontable.dom.empty(this.WRAPPERDIV_PARENT);
    this.WRAPPERDIV_PARENT.appendChild(this.WRAPPERDIV);
  }
  init() {
    dLog('init');
  }
  beginEditing(newInitialValue, event) {
    dLog('beginEditing', newInitialValue, event);
    super.beginEditing(newInitialValue, event);

    /** This works, and if beginEditing() is called in all cases this could be a
     * basis for an alternative to setRowAttribute() and tableData : send an
     * action to table-brushed component with feature, setting an attribute
     * which can take the role of formFeatureEditEnable.
     * A WeakMap or Symbol can be used in place of .rootElement.__PretzelTableBrushed__
     */
    if (false) {
    let
    td = this.TD,
    tr = td?.parentElement,
    row = tr?.rowIndex,
    table = this.hot,
    tableBrushed = table.rootElement.__PretzelTableBrushed__;
    // td.cellIndex
    let feature = tableBrushed.data[row];
    tableBrushed.setRowAttribute(table, row, feature);
    }

    formFeatureEditEnable(this);
  }
  getValue() {
    dLog('getValue');
    return this.originalValue;
  }
  setValue(newValue /* Mixed*/) {
    dLog('setValue', newValue);
  }
  open() {
    dLog('open', this, this.TD);
    formFeatureEditEnable(this);
  }
  close() {
    dLog('close', this);
    /* This is called when user clicks into the feature-edit dialog;  no action required. */
  }
  focus() {
    dLog('focus');
  }

}

/*----------------------------------------------------------------------------*/

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
  Ontology : { editor : FeatureEditor },
};
/** Provide default widths for feature .values fields
 */
const featureValuesWidths = {
  ref : 40,
  alt : 40,
};



/*----------------------------------------------------------------------------*/



export default Component.extend({
  ontology : service('data/ontology'),
  controls : service(),

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

  formFeatureEditEnable : false,

  didInsertElement() {
    this._super(...arguments);
    dLog("components/table-brushed.js: didInsertElement");

    formFeatureEditEnable = (enable) => later(() => this.set('formFeatureEditEnable', enable));
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
    this._super(...arguments);

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
        if (feature.get('blockId.isQTL')) {
          result.add('Ontology');
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
        if (o && (name = this.get('ontology').getNameViaPretzelServer(o))) {
          if (name && ! name.then) {
            rest.Ontology += ' : ' + name;
          }
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

      let data = this.get('dataForHoTable');
      /** if data is [], Handsontable appends {} to it, so pass it a new empty array instead of the CP result. */
      if (data.length === 0) {
        data = [];
      }
      var table = new Handsontable(tableDiv, {
        data: data || [['', '', '']],
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
        outsideClickDeselects: false
      });
      that.set('table', table);
      this.setRowAttributes(table, this.data);
      /** application client data : this component */
      table.rootElement.__PretzelTableBrushed__ = this;


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

  /** Assign Feature reference to each row. */
  setRowAttributes(table, data) {
    // table.countRows()
    data.forEach((feature, row) => {
      this.setRowAttribute(table, row, feature) ;
    });
  },
  /** Assign Feature reference to row. */
  setRowAttribute(table, row, feature) {
    let data = this.get('data');
      let cell = table.getCell(row, 0);
    /** cell and <tr> may not be rendered when setRowAttributes() is called, so
     * this is also called from afterSelection(). */
    let tr;
    /** cell will be null if column 0 is not rendered, in which case use getRowTrElement(). */
    if (cell) {
      tr = cell.parentElement;
    } else {
      tr = this.getRowTrElement(table, row);
    }
    if (tr) {
      tr.__dataPretzelFeature__ = feature.feature;
    }
  },
  /** @return the <tr> element for row in table
   */
  getRowTrElement(table, row) {
    let td;
    /** Use getCellMetaAtRow() to list the cells of the row which are currently rendered. */
    let cells = table.getCellMetaAtRow(row);
    cells.any((cell) => (td = table.getCell(row, cell.col)));
    let tr = td?.parentElement;
    return tr;
  },

  afterSelection(table, row, col) {
    const
    ranges = table.selection?.selectedRange?.ranges,
    data = this.get('data'),
    features = data?.length && ranges && ranges.reduce((fs, r) => {
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
    this.get('controls').set('tableSelectedFeatures', features);

    let feature = this.data[row];
    this.setRowAttribute(table, row, feature);
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
      this.setRowAttributes(table, this.data);
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

  closeFeatureEdit() {
    dLog('closeFeatureEdit', this);
    this.set('formFeatureEditEnable', null);
  },

});

/*----------------------------------------------------------------------------*/
