import { computed, observer } from '@ember/object';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { get as Ember_get, set as Ember_set } from '@ember/object';
import { later, once, bind, debounce } from '@ember/runloop';
import { on } from '@ember/object/evented';
import { task, didCancel } from 'ember-concurrency';


/* global Handsontable */
/* global $ */
/* global d3 */

import config from '../config/environment';

import {
  getCellFeatures,
  cellFeaturesWithDatasetTag,
  setRowAttributes,
  getRowAttribute,
  getRowAttributeFromData,
  afterOnCellMouseOverClosure,
  tableCoordsToFeature,
  highlightFeature,
} from '../utils/panel/axis-table';
import { afterSelectionFeatures } from '../utils/panel/feature-table';
import { tableYDimensions } from '../utils/panel/table-dom';
import {
  datasetId2Class,
  featureBlockColourValue, columnNameAppendDatasetId, columnName2SampleName, valueIsCopies,
} from '../utils/data/vcf-feature';
import { toTitleCase } from '../utils/string';
import { thenOrNow } from '../utils/common/promises';
import { tableRowMerge } from '../utils/draw/progressive-table';
import { eltWidthResizable, noKeyfilter } from '../utils/domElements';
import { sparseArrayFirstIndex } from '../utils/common/arrays';
import { toggleObject } from '../utils/ember-devel';

// -----------------------------------------------------------------------------

const dLog = console.debug;
const trace = 1;

const datasetSymbol = Symbol.for('dataset');
const featureSymbol = Symbol.for('feature');

/** comment in components/panel/manage-genotype.js */
const sampleFiltersSymbol = Symbol.for('sampleFilters');

// -----------------------------------------------------------------------------

/**
 * bcftools %GT : numerical format
 * 0, 1, 2 is dosage of the alleles. 0 is no copies of alt, 1 is 1 copy and 2 is 2 copies.
 * Instead of setting the colour of the element, classes are now used - see copiesColourClass(),
 * enabling easier consistent changes.
 */
const copiesColours = [ /*0*/ 'orange', /*1*/ 'white', /*2*/ 'blue'];

/** indexed by +false / +true, or 0 / 1.   used in ABRenderer() */
const coloursEqualsRef = ['red', 'green'];
/** true means ABRenderer show 'A' or 'B' instead of C A T G */
const ABRendererShowAB = false;

/** copied from vcf-feature.js */
const refAlt = ['ref', 'alt'];
const refAltHeadings = refAlt.map(toTitleCase);

/** Provide default widths for feature fields, including .values
 * Based on similar in table-brushed.js
 */
const featureValuesWidths = {
  Name : 180,
  Position : 80,
  End : 80,
  MAF : 35,
  /*
  ref : 40,
  alt : 40,
  */
};

/** Initially '100%', but that puts horizontal scrollbar below the browser window.
 * Recalculated to a px value by tableHeightFromParent().
 * vh doesn't seem to work here. */
let tableHeight = '100%';
/** Enable use of tableHeightFromParent().  */
const calculateTableHeight = true;

/** <div> which contains HandsOnTable elements. */
const tableContainerSelector = '#observational-table';

// -----------------------------------------------------------------------------

/** Considering the columns as 2 groups :
 * . left columns, which are fixed, not variable / optional,
 * . right columns, i.e. sample columns, which vary in number >=0
 * @return true if column_name is one of the fixed left columns.
 * @param column name
 */
function columnNameIsNotSample(column_name) {
  /* 'Ref', 'Alt' columns are fixed not variable, but their headers are rotated
   * like the sample columns, and they are formatted like the sample columns, so
   * assign the class col-sample.
   */
  return ['Name', 'Position', 'End', 'LD Block', 'MAF'].includes(column_name);
}

function copiesColourClass(alleleValue) {
  // related : copiesColours[+alleleValue]
  return 'copyNum_' + alleleValue;
}


// -----------------------------------------------------------------------------


/** map from block ( + sample) to column name.
 * @param column block / selectedBlock or column object
 */
function col_name_fn(column) {
  /** If column is block then block.get('datasetId.id') requires .get();
   * otherwise column can be a native JS object, so use Ember_get() to handle either case.
   * vcfFeatures2MatrixView() sets : datasetId : {id : ''}, so in that case datasetId is not appended.
   */
  const
  datasetId = Ember_get(column, 'datasetId.id'),
  /** if datasetId is '' or undefined / null, then ':' separator is not required.
   * This is true for non-sample columns, e.g. Position, End, Ref, Alt, LD Block
   */
  name = Ember_get(column, 'name'),
  col_name = datasetId ? columnNameAppendDatasetId(name, datasetId) : name;
  return col_name;
}

/** 210 here is interdependent with : app.scss : #observational-table .head {  margin-top: 210px; }
 * The header height could be reduced when there are no sample columns, and this switched off.
 */
const headerHeightEx = 32;  // for 210px
/** For use when ! .fullPage, calculate ex height for the given number of rows,
 * with a maximum which gives a nearly full height table.
 */
function nRows2HeightEx(nRows) {
  // 2 -> 6ex : only 1 row visible; may need an base offset - try adding 5ex
  return headerHeightEx + 5 + (+((nRows || 2) * 3.25).toFixed(0));
}

// -----------------------------------------------------------------------------

/**
 * Component args :
 * @param selectedBlock
 * block / selectedBlock or column object
 * if .blockSamples, this is a Block, otherwise {block : Block, sampleName : string}.
 * @param displayData
 *  columns [] -> {features -> [{name, value}...],  datasetId.id, name }
 *
 * @desc optional params, passed by manage-genotype (blockSamples) but not
 * routes/matrixview : components/matrix-view-page
 *
 * @param blockSamples  true if blocks contain multiple samples (each column is a sample)
 * false if each column is a block (dataset : chromosome)
 *
 * @param userSettings  Persisted controls / settings
 * 
 * @param dataScope=this.brushedOrViewedScope
 * identify the reference datasetId and scope of the axis of the genotype
 * datasets which are displayed in the table.
 * There could be multiple such axes; the components handle that but it may not be used.
 * This is displayed in the top-left corner of the table.
 *
 * @param displayDataRows alternative to displayData, which is grouped in
 * columns, this is in rows (analogous to column- vs row- major order)
 *
 * Column Names :
 * @param columnNamesParam  names of all columns
 * @param gtDatasets parallel to gtDatasetColumns. gtDatasets[i].id === gtDatasetColumns[i]
 * @param gtDatasetColumns names of Genotype / VCF feature name ("Block") columns
 * @param datasetColumns names of non-Genotype feature name ("Block") columns
 * @param extraDatasetColumns names of non-Genotype feature .values[] fieldNames to display in columns
 *
 * @param selectBlock action
 * @param changeDatasetPositionFilter action (dataset, pf)
 * @param featureColumnDialogDataset action (datasetId)
 * @param tablePositionChanged action
 * @param displayForm requestFormat
 *
 * @desc
 * Multiple blocks are loaded, from multiple datasets, via panel/left-panel :
 *   loadBlock, removeBlock, selectBlock
 *
 * table :
 *   row_name : feature_name = feature.name
 *   col_name : col_name_fn(block)
 *
 * Computed properties :
 *
 *   customBorders <- colSample0
 *   noData		<- displayData.[] or displayDataRows.[]
 *   columns		<- displayData.[]
 *   columnNames		<- columnNamesParam or displayData.[]  (and set colSample0)
 *   rowHeaderWidth		<- rows
 *   colHeaderHeight		<- columns
 *   dataByRow		<- displayDataRows or columns (<- displayData.[])  (and .set(numericalData))
 *   rows		<- dataByRow
 *   abValues		<- dataByRow, selectedBlock, selectedColumnName
 *   data		<- columns, rows, dataByRow  (<- displayData.[])
 *   rowRanges		<- dataByRow
 *   updateTable: observer('rows', 'selectedBlock') (<- displayData.[])
 *
 * Cell Renderers :
 *   CATGRenderer
 *   ABRenderer : abValues
 *   numericalDataRenderer : rowRanges
 *   blockColourRenderer
 *   haplotypeColourRenderer
 *
 *   renderer =
 *     (prop === 'Block') ? blockColourRenderer :
 *     (prop === 'LD Block') ? haplotypeColourRenderer :
 *     numericalData ? numericalDataRenderer :
 *        selectedBlock ? ABRenderer : CATGRenderer
 *   type =  (prop.endsWith 'Position' or 'End') ? 'numeric'
 *
 * Actions / events :
 *   afterOnCellMouseDown -> selectBlock (column name)
 */
