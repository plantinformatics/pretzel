import $ from 'jquery';

import Component from '@ember/component';
import EmberObject, { observer } from '@ember/object';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { later, bind } from '@ember/runloop';


import { featureEdit } from '../components/form/feature-edit';
import { eltClassName } from '../utils/domElements';
import {
  // setRowAttributes,
  afterOnCellMouseOverClosure,
  highlightFeature,
} from '../utils/panel/axis-table';
import { afterSelectionFeatures } from '../utils/panel/feature-table';

import config from '../config/environment';

/* global d3 */
/* global Handsontable */

/*----------------------------------------------------------------------------*/

const trace = 0;
const dLog = console.debug;

/** If the longest text of a columns' values is greater than this length, don't
 * enable auto-width on that column.  */
const ColumnAutoWidthValueMaxLength = 40;

/** Fields of Feature displayed in table columns.
 * Fields which are not listed here are in .values
 */
const baseFields = {
  Chromosome : true,  // Block, blockId.datasetId.id + ':' + blockId.scope
  Feature : true,   // .name
  Position : true,  // value[0]
  PositionEnd : true, // End, value[1]
};
const fieldNames = {
  // Chromosome : needs to be split, not yet required to be saved.
  // Feature : .name is a ComputedProperty dervied from ._name, see serializers/feature.js
  Feature : '_name',
  Position : 'value.0',
  PositionEnd : 'value.1',
};

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
  /*
  init() {
    this._super.apply(this, arguments);
    dLog('init');
  }
  */
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

/** @return feature data of the table cell being edited */
function getEditCellData(cell) {
  let
  td = cell.TD,
  tr = td?.parentElement,
  row = tr?.rowIndex - 1,
  table = cell.hot,
  tableBrushed = table.rootElement.__PretzelTableBrushed__;
  // td.cellIndex
  let feature = tableBrushed.data[row];
  // feature.feature === tr.__dataPretzelFeature__
  return feature;
}

let windowOpenAction;


class FeatureUrlView extends Handsontable.editors.BaseEditor {
  constructor(props) {
    super(props);
  }

  createElements() {
    // super.createElements();

    this.anchor = this.hot.rootDocument.createElement('a');
    dLog('FeatureUrlView', this.anchor, this);

    this.anchor.setAttribute('target', '_blank');
    this.anchor.setAttribute('data-hot-input', true); // Makes the element recognizable by HOT as its own component's element.
    let aStyle = this.anchor.style;
    aStyle.width = 0;
    aStyle.height = 0;
  }

