import { computed, observer } from '@ember/object';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { get as Ember_get, set as Ember_set } from '@ember/object';
import { later, once, bind } from '@ember/runloop';

import { task, didCancel } from 'ember-concurrency';


/* global Handsontable */
/* global $ */
/* global d3 */

import config from '../config/environment';


// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

/** map from block ( + sample) to column name.
 * @param column block / selectedBlock or column object
 */
function col_name_fn(column) {
  /** If column is block then block.get('datasetId.id') requires .get();
   * otherwise column can be a native JS object, so use Ember_get() to handle either case.
   */
  const col_name = Ember_get(column, 'datasetId.id') + ':' + Ember_get(column, 'name');
  return col_name;
}

/** For use when ! .fullPage, calculate ex height for the given number of rows,
 * with a maximum which gives a nearly full height table.
 */
function nRows2HeightEx(nRows) {
  // 2 -> 6ex : only 1 row visible; may need an base offset - try adding 5ex
  return 5 + Math.min(nRows || 2, 30) * 3;
}

// -----------------------------------------------------------------------------

/**
 * Component args :
 * @param selectedBlock
 * @param displayData
 *  columns [] -> {features -> [{name, value}...],  datasetId.id, name }
 * 
 * @param blockSamples  true if blocks contain multiple samples (each column is a sample)
 * false if each column is a block (dataset : chromosome)
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
 *   noData		<- displayData.[]
 *   columns		<- displayData.[]
 *   rowHeaderWidth		<- rows
 *   colHeaderHeight		<- columns
 *   dataByRow		<- columns (<- displayData.[])  (and .set(numericalData))
 *   rows		<- dataByRow
 *   abValues		<- dataByRow, selectedBlock
 *   data		<- columns, rows, dataByRow  (<- displayData.[])
 *   rowRanges		<- dataByRow
 *   updateTable: observer('rows', 'selectedBlock') (<- displayData.[])
 *
 * Cell Renderers :
 *   CATGRenderer
 *   ABRenderer : abValues
 *   numericalDataRenderer : rowRanges
 *
 *   renderer =
 *     numericalData ? numericalDataRenderer :
 *        selectedBlock ? ABRenderer : CATGRenderer
 *
 * Actions / events :
 *   afterOnCellMouseDown -> selectBlock (column name)
 */