export default Component.extend({
  haplotypeService : service('data/haplotype'),
  queryParamsService : service('query-params'),

  urlOptions : alias('queryParamsService.urlOptions'),

  //----------------------------------------------------------------------------

  classNames: ['matrix-view'],

  //----------------------------------------------------------------------------

  /** this may move up to matrix-view-page
  style: 'height:100%; width:100%',
  attributeBindings: ['style:style'],
 */
  numericalData: true,

  /** This is passed in as a argument to matrix-view, so this initialisation
   * seems out of place.
   */
  selectedBlock: null,

  selectedColumnName : null,
  selectedSampleColumn : false,
  selectedColumnNames : alias('userSettings.selectedColumnNames'),

  /** current row data array which has been given to table.
   * This is updated progressively from .data by progressiveRowMerge().
   * .currentData is the reference / snapshot for the progress of data update.
   */
  currentData : [],

  // ---------------------------------------------------------------------------

  didInsertElement() {
    this._super.apply(this, arguments);

    dLog('matrix-view', this, 'vcf');
    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.matrixView = this;
    }
    this.fullPage = ! this.blockSamples;
    // later(() => ! this.isDestroying && this.createTable(), 1000);

    /** matrix-view formats the data into the table; make that format available
     * to manage-genotype which contains a user button to copy it to the
     * clipboard.
     */
    this.tableApi.dataClipboard = () => this.dataClipboard;
  },

  didRender() {
    later(this.renderOnceTable, 500);
  },
  renderOnceTable : computed( function() {
    return () => ! this.isDestroying && this.createOrUpdateTable();
  }),

  createOrUpdateTable() {
    if (! this.table) {
      this.createTable();
    }
    if (! this.noData) {
      this.updateTableOnce();
    }
  },

  // ---------------------------------------------------------------------------

  /**
   *    selectPhase : string : '0', '1', 'both'
   */

  /** The user can toggle the phase of a diploid which is shown by CATGRenderer.
   * or view both phases / alleles
   *
   * This could be @tracked, and added as dependency of rendererConfigEffect(),
   * but that seems not required because changing .selectPhase (somehow) already
   * triggers didRender().
   */
  selectPhase : 'both',
  selectPhaseChanged(value) {
    dLog('selectPhaseChanged', value);
    this.selectPhase = value;
  },

  // ---------------------------------------------------------------------------

  /** Used in columnNamesToColumnOptions() to add .width to the settings .columns[]
   */
  colWidths : function (columnIndex) {
    /** Originally included in table settings as :
     * colWidths : bind(this, this.colWidths),
     */

    /** fix GT columns at 25; they have long headings so autoColumnWidth is too wide.
     * Columns :
     *  0 : Block (track colour).  same as GT - 25px
     *  1 : Position.   80px
     *  (2 : End) - optional; preferably make this the same width as Position
     *     Current data won't have End because bcftools output has 1 row per SNP - single base pair.
     *  this.colSample0 : sample column width +3 to allow for 3px white gutter between Alt and the first sample column.
     *   (commented-out because handsontable does not increase the padding-left of sample0 column by the gutter width;
     *    may switch to a class-based solution)
     */
    const
    columnName = this.columnNames[columnIndex],
    /** applied to datasetColumns, could also apply to Position, Name,
     * and the row header when ! gtMergeRows. */
    cellSizeFactor = this.userSettings.cellSizeFactor || 1,
    featureNamesWidth = Math.round(180 * cellSizeFactor),
    width =
      featureValuesWidths[columnName] ||
      (this.extraDatasetColumns?.includes(columnName) ? featureNamesWidth :
       (this.columnNameIsDatasetColumn(columnName, true) ?
        (this.userSettings.showNonVCFFeatureNames ? featureNamesWidth : this.cellSize) : 

      /* works, but padding-left is required also, to move the text.
      columnIndex === this.colSample0 ?
      25 + 3 :
      */
        this.cellSize));
    return width;
  },

  // ---------------------------------------------------------------------------

  /** Show a white line between the Position [ / Ref / Alt] columns and the
   * first sample column.
   * Replaced by : .col-Alt : border-right-width
   */
  customBorders : computed('colSample0', function () {
    let customBorders;
    const nRows = this.table?.countRows();
    if ((this.colSample0 > 1) && nRows) {
    /** index of the column before the first sample column. */
    const colAlt = this.colSample0 - 1;
    customBorders
     = [
    {
      range: {
        from: {
          row: 0,
          col: colAlt
        },
        to: {
          row: nRows,
          col: colAlt
        }
      },
      right: {
        width: 3,
        color: 'white'
      }
    }];
    }
    return customBorders;
  }),

  //----------------------------------------------------------------------------

  initResizeListener() {
    d3.select(window) // '#right-panel'
      .on('resize', () => this.updateTableHeight());
  },
  updateTableHeight() {
    this.updateTableOnce();
  },

  tableHeightEffect : computed('userSettings.hideControls', function () {
    this.updateTableOnce();
  }),

  /** Calculate height of table in px to enable horizontal scrollbar below table
   * to be visible.
   */
  tableHeightFromParent(tableDiv) {
    const
    fnName = 'tableHeightFromParent',
    /** Use .clientHeight of #right-panel-content.right-panel-genotype;
     * matrixViewElt.clientHeight seems the same value */
    matrixViewElt = tableDiv.parentElement,
    matrixViewHeight = matrixViewElt.clientHeight,
    rightPanel = $('#right-panel-content.right-panel-genotype')[0],
    // this.colHeaderHeight + 80
    height = '' + (rightPanel.clientHeight - 45) + 'px';
    if (matrixViewHeight !== rightPanel.clientHeight) {
      dLog(fnName, matrixViewHeight, '!==', rightPanel.clientHeight, matrixViewElt, rightPanel);
    }
    return height;
  },

  cellSizeBase : 25,
  cellSize : computed('userSettings.cellSizeFactor', function () {
    const
    fnName = 'cellSize',
    cellSizeFactor = this.userSettings.cellSizeFactor || 1,
    size = Math.round(cellSizeFactor * this.cellSizeBase);
    dLog(fnName, size, cellSizeFactor);
    // Side Effect
    this.setCellSizeStyle(cellSizeFactor);
    return size;
  }),
  get rowHeights() {
    return '' + (this.cellSize - 1) + 'px';
  },
  setCellSizeStyle(cellSizeFactor) {
    // if (cellSizeFactor === 1) clear class which enables use of :
    const
    height = Math.round(cellSizeFactor * 22),
    lineHeight = Math.round(cellSizeFactor * 21),
    fontSize = Math.round(cellSizeFactor * 14),
    body = d3.select('body');
    body.style('--matrixViewLineHeight', lineHeight + 'px');
    body.style('--matrixViewHeight', height + 'px');
    body.style('--matrixViewFontSize', fontSize + 'px');
  },
  createTable() {
    const fnName = 'createTable';
    /** guard against intervening calls to createTable(). */
    this.set('table', true);
    /** div.matrix-view.ember-view */
    let tableDiv = $("#observational-table")[0];
    if (calculateTableHeight) {
      this.initResizeListener();
      tableHeight = this.tableHeightFromParent(tableDiv);
    }
    dLog(fnName, tableDiv, tableHeight);
    const afterOnCellMouseOver = afterOnCellMouseOverClosure(this);
    let nRows = this.get('rows.length') || 0;
    /** switch on gtPlainRender=0b11 by default, temporarily. */
    const gtPlainRender = this.urlOptions.gtPlainRender ??
          (this.urlOptions.gtPlainRender = 0b11);
    const columns = this.columnNamesToColumnOptions(this.columnNames);
    let settings = {
      /* see comment re. handsOnTableLicenseKey in frontend/config/environment.js */
      licenseKey: config.handsOnTableLicenseKey,
      data: [],
      readOnly: true,

      width : '100%',
      height: true || this.fullPage ? tableHeight : nRows2HeightEx(nRows) + 'ex',
      rowHeights : this.rowHeights,
      columns,
      stretchH: 'none',
    };
    /** The above settings are minimal - just plain text, without actions, to
     * test performance without the rich presentation and actions.
     */
    const richSettings = {
      rowHeaders: bind(this, this.rowHeaders),
      manualColumnMove: true,

      outsideClickDeselects: true,
      afterOnCellMouseDown: bind(this, this.afterOnCellMouseDown),
      afterOnCellMouseOver,
      beforeCopy: bind(this, this.beforeCopy),
      headerTooltips: {
        rows: false,
        columns: true,
        onlyTrimmed: true
      },

      hiddenColumns: {
        // copyPasteEnabled: default is true,
        indicators: true,
        // columns: [],
      }
    };
    if (gtPlainRender & 0b1) {
      Object.assign(settings, richSettings);
    }
    // linked to below : .registerRenderer( *Renderer )
    if (gtPlainRender & 0b10) {
      settings.cells = bind(this, this.cells);
    }
    /* afterScrollVertically() calls progressiveRowMergeInBatch(), so enable
     * with the same bit value as progressiveRowMergeInBatch().
     */
    if (gtPlainRender & 0b100000) {
      settings.afterScrollVertically = bind(this, this.afterScrollVertically);
    }
    settings.afterScrollVertically = this.afterScrollVertically_tablePosition.bind(this);

    if (this.urlOptions.gtSelectColumn) {
      settings.afterSelection = bind(this, this.afterSelection);
    } else {
      settings.afterSelection = bind(this, this.afterSelectionHaplotype);
    }
    let table = new Handsontable(tableDiv, settings);

    if (gtPlainRender & 0b10) {
      Handsontable.renderers.registerRenderer('CATGRenderer', bind(this, this.CATGRenderer));
      Handsontable.renderers.registerRenderer('ABRenderer', bind(this, this.ABRenderer));
      Handsontable.renderers.registerRenderer('numericalDataRenderer', bind(this, this.numericalDataRenderer));
      Handsontable.renderers.registerRenderer('blockFeaturesRenderer', bind(this, this.blockFeaturesRenderer));
      Handsontable.renderers.registerRenderer('blockColourRenderer', bind(this, this.blockColourRenderer));
      Handsontable.renderers.registerRenderer('haplotypeColourRenderer', bind(this, this.haplotypeColourRenderer));
    }

    this.set('table', table);

    if (true /*(gtPlainRender & 0b100)*/) {
      table.addHook('afterRender', this.afterRender.bind(this));
    }

    this.dragResizeListen();
    this.afterScrollVertically_tablePosition();
    this.table.batchRender(bind(this, this.setRowAttributes));
  },

  highlightFeature,

  // ---------------------------------------------------------------------------

  afterRender(isForced) {
    const topLeftDialogEnable = true;
    if (! topLeftDialogEnable) {
    const scope = this.dataScope;
    if (scope) {
      this.showTextInTopLeftCorner(scope);
    }
    } else {
      this.topLeftDialogUpdate();
    }

    this.set('model.layout.matrixView.tableYDimensions', tableYDimensions());
  },
  showTextInTopLeftCorner(text) {
    /* Within #observational-table there are 4 
     * <div class="ht_clone_* handsontable">
     * with ht_clone_{top,bottom,left,top_left_corner}
     * and they each have a table.htCore containing a span.colHeader.cornerHeader
     *
     * Setting [3] is visible;  setting [0], 1, 2 is not visible.
     */
    const cornerClones=$('#observational-table .colHeader.cornerHeader');
    if (cornerClones.length > 3) {
      cornerClones[3].textContent = text;
    }
    this.addComponentClass();
  },
  addComponentClass() {
    /** gtMergeRows : datasetId is not displayed, so width is not set  */
    let ot = d3.select('#observational-table');
    ot.classed('gtMergeRows', this.urlOptions.gtMergeRows);
  },

  //----------------------------------------------------------------------------

  /** Called by matrix-view afterRender()
   */
  // @action
  topLeftDialogUpdate() {
    const
    fnName = 'topLeftDialogUpdate',
    /** related : cornerClones */
    topLeftDialog = $('#observational-table .ht_clone_top_left_corner .colHeader.cornerHeader')[0];
    dLog(fnName, topLeftDialog);
    Ember_set(this, 'tableApi.topLeftDialog', topLeftDialog);
    this.addComponentClass();
  },

  //----------------------------------------------------------------------------

  /** After user scroll, pass the features of first and last visible rows to
   * tablePositionChanged().
   *
   * This is also called in {create,update}Table() so that tablePosition has an
   * initial value before user scroll.
   */
  afterScrollVertically_tablePosition() {
    const
    fnName = 'afterScrollVertically_tablePosition',
    table = this.table,
    /** refn : https://github.com/handsontable/handsontable/issues/2429#issuecomment-406616217 */
    wtScroll = table.view.wt.wtScroll,
    /** When called from event afterScrollVertically,
     * .get{First,Last}VisibleRow() are defined; they may be -1 otherwise, e.g.
     * table is empty / not initialised or no scroll yet.
     */
    rows = [wtScroll.getFirstVisibleRow(),
            wtScroll.getLastVisibleRow()];
    let features;
    if ((rows[0] === -1) || (rows[1] === -1)) {
      features = this.getLimitFeatures();
    } else {
      /* considered using as a fall-back : rows = [0, table.countVisibleRows() - 1],
       * but getLimitFeatures() is more direct.
       */
      features = rows.map(row => this.getRowAttribute(table, row, 0));
    }
    this.tablePositionChanged(features);
  },

  /** Lookup the vertical position of the first and last visible rows.
   * The position is relative to .ht_master > <table>
   * The .ht_master > <table> has the same vertical position.
   *
   * Related : getLimitRowsPositions_jQuery(), which returns a good result in these cases when this function does not :
   * after scroll : [ null, null ]
   * after switching to features tab and back : Array [ 0, 0 ]
   */
  getLimitRowsPositions() {
    const
    table = this.table,
    /* 0 is the first visible row, so expect that countVisibleRows()-1 is the
     * last visible row; in devel it has appeared that countVisibleRows() is the
     * last visible row.
     * Related : table.countRenderedRows().
     */
    rows = [0, table.countVisibleRows()-1],
    offsetTops = rows.map(rowIndex => {
      const
      /** may be null. */
      td = table.getCell(rowIndex, 0),
      top = td && (td.offsetTop + (rowIndex ? td.offsetHeight / 2 : 0));
      return top;
    });
    return offsetTops;
  },

  /** Equivalent to getLimitRowsPositions(), using jQuery.
   * It has been seen that this returned a result when getLimitRowsPositions()
   * returns nulls from getCell() -> null.
   * @return [top, bottom]  heights are not integers (but should be)
   */
  getLimitRowsPositions_jQuery() {
    /** the elements in .ht_master and .ht_clone_left share the same top / height.     */
    const
    trs$ = $('div#observational-table.handsontable > .ht_master > .wtHolder > .wtHider > .wtSpreader > table.htCore > tbody > tr'),
    /** .last() is equivalent to .at(-1); it returns a jQuery selection */
    limitTr$ = [$(trs$[0]), $(trs$.last()[0])],
    ths$ = limitTr$.map(tr$ => tr$.find("th")),
    tops = ths$.map((th$, i) => th$.position().top + (i ? th$.height() : 0));
    return tops;
  },


  /** @return [first, last] first and last visible features
   */
  getLimitFeatures() {
    let features = [];
    /** displayDataRows is undefined if empty. In that case (gtMergeRows) may be
     * defined, with .length 0, so the result is undefined, as required.
     */
    if (this.displayDataRows) {
      const d = this.displayDataRows;
      features[0] = d[sparseArrayFirstIndex(d)];
      features[1] = d.at(-1);
    } else if (this.displayData) {
      const f = this.displayData.find(d => d.features)?.features;
      if (f) {
        features[0] = f[0];
        features[1] = f.at(-1);
      }
    }
    /* both cases above (gtMergeRows : displayData{Rows,}) return row data features, e.g. :
     * {
     *   <datasetId>: String { "scaffold38755_1344396" },
     *   Alt: Object { name: "20102 scaffold38755_1344396", value: "T", Symbol("feature"): {...} },
     *   Name: String { "scaffold38755_1344396" },
     *   Position: 1344396,
     *   Ref: Object { name: "20102 scaffold38755_1344396", value: "G", Symbol("feature"): {...} },
     * }
     * or (displayData) :
     * Object {
     *   name: "scaffold44309_642586"
     *   value: "scaffold44309_642586"
     *   Symbol(feature): Object { store: {...}, isError: false, value_0: 14591817, ... }
     * }
     * Map those to Ember data model object Feature
     */
    if (features?.length) {
      features = features.map(feature => (feature.Name || feature)[Symbol.for('feature')]);
    }
    return features;
  },

  //----------------------------------------------------------------------------

  /** Get the feature displayed in this row.
   * @param table instance param to *Renderer i.e. blockFeaturesRenderer(), or this.table.
   * @param visualRowIndex
   * @param visualColIndex
   * if undefined then axis-table.js : getRowAttribute() defaults it to 0.
   * if ! gtMergeRows then a row has a single feature, applicable to all columns.
   */
  getRowAttribute(table, visualRowIndex, visualColIndex) {
    let feature;
    const
    fnName = 'getRowAttribute',
    physicalRow = table.toPhysicalRow(visualRowIndex);
    feature = this.data[physicalRow]?.[featureSymbol];

    const gtPlainRender = this.urlOptions.gtPlainRender;
    if (! feature && table /*&& (gtPlainRender & 0b10000000)*/) {
      feature = getRowAttribute(table, visualRowIndex, visualColIndex);
      if ((trace > 1) && feature) {
        dLog(fnName, feature, feature?.get('blockId.mapName'));
      }
    }

    if (! feature && false) {
      /** or !!this.displayDataRows ... */
      const dataIsRows = this.displayDataRows === this.get('dataByRow');
      const data = dataIsRows ? this.displayDataRows : this.displayData;
      feature = getRowAttributeFromData(table, data, dataIsRows, visualRowIndex);

      debounce(this, this.setRowAttributes, 1000);
    }
    /* above getRowAttribute{,FromData}() use <cell data>[featureSymbol], which tableCoordsToFeature() does not. */
    if (! feature) {
      feature = tableCoordsToFeature(this.table, {row : visualRowIndex, col : visualColIndex});
    }
    return feature;
  },

  /** The row header is Feature Position if gtMergeRows, otherwise Feature name.
   * The row index is displayed if feature reference is not available.
   */
  rowHeaders(visualRowIndex) {
    const fnName = 'rowHeaders';
    const feature = this.getRowAttribute(this.table, visualRowIndex);
    let text;

    if (feature) {
      text = this.urlOptions.gtMergeRows ?
        feature?.value?.[0] :
        feature?.name;
      if (text === undefined) {
        // previous fall-back for gtMergeRows :  || feature?.Block?.[featureSymbol]?.value?.[0]
        dLog(fnName, text, feature);
      }
    } else {
        text = `${visualRowIndex}: `;
    }
    return text;
  },

  cells(row, col, prop) {
    let cellProperties = {};
    let selectedBlock = this.get('selectedBlock');
    let numericalData = ! this.blockSamples && this.get('numericalData');
    const sampleName = prop && columnName2SampleName(prop);
    /** much of this would be better handled using table options.columns,
     * as is done in table-brushed.js : createTable().
     */
    if ((typeof prop === 'string') && (prop.endsWith('Position') || prop.endsWith('End'))) {
      // see also col_name_fn(), table-brushed.js : featureValuesColumnsAttributes
      cellProperties.type = 'numeric';
    } else if (prop === 'Block') {
      cellProperties.renderer = 'blockColourRenderer';
    } else if (sampleName === 'LD Block') {
      cellProperties.renderer = 'haplotypeColourRenderer';
    } else if (sampleName === 'MAF') {
      cellProperties.type = 'numeric';
      cellProperties.renderer = 'numericalDataRenderer';
    } else if (prop === 'Name') {
      cellProperties.renderer = Handsontable.renderers.TextRenderer;
    } else if (this.gtDatasetColumns?.includes(prop)) {
      cellProperties.renderer = 'blockFeaturesRenderer';
    } else if (this.datasetColumns?.includes(prop)) {
      cellProperties.renderer = 'blockFeaturesRenderer';
    } else if (this.extraDatasetColumns?.includes(prop)) {
      cellProperties.renderer = 'blockFeaturesRenderer';
    } else if (numericalData) {
      cellProperties.renderer = 'numericalDataRenderer';
    } else if ((selectedBlock == null) || (this.selectedColumnName == null)) {
      cellProperties.renderer = 'CATGRenderer';
    } else {
      cellProperties.renderer = 'ABRenderer';
    }
    return cellProperties;
  },

  // ---------------------------------------------------------------------------

  /** handle click on a cell.
   * This callback is used when gtSelectColumn, supporting abValues / ABRenderer.
   * Note the selected column in .selectedColumnName
   * and set .selectedSampleColumn if .selectedColumnName and it is not Ref or Alt.
   */
  afterSelection(row, col) {
    const fnName = 'afterSelection';
    let col_name;
    const features = afterSelectionFeatures.apply(this, [this.table].concat(Array.from(arguments)));
    if (col !== -1) {
      const
      columnNames = this.get('columnNames');
      if (columnNames) {
        col_name = columnNames[col];
        // overlap with afterSelectionHaplotype()
        if (col_name.startsWith('LD Block')) {
          this.haplotypeToggleRC(row, col);
          return;
        }
        /* selectedColumnName may be Ref, Alt, or a sample column, not Position, End, LD Block,
         * or one of the *datasetColumns.
         */
        if (columnNameIsNotSample(col_name) &&
            this.columnNameIsDatasetColumn(col_name, false) ) {
          col_name = undefined;
        }
        dLog(fnName, col_name);
      }
    }
    this.set('selectedColumnName', col_name);
    /* const
    selectedRefAlt = refAltHeadings.includes(this.selectedColumnName);
    selectedSampleColumn = this.selectedColumnName && ! selectedRefAlt */
    this.set('selectedSampleColumn', col >= this.colSample0);

    if (! this.firstSelectionDone) {
      later(() => {
        if (this.isDestroying) { return; }
        this.firstSelectionDone = true;
        /** Render is not occurring on the first cell selection; current
         * work-around is to get abValues and rendererConfigEffect, and call
         * render().
         * rendererConfigEffect depends on abValues.
         */
        this.get('abValues');
        this.get('rendererConfigEffect');
        this.table?.render();
      });
    }
  },
  /** afterSelection callback when ! gtSelectColumn, 
   * for Ref / Alt columns it toggles the feature sample filter : featureToggleRC().
   * for 'LD Block' column it toggles the LD Block filter : haplotypeToggleRC().
   * For non-VCF column header (.datasetColumns), it shows a dialog to select additional feature fields
   */
  afterSelectionHaplotype(row, col) {
    const
    fnName = 'afterSelectionHaplotype',
    columnName = this.columnNames[col];
    let value, feature, features, tags;
    /** .sampleFilterTypeName is set via tab change in Controls tab. */
    const sampleFilterTypeName = this.userSettings.sampleFilterTypeName;
    dLog(fnName, row, col);
    if (col === -1) {
      /** Ctrl-A Select-All causes row===-1 and col===-1 */
    } else if (
      (row >= 0) && (sampleFilterTypeName === 'feature') && 
        (columnName.startsWith('Ref') || columnName.startsWith('Alt'))) {
      const feature = this.featureToggleRC(row, col, columnName);
      if (feature) {
        later(() => this.table.render(), 1000);
      }
    } else
    if (columnName.startsWith('LD Block')) {
    const ldBlock = this.haplotypeToggleRC(row, col);
    if (ldBlock) {
      later(() => this.table.render(), 1000);
    }
    } else if (
      this.datasetColumns.includes(columnName) &&
        (features = cellFeaturesWithDatasetTag(this.table, row, col, 'variantInterval'))
    ) {
      /* features[0] here is the variantInterval dataset feature, whereas
       * tableCoordsToFeature(t, {row, col}) returns the SNP feature.
       */
      const rowSNPFeature = tableCoordsToFeature(this.table, {row, col});
      this.variantIntervalToggle(rowSNPFeature, features[0]);
      this.filterSamplesBySelectedHaplotypes();
    } else if ((row === -1) && this.datasetColumns?.includes(columnName)) {
      /* plan to use columnNameIsDatasetColumn(columnName, false), but currently 
       * overlap with intersectionDialogDataset, which should be enabled also. */
      // row is header.
      /* this.datasetColumns is defined by gtMergeRows. */
      /* Related : afterOnCellMouseDown() -> toggleDatasetPositionFilter();
       * There is an overlap between afterSelectionHaplotype() and
       * afterOnCellMouseDown() - if they cover the same events and cells then
       * just 1 could be used.
       */
        const datasetId = columnName;
        this.featureColumnDialogDataset(datasetId);
    } else if (row === -1) {
      dLog(fnName, 'selectedColumnNames', this.selectedColumnNames.length, columnName);
      toggleObject(this.selectedColumnNames, columnName);
    }
  },

  /**
   * Called when user clicks in column header, i.e. row === -1.
   * @param shiftKey  event.shiftKey
   * @param col coords.col from afterOnCellMouseDown()
   * @return true if this column is one of .gtDatasetColumns[]
   */
  toggleDatasetPositionFilter(shiftKey, col) {
    const
    fnName = 'toggleDatasetPositionFilter',
    columnName = this.columnNames[col],
    isGt = this.gtDatasetColumns.includes(columnName);
    
    if (isGt && ! shiftKey) {
      // related : afterSelectionHaplotype() -> featureColumnDialogDataset(). changeDatasetPositionFilter
      const datasetId = columnName;
      this.intersectionDialogDataset(datasetId);
    } else if (isGt) {
      /** toggle dataset positionFilter */
      const
      dataset = this.colToDataset(col);
      if (dataset) {
        /* null -> true -> false */
        let pf = dataset.positionFilter;
        switch (pf) {
        default    :
        case null  : pf = true; break;
        case true  : pf = false; break;
        case false : pf = null; break;
        }
        dLog(fnName, dataset.positionFilter, '->', pf, dataset.id);
        dataset.positionFilter = pf;
        // currently just signals the change and updates the colHeader; could also make the change.
        this.changeDatasetPositionFilter(dataset, pf);
      }
    }
    return isGt;
  },

  // ---------------------------------------------------------------------------

  afterOnCellMouseDown(event, coords, td) {
    let block;
    if ((coords.col == -1) || (coords.col < this.colSample0)) {
      // no column or column does not identify a block
    } else if ((coords.row >= 0) && this.blockSamples) {
      let feature = this.getRowAttribute(this.table, coords.row, coords.col);
      /* no feature when select on column header.
       * block is not currently used when blockSamples anyway.
       */
      block = feature?.get('blockId');
    } else if (coords.row == -1) {
      if (event.ctrlKey) {
        // overlap with toggleDatasetPositionFilter()
        const
        row = coords.row,
        col = coords.col,
        columnName = this.columnNames[col],
        /** related : columnNameIsDatasetColumn() */
        isGt = this.gtDatasetColumns.includes(columnName);
        const datasetId = columnName;
        if (isGt) {
          this.featureColumnDialogDataset(datasetId);
        }
      } else
      if (! this.toggleDatasetPositionFilter(event.shiftKey, coords.col)) {
      let col_name = td.title || $(td).find('span').text();
      // ! this.blockSamples, so get .columns from .displayData
      block = this.get('columns')[col_name];
      }
    }
    /* selectBlock() causes a switch to the Dataset tab, which is not desired
     * when using the genotype tab.
     * For genotype / blockSamples, see : afterSelection() :  .selectedColumnName,  .selectedSampleColumn
     */
    if (block && ! this.blockSamples) {
      thenOrNow(block, (b) => this.attrs.selectBlock(b));
    }
  },

  /** Map from base letter to colour.
   * Used by base2ColourClass(), which can switch mappings to support different
   * colour schemes.
   * CATG are nucleotide (allele) values.
   * AB are comparison values, from ABRenderer.
   */
  baseColour : {
    A : 'green',
    C : 'blue',
    G : 'red',
    B : 'red',
    T : 'black',
  },
  /** Map from base letter to colour class.
   */
  base2ColourClass(base) {
    // related : this.baseColour[base]
    let colour = 'nucleotide_' + base;
    return colour;
  },
  /** map a single allele value to a colour class.
   * The value may be GT or TGT, i.e. [012] or [CATG].
  */
  avToColourClass(alleleValue) {
    let colour;
    if (valueIsCopies(alleleValue)) {
      colour = copiesColourClass(alleleValue);
    } else {
      colour = this.base2ColourClass(alleleValue);
    }
    return colour;
  },
  /** map prop : Ref / Alt -> copiesColourClass( 0 / 2)
   * @param typeof prop === 'string'
   */
  refAltCopyColour(prop) {
    const
    copyNum = (prop === 'Ref') ? '0' : '2',
    colour = copiesColourClass(copyNum);
    return colour;
  },

  CATGRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    if (value) {
      const
      /** prop may be String(), and string [].includes(String) does not match, so use .toString()
. */
      prop_string = prop.toString(),
      valueToColourClass = (this.displayForm === 'Numerical') && refAltHeadings.includes(prop_string) ?
        () => this.refAltCopyColour(prop_string) :
        this.avToColourClass.bind(this);
      /** value may be string or : Object { name: "20102 scaffold44824_8566554", value: "C", Symbol("feature"): <Feature Object> } */
      if (value.value !== undefined) {
        value = value.value;
        // instead of '[object Object]'
        td.textContent = value;
      }
      this.valueDiagonal(td, value, valueToColourClass);
      const selectFeatures = this.userSettings.sampleFilterTypeName === 'feature';
      /** Use this for 'LD Block' */
      const matchRefAlt = this.userSettings.haplotypeFilterRef ? 'Ref' : 'Alt';
      if (selectFeatures && refAltHeadings.includes(prop_string))
      {
        const
        dataset = prop[Symbol.for('dataset')],
        feature = this.getRowAttribute(this.table, row, 0);
        if (feature && this.featureIsFilter(feature, prop_string)) {
          td.classList.add('featureIsFilter');
        }
      }
    }
  },
  /**
   * @param prop string (not String)
   */
  featureIsFilter(feature, prop) {
    const
    block = feature.get('blockId.content'),
    featureFilters = block?.[sampleFiltersSymbol].feature,
    matchRef = feature[Symbol.for('matchRef')],
    featureIsFilter = featureFilters?.includes(feature),
    isFilter = featureIsFilter && (matchRef === (prop === 'Ref'));
    if (isFilter) {
      dLog('featureIsFilter', feature.value, feature.name, matchRef, prop);
    }
    return isFilter;
  },
  /**
   * The params td and value are from the Renderer signature.
   * @param td
   * @param value
   * @param valueToColourClass (alleleValue) -> colour string
   * where alleleValue is a single character from value, after splitting at | and /.
   * e.g. if value is '0/1' then alleleValue is '0' or '1'.
   */
  valueDiagonal(td, value, valueToColourClass) {
     // ./. should show as white, not diagonal.
    if (value === './.') {
      td.style.background = 'white';
    } else {
      let diagonal;
      /** value has been reduced : x/x -> x, so if value contains | or /
       * then it is heterozygous, i.e. diagonal.
       */
      let alleles = value.split(/[/|]/);
      if (alleles?.length === 2) {
        if (this.selectPhase === 'both') {
        diagonal = alleles[0] !== alleles[1];
        if (diagonal) {
          td.classList.add('diagonal-triangle');
        }
        } else {
          value = alleles[+this.selectPhase];
          $(td).text(value);
        }
      }
      /** colour classes */
      let colours = alleles.map(valueToColourClass);
      if (colours[0]) {
        td.classList.add(colours[0]);
      }
      if (diagonal && colours[1]) {
        const
        /** colour class */
        allele2Colour = colours[1],
        allele2Class = 'allele2-' + allele2Colour;
        td.classList.add(allele2Class);
      }

      /* default text colour is black.  if changing the background colour to
       * something other than white, set text colour to white.
       * copyNum_1 is white, and copyNum_0 and 2 are pale, so use black text.
       */
      if (! (this.displayForm === 'Numerical')) {
        td.style.color = 'white';
      }
    }
  },

  /** Compare the cell value against a selected column or the genome reference.
   * i.e. A/B comparison
   *
   * .selectedBlock and .selectedSampleColumn are not null
   */
  ABRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    const abValues = this.get('abValues'),
          refValue = abValues && abValues[row];
    if (value != null && refValue != null) {
      const
      /** false : GT (# of allele copies), true : TGT. */
      cellIsCATG = value.match(/[CATG]/),
      /** refValue not used in the showCopiesColour case - # of copies value is
       * relative to refValue, i.e. # of copies of refValue. */
      /** either true : show copies colour, or false : show AB (relative) colour
       * this.selectedColumnName is defined, so ! this.selectedSampleColumn means selected column is Ref/Alt.
       * If prop is Ref or Alt, use avToColourClass (CATG) if abValues[col] is #copies.
       * related : avToColourClass()
       * showCopiesColour:
       *        selectedSampleColumn
       *        false   true
       * CATG   false   false
       * 012    true    false
       */
      showValueColour = refAltHeadings.includes(prop) && valueIsCopies(abValues[col]),
      showCopiesColour = ! cellIsCATG && ! this.selectedSampleColumn,
      valueToColourClass = showValueColour ? this.base2ColourClass.bind(this) :
        showCopiesColour ? copiesColourClass : relativeColourClass;

      function relativeColourClass(alleleValue) {
        /** If showing a single colour instead of diagonal,  show 0/1 and 1/0 as 1. */
        const equalsReference = alleleValue === refValue;
        // related : coloursEqualsRef[+equalsReference];
        const colourClass = 'relativeColour_' + (equalsReference ? '' : 'un') + 'equal';
        return colourClass;
      }

      this.valueDiagonal(td, value, valueToColourClass);

      if (ABRendererShowAB) {
        const equalsReference = value === refValue;
        $(td).text(['B', 'A'][+equalsReference]);
      }
    }
  },

  numericalDataRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    let row_ranges = this.get('rowRanges');

    if (!isNaN(value)) {
      /** for MAF, use log(value), range of MAF is [0,1], log range of interest is mostly in [-5,0] */
      const
      isMAF = prop.startsWith('MAF'),
      domain = isMAF ? [-5, 0] : row_ranges[row],
      /** color_scale can be factored out - it is constant for all cells, apart from .domain(). */
      color_scale = d3.scaleLinear().domain(domain)
        .interpolate(d3.interpolateHsl)
        .range([d3.rgb("#0000FF"), d3.rgb('#FFFFFF'), d3.rgb('#FF0000')]),
      valueInDomain = isMAF ? Math.log10(value) : value,
      color = color_scale(valueInDomain);
      /* MAF has sufficient differences now to warrant splitting it off as a separate Renderer. */
      if (isMAF) {
        if (value !== null) {
          td.style.borderLeftColor = color;
          td.style.borderLeftStyle = 'solid';
          td.style.borderLeftWidth = '5px';
        }
      } else {
        td.style.background = color;
      }
      td.title = value;
      $(td).css('font-size', 10);
    }
  },

  /** The value is [new String(feature.name), ...], with [featureSymbol] referring
   * to the Feature;  all features are of a single block.
   * Show a colour rectangle of features' block colour.
   * Optionally show feature names.
   */
  blockFeaturesRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    if (value && !Array.isArray(value)) {
      value = [value];
    }
    if (value?.length) {
      let
      features = value.map(text => text[featureSymbol]);
      if (! features[0]) {
        const
        feature = this.getRowAttribute(instance, /*visualRowIndex*/ row);
        if (feature) {
          features = [feature];
        } else {
          td.title = undefined;
          return;
        }
      }

      const
      blockColourValue = featureBlockColourValue(features[0]),
      /** blockFeaturesRenderer() is used for Feature.name (datasetColumns) and
       * Feature.values[fieldName] (extraDatasetColumns). .name value is
       * enabled by showNonVCFFeatureNames, and .values[fieldName] value is
       * always displayed.
       *
       * Depending on showNonVCFFeatureNames and isFieldValue, show the value
       * text in the cell or in title (hoverText); if feature names are shown in
       * cell then show dataset:scope and value in title / hover.
       * isFieldValue is : (extraDatasetColumns : true, datasetColumns : false)
       */
      isFieldValue = this.extraDatasetColumns?.includes(prop),
      showValueText = this.userSettings.showNonVCFFeatureNames || isFieldValue,
      /** If table cell data is Feature[] instead of Feature.name [], then use 
       * value.mapBy('name')
       * Related comment in annotateRowsFromFeatures().
       */
      valueText = value.join(' '),
      cellText = showValueText ? valueText : ' ',
      hoverText = showValueText ?
        (isFieldValue ?
         features.mapBy('name').join('\n') :
         features.map(this.featureNameHoverText.bind(this) ).join('\n') )
        : valueText,
      tdStyle = td.style;
      tdStyle.borderLeftColor = blockColourValue;
      tdStyle.borderLeftStyle = 'solid';
      tdStyle.borderLeftWidth = '' + (isFieldValue ? 5 : this.cellSize) + 'px';
      td.title = hoverText;
      $(td).text(cellText);
    }
    const sampleFilterTypeName = this.userSettings.sampleFilterTypeName;
    if (sampleFilterTypeName === 'variantInterval') {
      /* or  features?.filter(
        feature => feature.get('blockId.datasetId.tags')?.includes('variantInterval')); */
      const
      viFeatures = cellFeaturesWithDatasetTag(this.table, row, col, 'variantInterval');
      if (viFeatures?.length) {
          const
          rowFeature = this.getRowAttribute(instance, /*visualRowIndex*/ row),
          block = rowFeature?.get('blockId'),
          sampleFilters = block?.content[sampleFiltersSymbol],
          isSelected = sampleFilters?.variantInterval.includes(viFeatures[0]);
          if (isSelected) {
            td.classList.add('featureIsFilter');
          }
        }
      }

  },

  featureNameHoverText(feature) {
    const
    text =
      feature.get('blockId.brushName') +
      '  [' + feature.get('value').join(' - ') + ']';
    return text;
  },

  /** The .text is a rgb() block colour; show it as a colour rectangle.
   */
  blockColourRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    const colour = $(td).text();
    td.style.background = colour;
    $(td).text(' ');
  },

  /** The .text is LD Block / Haplotype, currently represented as a numeric tSNP value;
   * equal values are in the same tagged-SNP-set.
   * Allocate a column per set, within the LD Block column.
   * Assign a unique colour to each set.
   * Show a rectangle coloured with the set colour, in the set column.
   * @param instance  this Handsontable
   */
  haplotypeColourRenderer(instance, td, row, col, prop, value, cellProperties) {
    /** based on blockColourRenderer(). */
    Handsontable.renderers.TextRenderer.apply(instance, arguments);
    const
    tSNP = $(td).text();
    if ((tSNP !== undefined) && (tSNP !== '') && (tSNP !== '.') && (tSNP !== '0')) {
      const
      haplotypes = this.haplotypes,
      haplotype = haplotypes[tSNP] || (haplotypes[tSNP] = {column : this.haplotypeColumn++}),
      colour = this.haplotypeColourScale(tSNP); // originally haplotype.column
      td.style.background = colour;
    }
    $(td).text(' ');
  },

  //----------------------------------------------------------------------------

  /** Map from tSNP number to column offset.
   * Each LD Block / tSNP / "haplotype" is allocated the next successive column offset.
   *
   * The original specification was for the display to offset the colour block
   * in the LD Block / tSNP / Haplotype column, so that tSNP sets could be correlated
   * visually; this may not be necessary because the colour block makes it
   * fairly clear; this may be re-evaluated when larger numbers of sets cause
   * colour cycling in the palette.
   *
   * There may be multiple tSNP columns in the genotype table - on one axis
   * there may be multiple VCF datasets with tSNP - the plan is to have a
   * separate colum for each; then these attributes .haplotypes,
   * .haplotypeColumn, .haplotypeColourScale should be per-dataset.
   */
  haplotypes : {},
  /** Current column offset - this will be used for the next LD Block / tSNP / haplotype.
   */
  haplotypeColumn : 0,

  /** Map from column offset (maybe later tSNP number) to the colour assigned to
   * this tSNP (Tagged SNP set).  */
  haplotypeColourScale : alias('haplotypeService.haplotypeColourScale'),

  // ---------------------------------------------------------------------------

  /** When configuration of one of the Renderers changes, re-render.
   */
  rendererConfigEffect : computed('abValues', 'rowRanges', function () {
    if (this.urlOptions.gtPlainRender & 0b1000) {
      this.table?.render();
    }
  }),

  // ---------------------------------------------------------------------------


  noData: computed('displayData.[]', 'displayDataRows.[]', function() {
    let d = this.get('displayData.length') || this.get('displayDataRows.length') ;
    return ! d;
  }),
  /** Map displayData[] to object mapping from column names of each column to
   * the column data.
   * @return array[col_name] -> column data (block)
   */
  columns: computed('displayData.[]', function() {
    let data = this.get('displayData');
    let cols = {};
    data?.forEach(function(d) {
      let col_name = col_name_fn(d);
      cols[col_name] = d;
    });
    return cols;
  }),
  /** index of the first sample column.
   * 2 or 4 if Ref & Alt
   */
  colSample0 : 2,
  columnNames : computed('columns', 'columnNamesParam', function() {
    const columnNames = this.columnNamesParam || Object.keys(this.get('columns'));
    this.set('colSample0', this.blockSamples ? columnNames.indexOf('Alt') + 1 : 0);
    dLog('columnNames', columnNames, this.colSample0);
    return columnNames;
  }),
  colHeaders : computed('columnNames', 'datasetPositionFilterChangeCount', function() {
    const colHeaders = this.get('columnNames').map((columnName) => {
      const
      dataset = columnName[datasetSymbol],
      /** fieldName may be sampleName, or other fields name, Ref/Alt, MAF, LD Block */
      [fieldName, datasetId] = columnName.split('\t'),
      datasetId_ = datasetId || (dataset && Ember_get(dataset, 'id')),
      datasetClass = datasetId_ ? ' col-Dataset-' + datasetId2Class(datasetId_) : '',
      // or dataset = this.colToDataset(col), using map() index;
      positionFilterClass = this.positionFilterClass(columnName),
      positionFilterIcon = positionFilterClass ?
        '<i class="glyphicon glyphicon-' + positionFilterClass + '"></i>' : '',
      extraClassName = this.columnNameToClasses(fieldName),
      colHeader = '<div class="head' + extraClassName + datasetClass  + '">'
        + positionFilterIcon
        + fieldName + '</div>';
      return colHeader;
    });
    return colHeaders;
  }),
  gtDatasetColumnIndexes : computed('columnNames', 'gtDatasetColumns', function () {
    const
    /** related : getColAttribute(col) assumes gtDatasetColumns[i] is in column i.
     */
    columnIndexes = this.gtDatasetColumns
      .map(columnName => this.columnNames.indexOf(columnName));
    return columnIndexes;
  }),
  gtDatasetFeatures(row) {
    const
    features = this.gtDatasetColumnIndexes
      .map(col => this.getRowAttribute(this.table, row, col)),
    /** If a genome doesn't have a feature on a row then its dataset cell will
     * not have a value so getRowAttribute() will get no valueFeature and the
     * row feature will be returned, so remove duplicates.  */
    unique = [].addObjects(features);
    return unique;
  },
  positionFilterEffect : computed('datasetPositionFilterChangeCount', function () {
    const fnName = 'positionFilterEffect';
    if (this.table) {
      const settings = {
        colHeaders: this.colHeaders,
      };
      dLog(fnName);
      this.table.updateSettings(settings);
    }
  }),
  /** @return true if the named column has a dataset attribute
   * @param onlyBlock if true exclude extraDatasetColumns, i.e.
   * include only the 'Block' column of each dataset, which shows a
   * rectangle with dataset colour, or feature name.
   */
  columnNameIsDatasetColumn(columnName, onlyBlock) {
    let columnNameLists = [this.gtDatasetColumns, this.datasetColumns];
    if (! onlyBlock) {
      columnNameLists.push(this.extraDatasetColumns);
    }
    // gtDatasetColumns were called 'Block' until 53c7c59f
    const
    isDatasetColumn =
      columnNameLists.find(
        (columnNames) => columnNames?.includes(columnName));
    return isDatasetColumn;
  },
  /** Map from physical columnIndex to dataset.

   * This supports only gtDatasetColumns ; to support also datasetColumns /
   * nonVCF.columnNames and extraDatasetColumns would require passing the
   * corresponding datasets as params to matrix-view.
   */
  getColAttribute(col) {
    const dataset = this.gtDatasets[col];
    return dataset;
  },
  colToDataset(col) {
    const dataset = this.getColAttribute(col);
    return dataset;
  },


  /** Map from columnName to CSS class names for the header element or data cell.
   * Used by colHeaders() and columnNamesToColumnOptions().
   * Some classNames are used by CSS selectors only in colHeaders, some are only used in cells.
   */
  columnNameToClasses(columnName) {
      let extraClassName;
      /** dataset columns : gtDatasetColumns datasetColumns :
       * . column header displays Dataset .displayName;
       * . cell displays Block colour
       * . title is Feature.name
       * extraDatasetColumns show Block colour in a thin border-left rectangle.
       * The column headers display vertically.
       */
      if (this.gtDatasetColumns?.includes(columnName)) {
        extraClassName = ' col-Dataset-Name col-Genotype';
      } else if (this.datasetColumns?.includes(columnName)) {
        extraClassName = ' col-Dataset-Name';
      } else if (this.extraDatasetColumns?.includes(columnName)) {
        /* column header displays fieldName; cell displays Feature.values[fieldName];
         * for selected field names, listed in extraDatasetColumns
         */
        extraClassName = ' col-Dataset-Values';
      } else {
        extraClassName = columnNameIsNotSample(columnName) ? '' : ' col-sample';
      }
      /** specific classes for Position and Alt : col-Position, col-Alt
       * header :
       * . Position column is wide, so set margin-left to centre the header text horizontally;
       * data cell :
       * . place a white border on the right side of 'Alt' column, i.e. between Alt and the sample columns.
       */
    if (columnName === 'Position') {
      extraClassName +=  ' col-' + columnName;
    } else if (columnName.startsWith('Alt')) {
      extraClassName +=  ' col-' + 'Alt';
    }
    return extraClassName;
  },
  columnNamesToColumnOptions(columnNames) {
    const
    columns =
      columnNames.map((name, columnIndex) => {
        const
        width = this.colWidths(columnIndex),
        options = {data : name, width};
        options.className = this.columnNameToClasses(name);

        if (name.startsWith('LD Block')) {
          options.afterSelection = bind(this, this.afterSelectionHaplotype);
        }
        return options;
      });
    return columns;
  },
  /** @return a class name for the positionFilter status of columnName which is a datasetId
   * @param columnName datasetId
   */
  positionFilterClass(columnName) {
    let className;
    const
    col = this.gtDatasetColumns.indexOf(columnName),
    dataset = this.colToDataset(col);
    let pf;
    if (dataset &&
        (typeof (pf = dataset.positionFilter) === "boolean")) {
      // possibly : 'col-positionFilter-' + pf
      className = pf ? 'plus' : 'minus';
    }
    return className;
  },
  /** Depending on gtMergeRows :       false | true
   * the rowHeader (left) column is :  Name  | Position
   * and so this column is hidden in the body of the table.
   */
  hideColumns() {
    const
    table = this.table,
    hiddenColumnsPlugin = table.getPlugin('hiddenColumns'),
    gtMergeRows = this.urlOptions.gtMergeRows,
    hide = {
      Position : gtMergeRows,
      Name : ! gtMergeRows,
    };
    this.columnNames?.forEach((name, columnIndex) => {
      const action = hide[name];
      if (action !== undefined) {
        if (action) {
          hiddenColumnsPlugin.hideColumn(columnIndex);
        } else {
          hiddenColumnsPlugin.showColumn(columnIndex);
        }
      }
    });
    /* this makes hideColumn() effective */
    table.render();

  },
  /** For each value in .rows (row names), measure the length of the text
   * rendering using #length_checker, and return the maximum length.
   */
  rowHeaderWidth: computed('rows', function() {
    let rows = this.get('rows');
    let longest_row = 0;
    let length_checker = $("#length_checker");
    rows.forEach(function(r) {
      let w = length_checker.text(r).width();
      if (w > longest_row) {
        longest_row = w;
      }
    });
    return longest_row + 10;
  }),
  /** For each key (column name) of .columns{}, measure the length of the text
   * representation using #length_checker, and return the maximum length.
   */
  colHeaderHeight: computed('columnNames', function() {
    /** pixel length of longest column header text */
    let longest = 0;
    let length_checker = $("#length_checker");
    length_checker.css('font-weight', 'bold');
    this.get('columnNames').forEach(function(col_name) {
      let w = length_checker.text(col_name).width();
      if (w > longest) {
        longest = w;
      }
    });
    return longest + 20;
  }),
  /** For each value (column data / block / sample)  of .columns{},
   *   for each feature,
   *     rows[feature_name][col_name] = feature value (using .value[0])
   *  Set .numericalData true if any feature value is not a number
   * @return rows[feature_name][col_name]
   */
  dataByRow: computed('displayDataRows', /*'displayData.[]',*/ 'columns', 'columnNames', function() {
    let rows = this.displayDataRows || this.dataByRowFromColumns;
    return rows;
  }),
  get dataByRowFromColumns() {
    const fnName = 'dataByRowFromColumns';
    let nonNumerical = false;
    let rows = {};
    let cols = this.get('columns');
    Object.entries(cols).forEach(function([col_name, col]) {
      Ember_get(col, 'features').forEach(function(feature) {
        /** param feature is a proxy wrapping one value of featureObj. */
        /** feature may be undefined in the {gt,,extra}DatasetColumns */
        if (feature === undefined) {
          return;
        }
        let feature_name = feature.name;
        if (rows[feature_name] == null) {
          rows[feature_name] = {};
        }

        const
        row = rows[feature_name],
        /** copy feature object reference from proxy to row. */
        rowFeature = row[featureSymbol],
        featureObj = feature[featureSymbol];
        if (featureObj) {
          if (! rowFeature) {
            row[featureSymbol] = featureObj;
          } else if (featureObj != rowFeature) {
            /* dataByRowFromColumns() is used for ! gtMergeRows, so each row
             * references a single feature. */
            dLog(fnName, rowFeature, '!==', featureObj);
          }
        }

        let value = feature.value;
        if (Array.isArray(value)) {
          value = value[0];
        }
        row[col_name] = value;

        if (isNaN(value)) {
          nonNumerical = true;
        }
      });
    });
    this.set('numericalData', !nonNumerical);
    return rows;
  },
  /** @return an array of the keys of .dataByRow, i.e. the feature names
   */
  rows: computed('dataByRow', function() {
    let data = this.get('dataByRow');
    dLog('rows', 'dataByRow', data);
    return Object.keys(data);
  }),
  /** @return [] if selectedBlock is null, otherwise
   * return just an array of data of the selected column.
   */
  abValues: computed('dataByRow', 'selectedBlock', 'selectedColumnName', function() {
    let data = this.get('dataByRow');
    let selectedBlock = this.get('selectedBlock');
    /** selectedBlock is a parameter to this component.
     * if ! .blockSamples then afterSelection could signal selectBlock, setting
     * .selectedBlock, or this could use .selectedColumnName directly.
     */
    let col_name = this.blockSamples ?
        this.get('selectedColumnName') :
        selectedBlock && col_name_fn(selectedBlock);
    let values = [];

    if (col_name != null) {
      const dataIsRows = this.displayDataRows === data;
      if (dataIsRows) {
        const
        /** incidental : these values have [featureSymbol] */
        selectedValues = Object.values(data).map((fv) => fv[col_name]);
        values = selectedValues;
      } else {
      // equiv: Object.values(data).mapBy(col_name)
      Object.keys(data).forEach(function(row_name) {
        values.push(data[row_name][col_name]);
      });
      }
    }
    return values;
  }),
  /** @return an array of, for each row, an object mapping col_name to cell data (feature)
   */
  data: computed(/*'displayData.[]'*/ 'columnNames', 'rows', 'dataByRow', function() {
    let rows = this.get('rows');
    let dataByRow = this.get('dataByRow');

    let data = [];
    rows.forEach((row_name) => {
      const rowData = dataByRow[row_name];
      let d  = {};
      this.get('columnNames').forEach(function(col_name) {
        d[col_name] = rowData[col_name];
      });
      /** for gtMergeRows, Position is a hidden column; if it were not in
       * columnNames, then this reference could be used by dataRowCmp().
       */
      d[Symbol.for('Position')] = rowData.Position;
      /** for ! gtMergeRows, row corresponds to a single feature, which is referenced by rowData.  */
      const feature = rowData[featureSymbol];
      if (feature) {
        d[featureSymbol] = feature;  
      }
      data.push(d);
    });
    return data;
  }),
  /** Produce a TSV which is suited for copy / paste via the clipboard into a spreadsheet.
   * Similar to data(), but returning rows as arrays instead of objects,
   * and include the column header row and the row header (Position / Name) column.
   * @return an array of, for each row, an array of : row header, cells in the order of .columnNames
   * @desc
   * This function overlaps with beforeCopy(); that function is given a copy of
   * the data in the selection and mutates it, whereas this uses the whole table
   * data and maps it.
   */
  dataClipboard : computed('columnNames', 'rows', 'dataByRow', function() {
    const
    fnName = 'dataClipboard',
    rows = this.get('rows'),
    dataByRow = this.get('dataByRow'),
    data = rows
      .map((row_name) => {
        const
        rowData = dataByRow[row_name],
        d = this.get('columnNames')
          .map(col_name => rowData[col_name]);
        return d;
      });
    /** data[*] is e.g. string or String or 
     * Object { name: "20102 scaffold38755_1190119", value: "C", Symbol("feature"): {...} }
     * The following selects out the .value, but may be useful for the user
     * select which field/s to copy, e.g. feature name or other
     * feature.values. ...
     */

    // prepend the column headers
    data.unshift(this.columnNames);
    const
    text = data
      .map(d => d.map(c => (c === undefined) ? '' : (c.value || c)).join('\t'))
      .join('\n');

    return text;
  }),
  /** Pre-process the selected data when the user does rectangle-select and
   * Ctrl-C Copy.
   * Convert non-string cell data to string : i.e. String via .toString(),
   * Object using .value which is string.
   * Prepend column headers for the selected columns if the selection includes
   * the first row.
   * Could similarly prepend the row headers to each rowData; currently
   * gtMergeRows includes Position in the table so only !gtMergeRows feature
   * name is missed.
   */
  beforeCopy(data, coords) {
    const fnName = 'beforeCopy';
    /** If there are multiple selections, not clear whether user would want the
     * column headers, so omit them.
     * If the selection includes the first row, then probably the selection is
     * whole columns or whole table, so prepend the column headers.
     * When the user selects using the column headers - i.e. whole columns, then
     * startRow is 0.
     */
    let columnHeaders;
    if ((coords.length === 1) && (coords[0].startRow === 0)) {
      const c0 = coords[0];
      columnHeaders = this.columnNames.slice(c0.startCol, c0.endCol + 1)
        .map(header => header.replaceAll('\t', ' : '));
    }
    /* the requirements for processing cellData here is the same as
     * dataClipboard(). */
    data.forEach(rowData => {
      rowData.forEach((cellData, col) => {
        if (cellData === undefined) {
          rowData[col] = '';
        } else if (cellData.value) {
          rowData[col] = cellData.value;
        } else if (typeof cellData === 'object') {
          rowData[col] = cellData.toString();
        }
      });
    });
    if (columnHeaders) {
      data.unshift(columnHeaders);
    }
  },
  /** For each row, collate an array of cell data for each column,
   * and determine [min, avg, max] of each row.
   * For genotype / blockSamples : numeric value may be 0, 1, 2.
   * @return an array of, for each row, [min, avg, max]
   */
  rowRanges: computed('dataByRow', function() {
    let data = this.get('dataByRow');

    let all_values = {};
    Object.entries(data).forEach(function([row_name, row]) {
      if (all_values[row_name] == null) {
        all_values[row_name] = [];
      }
      Object.keys(row).forEach(function(col_name) {
        all_values[row_name].push(row[col_name]);
      });
    });

    let ranges = [];
    Object.keys(all_values).forEach(function(row_name) {
      let row = all_values[row_name];
      let min = Infinity;
      let max = -Infinity;
      let avg = 0;
      let sum = 0;
      row.forEach(function(x) {
        if (! isNaN(x)) {
          sum += x;
          if (x < min) {
            min = x;
          }
          if (x > max) {
            max = x;
          }
        }
      });
      // avg is not used
      avg = sum / row.length;
      ranges.push([min, avg, max]);
    });
    return ranges;
  }),

  /** Observe changes to .rows and .selectedBlock, and update table.
   */
  updateTableObserver: observer(/*'displayData.[]'*/ 'rows', 'selectedBlock', function() {
    this.updateTableOnce();
  }),
  /** Update table settings with
   * column headings from keys(.data), .rows, .rowHeaderWidth, .colHeaderHeight.
   */
  updateTable() {
    const fnName = 'updateTable';
    let t = $("#observational-table");
    if (calculateTableHeight) {
      tableHeight = this.tableHeightFromParent(t[0]);
    }
    let rows = this.get('rows');
    let rowHeaderWidth = this.get('rowHeaderWidth');
    let colHeaderHeight = this.userSettings.columnHeaderHeight || this.get('colHeaderHeight');
    let table = this.get('table');
    let data = this.get('data');
    const gtPlainRender = this.urlOptions.gtPlainRender;
    dLog('matrix-view', fnName, t, rows.length, rowHeaderWidth, colHeaderHeight, tableHeight, table, data, this.blockSamples && 'vcf');

    if (gtPlainRender & 0b10000) {
      this.hideColumns();
    }

    if (data.length > 0) {
      t.show();
      const
      columns = this.columnNamesToColumnOptions(this.columnNames);
      if (this.get('selectedColumnName') && ! this.columnNames.includes(this.selectedColumnName)) {
        this.set('selectedColumnName', null);
      }

      const
      largeArea = (table.countRows() * table.countCols() > 300) || (data.length > 50),
      /** Repeat of table.updateSettings() dates from the original version,
       * e9fb0c0f; probably 2 rounds of rendering enabled handsontable to
       * calculate required sizes for content. not clear if still required - try
       * without and after updating handsontable.
       * Disable it for performance when the table area is large.
       */
      repeat = largeArea ? 1 : 2;
      for(let i=0; i<repeat; i++) {
        const settings = {
          colHeaders: this.colHeaders,
          columns,
          rowHeaderWidth: rowHeaderWidth,
          rowHeights : this.rowHeights,
        };
        // .data is required, so invert the flag
        if (! (gtPlainRender & 0b100000)) {
          // this can be enabled as an alternative to progressiveRowMergeInBatch().
          settings.data = data;
        }
        if (this.fullPage) {
          settings.columnHeaderHeight = colHeaderHeight;
        } else {
          let nRows = rows.length;
          settings.height = tableHeight; // nRows2HeightEx(nRows) + 'ex';
        }
        const startTime = Date.now();
        console.time(fnName + ':updateSettings');
        table.updateSettings(settings);
        /* try setting meta references to features in batchRender().
         * In previous attempts it seemed to cause O(n2) rendering of cells.
         */
        this.table.batchRender(bind(this, this.setRowAttributes));
        if (gtPlainRender & 0b100000) {
          this.progressiveRowMergeInBatch();
        }
        const endTime = Date.now();
        console.timeEnd(fnName + ':updateSettings');
        if (trace > 1) {
          const
          timeMeasure =
            'rows : ' + table.countRows() +
            ', cols : ' + table.countCols() +
            ', time : ' + (endTime - startTime) + ' ms';
          /** displaying via { {this.timeMeasure}} in hbs causes re-render, so display using jQuery. */
          $('#timeMeasure').text(timeMeasure);
        }
      }
      if (gtPlainRender & 0b10000000) {
        this.setRowAttributes();
      }
    } else {
      // alternative to .data
      if (gtPlainRender & 0b100000) {
        this.progressiveRowMergeInBatch();
      }
      t.hide();
    }
    this.afterScrollVertically_tablePosition();
  },

  setRowAttributes() {
    const
    dataIsRows = !!this.displayDataRows;
    let data;
    if (dataIsRows) {
      /** if gtMergeRows then displayDataRows is sparse, indexed by Position.  */
      data = this.urlOptions.gtMergeRows ?
        Object.values(this.displayDataRows) :
        this.displayDataRows;
    } else if (this.displayData.length && this.columnNames.length) {  // check .displayData because there may be no current data
      let featureColumn = this.columnNames.indexOf('Position');
      if (featureColumn === -1) {
        featureColumn = 0;
      }
      data = this.displayData[featureColumn].features;
    }
    if (data) {
      setRowAttributes(this.table, data, dataIsRows);
    }
  },

  afterScrollVertically() {
    later(() => ! this.isDestroying && this.progressiveRowMergeInBatch(), 1000);
  },

  progressiveRowMergeInBatch() {
    this.table.batchRender(bind(this, this.progressiveRowMerge));
  },

  progressiveRowMerge() {
    const fnName = 'progressiveRowMerge';
    if (this.isDestroying) { return; }

    /** .currentData somehow gets out of sync with table.getData(); in this case set
     * .currentData from table data; this may help to identify the cause; also may switch
     * to simply using table.getData() instead of .currentData, having added
     * dataRowArrayCmp() and dataRowArrayKeyFn() to support currentData[*] being arrays.
     */
    const
    tData = this.table.getData(),
    currentData = this.currentData;
    if ((currentData.length !== tData.length) /*||
        (currentData.length && (currentData[0].Position !== tData[0][col_Position]))*/) {
      dLog(fnName, 'currentData', currentData, tData);
      this.set('currentData', tData);
    }

    this.continueMerge =
      tableRowMerge(this.table, this.data, this.currentData, this.columnNames, this.colHeaders);
    if (this.continueMerge) {
      later(() => ! this.isDestroying && this.progressiveRowMergeInBatch(), 1000);
    } else {
      /* setRowAttributes() has no effect for rows outside the viewport;
       * these are handled by afterScrollVertically() -> setRowAttributes().
       */

      /* this.rowHeaders() is based on row reference to feature.
       * after setRowAttributes(), they can be displayed.
       */

      /** setRowAttribute() is already done by tableRowMerge(), so this
       * setRowAttributes() is nominal; this is too late (rowHeaders() is
       * already called) and the call in updateTable() is too early - before
       * table data is populated.
       */
      this.setRowAttributes();
      // required for initial display of rowHeaders
      this.table?.render();
    }
  },

  actions: {
    toggleLeftPanel() {
      $(".left-panel-shown").toggle();
      $(".left-panel-hidden").toggle();
    },
  },

  updateTableTask: task(function * () {
    const fnName = 'updateTableTask';
    dLog(fnName);
    try {
      this.updateTable();
    } catch(e) {
      dLog(fnName, 'error', e);
    } finally {
    }
  }).keepLatest(),

  updateTableOnce() {
    const
    fnName = 'updateTableOnce',
    table = this.get('table');
    dLog(fnName);
    if (! table) {
      dLog(fnName, 'table', table);
      // in practice, a call will occur later after table is created.
    } else {
      this.get('updateTableTask')
        .perform()
        .catch((error) => {
          // Recognise if the given task error is a TaskCancelation.
          if (! didCancel(error)) {
            dLog(fnName, 'taskInstance.catch', error);
            throw error;
          } else {
          }
        });
    }
  },

  //----------------------------------------------------------------------------

  showSelectedBlockObserver: observer('selectedBlock', function() {
    this.showSelectedBlock(this.selectedBlock);
  }),

  showSelectedBlock(selectedBlock) {
    dLog('showSelectedBlock', selectedBlock);
    let table = this.get('table');

    $("ul#display-blocks > li").removeClass('selected');
    $('#matrix-view').find('table').find('th').find('span').removeClass('selected');
    if (selectedBlock != null) {
      $('ul#display-blocks > li[data-chr-id="' + selectedBlock.id + '"]').addClass("selected");
      let col_name = col_name_fn(selectedBlock);
      table.selectColumns(col_name);
      $('#matrix-view').find('table').find('th').find('span:contains("' + col_name + '")').addClass('selected');
    }
  },

  //----------------------------------------------------------------------------

  /** Called from selection in LD Block / Haplotype column, which will toggle selection of this LD Block / Haplotype (tSNP).
   * manage-genotype passes in action haplotypeToggle, with signature (feature, haplotype).
   * @return LD Block : feature.values.tSNP
   */
  haplotypeToggleRC(row, col) {
    const
    fnName = 'haplotypeToggleRC',
    coords = {row, col},
    feature = this.getRowAttribute(this.table, coords.row, coords.col);
    /** LD Block */
    let haplotype;
    /** afterSelectionHaplotype() gets called while table is re-rendering, and feature is undefined */
    if (feature) {
      haplotype = feature.values?.tSNP;
      dLog(fnName, coords, feature.name, haplotype);
      if (haplotype) {
        this.haplotypeToggle(feature, haplotype);
        this.filterSamplesBySelectedHaplotypes();
      }
    }
    return haplotype;
  },

  //----------------------------------------------------------------------------

  filterSamplesBySelectedHaplotypes() {
    this.filterSamples(this.showHideSampleFn.bind(this), this);
  },
  showHideSampleFn(sampleName, counts) {  
    // counts is now distance, replacing {matches,mismatches}.
    if (counts !== undefined) {
      const
      hide = counts,
      columnIndex = this.columnNames.indexOf(sampleName),
      table = this.table,
      hiddenColumnsPlugin = table.getPlugin('hiddenColumns');
      if (hide) {
        hiddenColumnsPlugin.hideColumn(columnIndex);
      } else {
        hiddenColumnsPlugin.showColumn(columnIndex);
      }
    }
    /* caller will do table.render() to make hideColumn() effective */
  },

  //----------------------------------------------------------------------------

  /** Called from selection in Ref / Alt columns, which will toggle selection of
   * this Feature / SNP.
   * manage-genotype passes in action featureToggle, with signature (feature, columnName).
   * @return feature
   * @desc
   * Based on haplotypeToggleRC()
   */
  featureToggleRC(row, col, columnName) {
    const
    fnName = 'featureToggleRC',
    coords = {row, col},
    feature = this.getRowAttribute(this.table, coords.row, coords.col);
    /** afterSelectionHaplotype() gets called while table is re-rendering, and feature is undefined */
    if (feature) {
      dLog(fnName, coords, feature.name, columnName);
      /** Apply the toggle to all genotype features on the row,
       * gtDatasetFeatures(row), which is expected to include the
       * feature from coords.col.
       * features contains unique values - important for the toggle operation.
       */
      const features = this.gtDatasetFeatures(row);
      dLog(fnName, features.map(f => f.get('blockId.brushName')));
      features.addObject(feature);
      features.forEach(feature => 
        this.featureToggle(feature, columnName));
      this.filterSamplesBySelectedHaplotypes();
    }
    return feature;
  },

  //----------------------------------------------------------------------------

  /** based on axis width resizer in axis-2d.js */

  /** Called when resizer element for column header height resize is dragged.
   * @param d data of the resizer elt
   */
  resizedByDrag(height, dy, eltSelector, resizable, resizer,  resizerElt, d)
  {
    dLog("resizedByDrag", height, dy, eltSelector, resizable.node(), resizer.node(),  resizerElt, d);
    this.setColumnHeaderHeight(height, dy);
  },
  /**
   * @param columnHeaderHeight initially .colHeaderHeight, then resizer height
   */
  setColumnHeaderHeight(columnHeaderHeight) {
    /* In the case of manage-genotype (i.e. ! fullPage), matrix-view does not
     * use this, instead .height = tableHeightFromParent(), enabled by calculateTableHeight.
     *
     * Use Ember_set() because selectedSampleEffect() is dependent on
     * columnHeaderHeight
     */
    Ember_set(this.userSettings, 'columnHeaderHeight', columnHeaderHeight);
    const body = d3.select('body');
    body.style('--matrixViewColumnHeaderHeight', columnHeaderHeight + 'px');
    const
    table = this.get('table'),
    settings = {
      columnHeaderHeight
    };
    table.updateSettings(settings);
  },
  defaultColumnHeaderHeight() {
    const body = d3.select('body');
    if (! body.style('--matrixViewColumnHeaderHeight')) {
      const height = this.get('colHeaderHeight') || 300;
      body.style('--matrixViewColumnHeaderHeight', '' + height + 'px');
    }
  },
  /** listen for drag adjustment of column header height. */
  dragResizeListen() {
    this.defaultColumnHeaderHeight();
    const
    fnName = 'dragResizeListen',
    /** .gtResizeHeader is outside of tableContainerSelector */
    resizeSel = '.gtResizeHeader > div';
    $(resizeSel).height(this.get('colHeaderHeight'));
    /** as well as passing vertical=true, also : class="resizer vertical" */
    let dragResize = eltWidthResizable(resizeSel, undefined, bind(this, this.resizedByDrag), /* vertical*/ true);
    dragResize.filter(noKeyfilter/*filter*/);
    if (! dragResize) {
      dLog(fnName, resizeSel);
    }
    /** axis-2d also does dragResize.on('{start,end}' ), resize{Start,End}ed,  */
  },

  //----------------------------------------------------------------------------

});