  beginEditing(newInitialValue, event) {
    dLog('beginEditing', newInitialValue, event);
    super.beginEditing(newInitialValue, event);

    if (! this.anchor) {
      this.createElements();
    }

    const
    feature = getEditCellData(this),
    base = 'http://www.sbg.bio.ic.ac.uk/phyre2/',
    // e.g. 'afceadc4df2bf1e7'
    Phyre2_ID = feature.feature.values.Phyre2_ID,
    idUrl = base + 'phyre2_output/' + Phyre2_ID,
    url = idUrl + '/summary.html';
    /** other urls :
     * base + '/webscripts/batchprogress.cgi?batchid=' + feature.values.Batch_ID
     * idUrl + 'c6orbA_.1{.big,}.png', or 'c6orbA_.1.pdb'
     */
    this.anchor.setAttribute('href', url);
    // this.anchor.click();
    // window.open(url, '_blank');
    windowOpenAction(url);
    // return false;
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
  Ontology : { editor : FeatureEditor, className : 'editDialog' },
  Phyre2_ID : { editor : FeatureUrlView},
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
  block : service('data/block'),

  classNames : ['h-100'],

  /** Enable auto column width; side-effect: disables adjustment of wide columns. */
  autoColumnWidth : true,
  /** Enable stretchH:all, which stretches all columns to use the available width. */
  stretchHorizontal : true,

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
        this.set('loadingData', true);
        table.loadData(data);
        this.set('loadingData', false);
      }
    }

  },

  autoColumnWidthChanged(value) {
    const fnName = 'autoColumnWidthChanged';
    dLog(fnName, value);
    this.set('autoColumnWidth', value);
    if (this.table) {
      let settings = {
        modifyColWidth : value ? bind(this, this.modifyColWidth) : undefined,
        colWidths : value ? undefined : this.colWidthsSaved,
      };
      dLog(fnName, settings, value);
      this.set('loadingData', true);
      this.table.updateSettings(settings);
      this.set('loadingData', false);

    }
  },
  stretchHorizontalChanged(value) {
    const fnName = 'stretchHorizontalChanged';
    dLog(fnName, value);
    this.set('stretchHorizontal', value);
    if (this.table) {
      let settings = {
        stretchH : this.stretchHText
      };
      dLog(fnName, settings, value);
      this.set('loadingData', true);
      this.table.updateSettings(settings);
      this.set('loadingData', false);
    }
  },
  get stretchHText() {
    return this.stretchHorizontal ? 'all' : 'none';
  },


  formFeatureEditEnable : false,

  didInsertElement() {
    this._super(...arguments);
    dLog("components/table-brushed.js: didInsertElement");

    formFeatureEditEnable = (enable) => later(() => this.set('formFeatureEditEnable', enable));
    windowOpenAction = (url) => later(() => window.open(url, '_blank'));
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
    if (table === undefined) {
      // flag that createTable() has started.
      this.set('table', null);
      later(() => {
        this.createTable(this);
      });
    }
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
    subFieldNames = {},
    nameSet = data.reduce(
      (result, datum) => {
        let feature = datum.feature;
        ['values', 'values.INFO'].forEach(fieldName => {
          const values = feature.get(fieldName);
          if (values) {
            Object.keys(values).forEach(n => {
              if (! ((fieldName === 'values') && (n === 'INFO'))) {
                result.add(n);
                const names = subFieldNames[fieldName] || (subFieldNames[fieldName] = new Set());
                names.add(n);
              }
            });
          }
        });
        if (feature.get('blockId.isQTL')) {
          result.add('Ontology');
        }
        return result;
      },
      new Set()),
    names = Array.from(nameSet.values());
    this.set('subFieldNames', subFieldNames);
    dLog('extraColumnsNames', names, data);
    return names;
  }),
  extraColumns : computed('extraColumnsNames.[]', function () {
    return this.get('extraColumnsNames').map(
      (name) => {
        let c = {
          data: name,
          type: featureValuesTypes[name] || 'text',
          editor: false,
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
  /** @return [columnIndex] -> boolean to indicate if auto-column-width should
   * be enabled on that column.
   * @desc Enable it except for columns whose longest value (represented as
   * text) is > ColumnAutoWidthValueMaxLength
   */
  columnsEnableAutoWidth : computed('columnNames.[]', 'data', function () {
    let
    columnNames = this.get('columnNames'),
    colDataMax = this.get('dataForHoTable').reduce((widths, f) => {
      columnNames.forEach((name, i) => {
        if (f[name]) {
          /** f[name] may be e.g. an array of Flanking Marker names */
          let l=('' + f[name]).length;
          if ((widths[i] === undefined) || (l > widths[i])) { widths[i] = l; }
        }
      });
      return widths;
    }, []),
    colWidthAuto = colDataMax.map((length) => length < ColumnAutoWidthValueMaxLength);
    dLog('columnsEnableAutoWidth', 'colDataMax', colDataMax, colWidthAuto);
    return colWidthAuto;
  }),
  modifyColWidth: function(width, columnIndex) {
    let columnsEnableAutoWidth = this.get('columnsEnableAutoWidth');
    /** If ! loadingData then this request is from user GUI adjustment of column
     * width, via double-click or drag on header edge, so allow it.  */
    let widthResult = columnsEnableAutoWidth[columnIndex] || ! this.loadingData ? width : 100;
    return widthResult;
  },

  /** Find a feature with the same datasetId : scope and return its block.
   * Used when creating a new Feature, in afterPaste().
   * datasetId is unique within a server; so the result could be ambiguous if
   * datasets of multiple servers are brushed.
   *
   * @param mapChrName Chromosome column cell value
   * Block, blockId.datasetId.id + ':' + blockId.scope
   * from : models/block.js : brushName
   */
  datasetScope2Block(mapChrName) {
    const fnName = 'datasetScope2Block';
    /** 
    let
    parts = mapChrName.split(':'),
    blockId = parts[0],
    scope = parts[1];
    */

    let feature = this.get('data').find((f) => {
      /** remove .feature from structure because it causes Handsontable to give errors. */
      let {feature, Chromosome, ...rest} = f;
      let match = Chromosome === mapChrName;
      return match;
    });
    let block = feature?.feature?.get('blockId');
    /** if block is not found in selected features, search viewed blocks, then all blocks */
    if (! block) {
      let
      blockService = this.get('block'),
      /** search viewed blocks.
       *  equivalent : block = blockService.viewed.find((b) => mapChrName === b.brushName);
       */
      stacks = Array.from(blockService.stacksAxes.values()),
      blockS,
      stack = stacks.find((axes) => axes.find((a) => (blockS = a.blocks.findBy('block.brushName', mapChrName))));
      if (blockS) {
        block = blockS.block;
        dLog(fnName, mapChrName, block);
      }

      if (! block) {
        /** search all blocks. */
        block = blockService.blockValues.find((b) => mapChrName === b.brushName);
        dLog(fnName, mapChrName, block);
      }
    }
    return block;
  },

  createdFeatures : [],

  dataForHoTable : computed('data', function () {
    let data = this.get('data');
    if (this.createdFeatures.length) {
      data = data.concat(this.createdFeatures);
    }
    data = data.map((f) => {
      /** remove .feature from structure because it causes Handsontable to give errors. */
      let {feature, ...rest} = f,
          values = feature.values;
      if (values) {
        Object.keys(values).forEach((valueName) => rest[valueName] = values[valueName]);
        /** Show fields from vcf INFO column as columns. */
        if (typeof rest.INFO === 'object') {
          const INFO = rest.INFO;
          delete rest.INFO;
          /* Merge rest.INFO into rest (without .INFO), giving fields of
           * .values.INFO lower precedence than fields in .values which have the
           * same name. */
          rest = Object.assign(INFO, rest);
        }
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
            type: 'text',
            editor: false,
          },
          {
            data: 'Feature',
            type: 'text',
            editor: false,
          },
          {
            data: 'Position',
            type: 'numeric',
            editor: false,
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
            },
            editor: false,
        }],
        ['End'],
        [60]
      );
    }
    addColumns(this.get('extraColumns'), this.get('extraColumnsHeaders'), this.get('extraColumnsWidths'));
    this.set('columnNames', columns.mapBy('data'));
    this.set('colWidthsSaved', colWidths);

    let me = this;
    function afterSelection(row, col) {
      me.afterSelection(this, row, col);
    }

    const afterOnCellMouseOver = afterOnCellMouseOverClosure(this);

      let data = this.get('dataForHoTable');
      /** if data is [], Handsontable appends {} to it, so pass it a new empty array instead of the CP result. */
      if (data.length === 0) {
        data = [];
      }
      let tableConfig = {
        data: data || [['', '', '']],
        minRows: 1,
        rowHeaders: true,
        columns,
        colHeaders,
        headerTooltips: true,
        height: '100%',
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
        beforePaste : (data, coords) => this.beforePaste(data, coords),
        afterPaste : (data, coords) => this.afterPaste(data, coords),
        afterSelection,
        afterOnCellMouseOver,
        outsideClickDeselects: false,
        stretchH : this.stretchHText,
      };
      if (this.autoColumnWidth) {
        tableConfig.modifyColWidth = bind(this, this.modifyColWidth);
      } else {
        tableConfig.colWidths = colWidths;
      }
      var table = new Handsontable(tableDiv, tableConfig);
      that.set('table', table);
      this.setRowAttributes(table, this.data);
      /** application client data : this component */
      table.rootElement.__PretzelTableBrushed__ = this;

    /* alternative :
    function afterOnCellMouseOut(event, coords, TD) {
      that.highlightFeature();
    } */

      $("#table-brushed").on('mouseleave', function(e) {
        that.highlightFeature();
      });
    if (false) {
      undefined?.on("mouseover", function(e) {
        if (e.target.tagName == "TD") {
          var tr = e.target.parentNode;
          {
            // related : hot.getDataAtRowProp(row, 'dataPretzelFeature')
            var feature = tr.__dataPretzelFeature__;
            if (feature) {
              that.highlightFeature(feature);
              return;
            }
          }
        }
        that.highlightFeature();
      });
    }
  },

  /** Assign Feature reference to each row. */
  setRowAttributes(table, data) {
    // table.countRows()
    data.forEach((feature, row) => {
      this.setRowAttribute(table, row, feature) ;
      /* this alternative is more specific to HoT, but is less brittle than setRowAttribute() using tr.__dataPretzelFeature__
       * Used by afterOnCellMouseOver().
       * This function can be replaced by axis-table.js : setRowAttributes().
       */
      table.setCellMeta(row, 0, 'PretzelFeature', feature);
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
    } /* else {
      tr = this.getRowTrElement(table, row);
    }*/
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
    /* no result if (row === -1), e.g. ^A (Select All) */
    const features = afterSelectionFeatures.apply(this, arguments);
    if (features) {
      this.get('controls').set('tableSelectedFeatures', features);

      let feature = this.data[row];
      if (feature) {
        this.setRowAttribute(table, row, feature);
      }
    }
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
      this.set('loadingData', true);
      table.updateSettings({data:data});
      this.set('loadingData', false);
      this.setRowAttributes(table, this.data);
    }
  }),

  highlightFeature,

  closeFeatureEdit() {
    dLog('closeFeatureEdit', this);
    this.set('formFeatureEditEnable', null);
  },

  /** Paste is OK if it only contains Ontology column
   */
  beforePaste(data, coords) {
    const fnName = 'beforePaste';
    dLog(fnName, data, coords);

    return this.editable;
  },
  /** If required, this would be called from beforePaste as :
   *   this.editable && this.disallowPasteIntoChromosomeColumn(data, coords);
   */
  disallowPasteIntoChromosomeColumn(data, coords) {
    const fnName = 'disallowPasteIntoChromosomeColumn';
    /** To allow creation of new Features via paste, paste into 'Chromosome'
     * column is required, so the following check is not required.
     */

    const
    table = this.table,
    ok = ! coords.find((c) => {
      /** true if a non-editable column is found (i.e. non-Ontology, or Block),
       * in which case exit the search, ok is false. */
      let found = false;
      for (let row = c.startRow; ! found && (row <= c.endRow); row++) {
        for (let col = c.startCol; ! found && (col <= c.endCol); col++) {
          const meta = table.getCellMeta(row, col);
          found = meta?.prop === 'Chromosome'; //  !== 'Ontology';
        }
      }
      return found;
    });
    dLog(fnName, ok);
    if (! ok) {
      const msgName = 'saveFeature' + 'Msg';
      this.set(msgName, 'Edit / Paste are only supported in the Ontology column');
    }
    return ok;
  },

  afterPaste(data, coords) {
    const fnName = 'afterPaste',
          msgName = 'saveFeature' + 'Msg';
    dLog(fnName, data, coords);
    const
    table = this.table;
    this.set(msgName, null);
    coords.forEach((c) => {
      for (let row = c.startRow, dataRowIndex = 0;
           (row <= c.endRow) && (dataRowIndex < data.length);
           row++, dataRowIndex++) {
        const
        td = table.getCell(row, 0),
        tr = td.parentElement;
        let
        feature = tr.__dataPretzelFeature__;
        /* a better alternative, not used yet : table.getDataAtRowProp(row, 'dataPretzelFeature')
         * also : feature = meta?.PretzelFeature?.feature;
         */
        dLog(fnName, coords, row, feature?.name, feature?.values?.Ontology);
        let newFeature = ! feature;
        if (newFeature) {
          feature = EmberObject.create({value : []});
        }
        if (feature) {
          /** count the columns edited because if the data runs out at the end
          * of a row there is no reason to save the feature of the next row.
          */
          let colsEdited = 0;
          for (let col = c.startCol, dataColIndex = 0;
               (col <= c.endCol) && (dataColIndex < data[dataRowIndex].length);
               col++, dataColIndex++) {
            const
            meta = table.getCellMeta(row, col),
            prop = meta.prop,
            inBase = baseFields[prop],
            inValues = this.subFieldNames['values'].has(prop),
            /** the non-Base fields are from .values and .values.INFO */
            valuesFieldName = inValues ? 'values' : 'values.INFO',
            fieldPrefix = inBase ? valuesFieldName + '.' : '';
            let
            fieldName = prop;
            let d = data[dataRowIndex][dataColIndex];

            if (prop === 'Chromosome') {
              let
              block = this.datasetScope2Block(d);
              feature.set('blockId', block);
            }
            else {
              /* if column is a base field, i.e. inBase, then map .prop to the
               * actual Feature field name.
               * Writing to columns other than Ontology is not yet required, so
               * this is draft only.
               */
              if (inBase) {
                fieldName = fieldNames[prop];
              }
              if (! inBase) {
                if (! feature.values) {
                  feature.set('values', {});
                }
                if (! inValues && ! feature.get(valuesFieldName)) {
                  // valuesFieldName is values.INFO
                  // equivalent : feature.values.INFO = {}
                  feature.set(valuesFieldName, {});
                }
              }
              if (meta.type === 'numeric') {
                d = +d;
              }
              feature.set(fieldPrefix + fieldName, d);
            }
            colsEdited++;
          }
          if (newFeature) {
            if (feature.blockId && feature.value.length && feature._name) {
              dLog(fnName, 'newFeature', feature, tr);
              let store = feature .blockId.get('store');
              // name is in feature._name
              // Replace Ember.Object() with models/feature.
              feature = store.createRecord('Feature', feature);
              // this is also done by setRowAttribute(), all being well.
              tr.__dataPretzelFeature__ = feature;
              let mapChrName = feature.get('blockId.brushName');
              let selectionFeature = {Chromosome : mapChrName, Feature : feature.name, Position : feature.value[0], feature};
              /** this.data is from components/panel/manage-features.js : data : computed();
               * Possibly add the new feature to selectionFeatures ?
               * Currently : concat the features created in this component to .data.
               */
              this.createdFeatures.push(selectionFeature);

              // selectedFeaturesSet.add(f);
              // selectedFeatures[mapChrName].push(feature);

              this.setRowAttribute(table, row, selectionFeature);
            } else {
              // don't save feature, it is not models/feature
              feature = undefined;
            }
          }
          if (colsEdited && this.saveToDatabase && feature) {
            this.saveFeature(feature);
          }
        }
      }
    });
  },
  saveFeature(editedFeature) {
    const
    fnName = 'saveFeature',
    /** {{saveFeatureMsg}} is displayed in .hbs, but currently is not visible
     * because the table is height:100% (h-100).  possibly make it visible with :
     *   right-panel-section > panel-section > div : {overflow-y: auto; }
     */
    msgName = fnName + 'Msg';
    /** based on similar components/form/feature-edit.js : saveFeature() */
    let promise = editedFeature.save();
    promise
      .then((feature) => {
        this.get('block').featureSaved();
        dLog(fnName, feature);
      })
      .catch((err) => {
        dLog(fnName, 'err', err, this, arguments);
        this.set(msgName, err);
      });
    return promise;
  },

});

/*----------------------------------------------------------------------------*/