export default Component.extend({
  /** this may move up to matrix-view-page
  style: 'height:100%; width:100%',
  attributeBindings: ['style:style'],
 */
  numericalData: true,

  selectedBlock: null,

  // ---------------------------------------------------------------------------

  didInsertElement() {
    this._super.apply(this, arguments);

    dLog('matrix-view', this, 'vcf');
    this.fullPage = ! this.blockSamples;
    // later(() => ! this.isDestroying && this.createTable(), 1000);
  },

  didRender() {
    once(() => ! this.isDestroying && this.createOrUpdateTable());
  },

  createOrUpdateTable() {
    if (this.table) {
      this.updateTable();
    } else {
      this.createTable();
      if (this.displayData.length) {
        this.updateTableOnce();
      }
    }
  },

  // ---------------------------------------------------------------------------

  /** 
   *    selectPhase : string : '0', '1'
   */

  /** The user can toggle the phase of a diploid which is shown by CATGRenderer. */
  selectPhase : '0',
  selectPhaseChanged(value) {
    dLog('selectPhaseChanged', value);
    this.selectPhase = value;
  },

  // ---------------------------------------------------------------------------

  createTable() {
    const fnName = 'createTable';

    let tableDiv = $("#observational-table")[0];
    dLog(fnName, tableDiv);
    let nRows = this.get('rows.length') || 0;
    let settings = {
      /* see comment re. handsOnTableLicenseKey in frontend/config/environment.js */
      licenseKey: config.handsOnTableLicenseKey,
      data: [],
      readOnly: true,
      rowHeaders: true,
      manualColumnMove: true,
      height: this.fullPage ? '100%' : nRows2HeightEx(nRows) + 'ex',
      colWidths: 25,
      stretchH: 'none',
      cells: bind(this, this.cells),
      afterOnCellMouseDown: bind(this, this.afterOnCellMouseDown)
    };
    let table = new Handsontable(tableDiv, settings);

    Handsontable.renderers.registerRenderer('CATGRenderer', bind(this, this.CATGRenderer));
    Handsontable.renderers.registerRenderer('ABRenderer', bind(this, this.ABRenderer));
    Handsontable.renderers.registerRenderer('numericalDataRenderer', bind(this, this.numericalDataRenderer));

    this.set('table', table);
  },

  // ---------------------------------------------------------------------------

  cells(row, col, prop) {
    let cellProperties = {};
    let selectedBlock = this.get('selectedBlock');
    let numericalData = this.get('numericalData');
    if (numericalData) {
      cellProperties.renderer = 'numericalDataRenderer';
    } else if (selectedBlock == null) {
      cellProperties.renderer = 'CATGRenderer';
    } else {
      cellProperties.renderer = 'ABRenderer';
    }
    return cellProperties;
  },

  afterOnCellMouseDown(event, coords, td) {
    if (coords.row == -1) {
      let col_name = $(td).find('span').text();
      this.send('selectBlock', this.get('columns')[col_name]);
    }
  },

  /** Map from base letter to colour.
   * Used by base2Colour(), which can switch mappings to support different
   * colour schemes.
   */
  baseColour : {
    A : 'green',
    C : 'blue',
    G : 'red',
    B : 'red',
    T : 'black',
  },
  base2Colour(base) {
    let colour = this.baseColour[base];
    return colour;
  },
  CATGRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    if (value) {
      let diagonal;
      let alleles = value.split(/[/|]/);
      if (alleles) {
        diagonal = alleles[0] !== alleles[1];
        if (diagonal) {
          td.classList.add('diagonal-triangle');
        }
        // value = alleles[+this.selectPhase];
      }
      let colours = alleles.map(this.base2Colour.bind(this));
      if (colours[0]) {
        td.style.background = colours[0];
        td.style.color = 'white';
      }
      if (diagonal && colours[1]) {
        const
        allele2Colour = colours[1],
        allele2Class = 'allele2-' + allele2Colour;
        td.classList.add(allele2Class);
      }
    }
  },

  ABRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    let abValues = this.get('abValues');
    if (value != null && abValues[row] != null) {
      if (value == abValues[row]) {
        td.style.background = 'green';
        td.style.color = 'white';
        $(td).text('A');
      } else {
        td.style.background = 'red';
        td.style.color = 'white';
        $(td).text('B');
      }
    }
  },

  numericalDataRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    let row_ranges = this.get('rowRanges');

    if (!isNaN(value)) {
      let color_scale = d3.scaleLinear().domain(row_ranges[row])
          .interpolate(d3.interpolateHsl)
          .range([d3.rgb("#0000FF"), d3.rgb('#FFFFFF'), d3.rgb('#FF0000')]);
      td.style.background = color_scale(value);
      td.title = value;
      $(td).css('font-size', 10);
    }
  },

  // ---------------------------------------------------------------------------


  noData: computed('displayData.[]', function() {
    let d = this.get('displayData');
    return ! d?.length;
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
  colHeaderHeight: computed('columns', function() {
    let cols = this.get('columns');
    /** pixel length of longest column header text */
    let longest = 0;
    let length_checker = $("#length_checker");
    length_checker.css('font-weight', 'bold');
    Object.keys(cols).forEach(function(col_name) {
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
  dataByRow: computed(/*'displayData.[]',*/ 'columns', function() {
    let nonNumerical = false;
    let rows = {};
    let cols = this.get('columns');
    Object.keys(cols).forEach(function(col_name) {
      let col = cols[col_name];
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
  }),
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
  abValues: computed('dataByRow', 'selectedBlock', function() {
    let data = this.get('dataByRow');
    let selectedBlock = this.get('selectedBlock');
    let values = [];

    if (selectedBlock != null) {
      let col_name = col_name_fn(selectedBlock);
      Object.keys(data).forEach(function(row_name) {
        values.push(data[row_name][col_name]);
      });
    }
    return values;
  }),
  /** @return an array of, for each row, an object mapping col_name to cell data (feature)
   */
  data: computed(/*'displayData.[]'*/ 'columns', 'rows', 'dataByRow', function() {
    let cols = this.get('columns');
    let rows = this.get('rows');
    let dataByRow = this.get('dataByRow');

    let data = [];
    rows.forEach(function(row_name) {
      let d  = {};
      Object.keys(cols).forEach(function(col_name) {
        d[col_name] = dataByRow[row_name][col_name];
      });
      data.push(d);
    });
    return data;
  }),
  /** For each row, collate an array of cell data for each column,
   * and determine [min, avg, max] of each row.
   * @return an array of, for each row, [min, avg, max]
   */
  rowRanges: computed('dataByRow', function() {
    let data = this.get('dataByRow');

    let all_values = {};
    Object.keys(data).forEach(function(row_name) {
      let row = data[row_name];
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
        sum += x;
        if (x < min) {
          min = x;
        }
        if (x > max) {
          max = x;
        }
      });
      avg = sum / row.length;
      ranges.push([min, avg, max]);
    });
    return ranges;        
  }),

  /** Observe changes to .rows and .selectedBlock, and update table settings with
   * column headings from keys(.data), .rows, .rowHeaderWidth, .colHeaderHeight.
   */
  updateTable: observer(/*'displayData.[]'*/ 'rows', 'selectedBlock', function() {
    let t = $("#observational-table");
    let rows = this.get('rows');
    let rowHeaderWidth = this.get('rowHeaderWidth');
    let colHeaderHeight = this.get('colHeaderHeight');
    let table = this.get('table');
    let data = this.get('data');
    dLog('matrix-view', 'updateTable', t, rows, rowHeaderWidth, colHeaderHeight, table, data, this.blockSamples && 'vcf');

    if (data.length > 0) {
      t.show();
      let columns = Object.keys(data[0]);
      columns = columns.map(function(x) {
        return '<div class="head">' + x + '</div>';
      });

      for(let i=0; i<2; i++) {
        const settings = {
          colHeaders: columns,
          rowHeaders: rows,
          rowHeaderWidth: rowHeaderWidth,
          data: data
        };
        if (this.fullPage) {
          settings.columnHeaderHeight = colHeaderHeight;
        } else {
          let nRows = rows.length;
          settings.height = nRows2HeightEx(nRows) + 'ex';
        }
        table.updateSettings(settings);
      }
    } else {
      t.hide();
    }
  }),
  
  actions: {
    toggleLeftPanel() {
      $(".left-panel-shown").toggle();
      $(".left-panel-hidden").toggle();
    },
  },

  updateTableTask: task(function * () {
    const fnName = 'updateTableTask';
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
  }

});
