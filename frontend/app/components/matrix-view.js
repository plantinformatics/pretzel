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
  setRowAttributes,
  getRowAttribute,
  getRowAttributeFromData,
  afterOnCellMouseOverClosure,
  tableCoordsToFeature,
  highlightFeature,
} from '../utils/panel/axis-table';
import { afterSelectionFeatures } from '../utils/panel/feature-table';
import { featureBlockColourValue, valueIsCopies } from '../utils/data/vcf-feature';
import { toTitleCase } from '../utils/string';
import { thenOrNow } from '../utils/common/promises';
import { tableRowMerge } from '../utils/draw/progressive-table';


// -----------------------------------------------------------------------------

const dLog = console.debug;
const trace = 1;

const featureSymbol = Symbol.for('feature');

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
  return ['Block', 'Name', 'Position', 'End', 'LD Block', 'MAF'].includes(column_name);
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
   */
  const
  datasetId = Ember_get(column, 'datasetId.id'),
  /** if datasetId is '' or undefined / null, then ':' separator is not required.
   * This is true for non-sample columns, e.g. Position, End, Ref, Alt, LD Block
   */
  col_name = (! datasetId ? '' : datasetId + ':')  + Ember_get(column, 'name');
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
 * @param displayDataRows
 * @param columnNamesParam
 * @param selectBlock action
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

  /** current row data array which has been given to table.
   * This is updated progressively from .data by progressiveRowMerge().
   * .currentData is the reference / snapshot for the progress of data update.
   */
  currentData : [],

  // ---------------------------------------------------------------------------

  didInsertElement() {
    this._super.apply(this, arguments);

    dLog('matrix-view', this, 'vcf');
    this.fullPage = ! this.blockSamples;
    // later(() => ! this.isDestroying && this.createTable(), 1000);
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
    width =
      featureValuesWidths[columnName] ||
      (this.datasetColumns?.includes(columnName) ? (this.userSettings.showNonVCFFeatureNames ? 180 : 25) : 

      /* works, but padding-left is required also, to move the text.
      columnIndex === this.colSample0 ?
      25 + 3 :
      */
       25);
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

  createTable() {
    const fnName = 'createTable';
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
      rowHeights : '24px',
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

    if (gtPlainRender & 0b100) {
      table.addHook('afterRender', this.afterRender.bind(this));
    }
  },

  highlightFeature,

  // ---------------------------------------------------------------------------

  afterRender(isForced) {
    const scope = this.dataScope;
    if (scope) {
      this.showTextInTopLeftCorner(scope);
    }
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
    /** gtMergeRows : datasetId is not displayed, so width is not set  */
    let ot = d3.select('#observational-table');
    ot.classed('gtMergeRows', this.urlOptions.gtMergeRows);
  },


  /** The row header is Feature Position if gtMergeRows, otherwise Feature name.
   * The row index is displayed if feature reference is not available.
   */
  rowHeaders(visualRowIndex) {
    let feature = this.table && getRowAttribute(this.table, visualRowIndex, /*col*/undefined);
    let text;
    if (! feature) {
      /** or !!this.displayDataRows ... */
      const dataIsRows = this.displayDataRows === this.get('dataByRow');
      const data = dataIsRows ? this.displayDataRows : this.displayData;
      feature = getRowAttributeFromData(this.table, data, dataIsRows, visualRowIndex);

      debounce(this, this.setRowAttributes, 1000);
    }

    if (feature) {
      text = this.urlOptions.gtMergeRows ?
        feature?.value?.[0] || feature?.Block?.[featureSymbol]?.value?.[0] :
        feature?.name;
    } else {
        text = `${visualRowIndex}: `;
    }
    return text;
  },

  cells(row, col, prop) {
    let cellProperties = {};
    let selectedBlock = this.get('selectedBlock');
    let numericalData = ! this.blockSamples && this.get('numericalData');
    /** much of this would be better handled using table options.columns,
     * as is done in table-brushed.js : createTable().
     */
    if ((typeof prop === 'string') && (prop.endsWith('Position') || prop.endsWith('End'))) {
      // see also col_name_fn(), table-brushed.js : featureValuesColumnsAttributes
      cellProperties.type = 'numeric';
    } else if (prop === 'Block') {
      cellProperties.renderer = 'blockColourRenderer';
    } else if (prop === 'LD Block') {
      cellProperties.renderer = 'haplotypeColourRenderer';
    } else if (prop === 'MAF') {
      cellProperties.type = 'numeric';
      cellProperties.renderer = 'numericalDataRenderer';
    } else if (prop === 'Name') {
      cellProperties.renderer = Handsontable.renderers.TextRenderer;
    } else if (this.datasetColumns?.includes(prop)) {
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
        if (col_name === 'LD Block') {
          this.haplotypeToggleRC(row, col);
          return;
        }
        /* selectedColumnName may be Ref, Alt, or a sample column, not Block, Position, End, LD Block. */
        if (columnNameIsNotSample(col_name)) {
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
  afterSelectionHaplotype(row, col) {
    dLog('afterSelectionHaplotype', row, col);
    const ldBlock = this.haplotypeToggleRC(row, col);
    if (ldBlock) {
      later(() => this.table.render(), 1000);
    }
  },

  // ---------------------------------------------------------------------------

  afterOnCellMouseDown(event, coords, td) {
    let block;
    if ((coords.col == -1) || (coords.col < this.colSample0)) {
      // no column or column does not identify a block
    } else if (this.blockSamples) {
      let feature = tableCoordsToFeature(this.table, coords);
      /* no feature when select on column header.
       * block is not currently used when blockSamples anyway.
       */
      block = feature?.get('blockId');
    } else if (coords.row == -1) {
      let col_name = $(td).find('span').text();
      // ! this.blockSamples, so get .columns from .displayData
      block = this.get('columns')[col_name];
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
      valueToColourClass = (this.displayForm === 'Numerical') && refAltHeadings.includes(prop) ?
        () => this.refAltCopyColour(prop) :
        this.avToColourClass.bind(this);
      this.valueDiagonal(td, value, valueToColourClass);
    }
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
       * copyNum_1 is white.
       */
      if (! colours.includes('copyNum_1')) {
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
      isMAF = prop === 'MAF',
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

  /** The value is [feature,];  all features are of a single block.
   * Show a colour rectangle of features' block colour.
   * Optionally show feature names.
   */
  blockFeaturesRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    if (value?.length) {
      const
      feature = value[0],
      blockColourValue = featureBlockColourValue(feature),
      featureNames = this.userSettings.showNonVCFFeatureNames ? value.mapBy('name').join(' ') : ' ',
      tdStyle = td.style;
      tdStyle.borderLeftColor = blockColourValue;
      tdStyle.borderLeftStyle = 'solid';
      tdStyle.borderLeftWidth = '25px';
      $(td).text(featureNames);
    }
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
    if ((tSNP !== undefined) && (tSNP !== '') && (tSNP !== '.')) {
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
  /** identify the reference datasetId and scope of the axis of the genotype
   * datasets which are displayed in the table.
   * There could be multiple such axes - only the first is identified.
   * This is displayed in the top-left corner of the table.
   */
  dataScope : computed('displayData.[]', function() {
    let text, feature;
    if (this.displayDataRows) {
      if (this.displayDataRows.length) {
        const rowData = this.displayDataRows[this.displayDataRows.length - 1];
        feature = rowData?.Block[Symbol.for('feature')];
      }
    } else {
      feature = this.displayData?.[0]?.features
      ?.[0]
      ?.[Symbol.for('feature')];
    }
    if (feature) {
      const
      block = feature.blockId,
      datasetId = block?.get('referenceBlockOrSelf.datasetId.id'),
      scope = block?.get('scope');
      if (scope) {
        text = scope;
        /* gtMergeRows : rowHeader is Position, which is narrower than name, and
         * datasetId gets truncated and moves the centre (where scope is
         * positioned) out of view, so omit it.
         */
        if (datasetId && ! this.urlOptions.gtMergeRows) {
          text = datasetId + ' ' + text;
        }
      }
    }
    return text;
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
  colHeaders : computed('columnNames', function() {
    const colHeaders = this.get('columnNames').map(function(x) {
      let extraClassName = columnNameIsNotSample(x) ? '' : ' col-sample';
      /** specific classes for Position and Alt :
       * . Position column is wide, so set margin-left to centre the header text horizontally;
       * . place a white border on the right side of 'Alt' column, i.e. between Alt and the sample columns.
       */
      if (['Position', 'Alt'].includes(x)) {
        extraClassName +=  ' col-' + x;
      }
      return '<div class="head' + extraClassName + '">' + x + '</div>';
    });
    return colHeaders;
  }),
  columnNamesToColumnOptions(columnNames) {
    const
    columns =
      columnNames.map((name, columnIndex) => {
        const
        width = this.colWidths(columnIndex),
        options = {data : name, width};
        if (! columnNameIsNotSample(name)) {
          options.className = 'col-sample';
        }
        if (name === 'Alt') {
          options.className += ' col-Alt';
        }
        if (name === 'LD Block') {
          options.afterSelection = bind(this, this.afterSelectionHaplotype);
        }
        return options;
      });
    return columns;
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
    let nonNumerical = false;
    let rows = {};
    let cols = this.get('columns');
    Object.entries(cols).forEach(function([col_name, col]) {
      Ember_get(col, 'features').forEach(function(feature) {
        let feature_name = feature.name;
        if (rows[feature_name] == null) {
          rows[feature_name] = {};
        }
        let value = feature.value;
        if (Array.isArray(value)) {
          value = value[0];
        }
        rows[feature_name][col_name] = value;

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
      data.push(d);
    });
    return data;
  }),
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

  /** Observe changes to .rows and .selectedBlock, and update table settings with
   * column headings from keys(.data), .rows, .rowHeaderWidth, .colHeaderHeight.
   */
  updateTable: observer(/*'displayData.[]'*/ 'rows', 'selectedBlock', function() {
    const fnName = 'updateTable';
    let t = $("#observational-table");
    if (calculateTableHeight) {
      tableHeight = this.tableHeightFromParent(t[0]);
    }
    let rows = this.get('rows');
    let rowHeaderWidth = this.get('rowHeaderWidth');
    let colHeaderHeight = this.get('colHeaderHeight');
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
  }),

  setRowAttributes() {
    const
    dataIsRows = !!this.displayDataRows,
    /** if gtMergeRows then displayDataRows is sparse, indexed by Position.  */
    data = dataIsRows ?
      ( this.urlOptions.gtMergeRows ? Object.values(this.displayDataRows) : this.displayDataRows) :
      this.displayData;
    setRowAttributes(this.table, data, dataIsRows);
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
    feature = tableCoordsToFeature(this.table, coords);
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
    this.haplotypeFilterSamples(this.showHideSampleFn.bind(this), this);
  },
  showHideSampleFn(sampleName, counts) {
    if (counts.matches || counts.mismatches) {
      const
      hide = counts.mismatches,
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

});
