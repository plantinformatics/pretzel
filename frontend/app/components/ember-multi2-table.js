import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import { action } from '@ember/object';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { later } from '@ember/runloop';

import config from 'pretzel-frontend/config/environment';

//------------------------------------------------------------------------------

import NamesFilters from '../utils/data/names-filters';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

import PanelPassportTableComponent from './ember-multi2-select';
console.log('PanelPassportTableComponent', PanelPassportTableComponent);
const
prototype = PanelPassportTableComponent.prototype,
fieldsUniqueValues = Object.getOwnPropertyDescriptor(prototype, 'fieldsUniqueValues').get,
columns = Object.getOwnPropertyDescriptor(prototype, 'columns').get,
nameFieldEntries = Object.getOwnPropertyDescriptor(prototype, 'nameFieldEntries').get,
sampleData = Object.getOwnPropertyDescriptor(prototype, 'sampleData').get,
tableData = Object.getOwnPropertyDescriptor(prototype, 'tableData').get,
searchData = Object.getOwnPropertyDescriptor(prototype, 'searchData').get;


//------------------------------------------------------------------------------

/** class added to <tr> which are selected */
const isSelectedClass = 'is-selected';

const
isDevelopment =
  (config.environment === 'development') &&
  ! config.apiHost.endsWith('3000');


// Utility: case/locale/numeric aware compare
function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return  1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Component args :
 * @param userSettings
 * @param dataset
 * @param samples
 * @param rows	same as samples, omitted, but later will rename samples to rows.
 * @param selectSampleArray
 * @param sampleNamePassportValues
 */
export default class EmberMulti2TableComponent extends Component {
  //----------------------------------------------------------------------------
  // from passport-table.js
  //----------------------------------------------------------------------------

  /** Per-column category filter values : [fieldName] -> [passport data values, ...] */
  selectedFieldValues = {};
  /** Per-column search filter values : [fieldName] -> search string */
  fieldSearchString = {};
  /** Per-column filter implementing fieldSearchString. [fieldName] -> NamesFilter  */
  fieldNamesFilters = {};

  @tracked
  /** Count of changes to selectedFieldValues, for dependency. */
  selectedFieldValuesCount = 0;
  @tracked
  /** Count of changes to columns[].namesFilters.nameFilterArray, for dependency. */
  namesFiltersCount = 0;

  idField = this.args.idFieldName || 'GenotypeId'; 
  /** indicate that idField is prepended to columns. */
  idFieldInColumns = true;

  /** Limit the number of sample / accession names displayed in the selection list.
   * See also @userSettings.samplesLimit which is the number of samples which may be
   * selected at once.
   */ 
  samplesListLimit = 20; // isDevelopment ? 20 : 2000;


  //------------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.emberMulti2Table = this;
    }
  }

  //------------------------------------------------------------------------------
  /** for this commit, import these methods from passport-table;
   * a subsequent commit will combine the passport-table{,-html-row} components
   * by factoring out the multi-column multi-row-select table to a library.
   */
  get fieldsUniqueValues() { return fieldsUniqueValues.apply(this); }
  get columns() { return columns.apply(this); }
  get nameFieldEntries() { return nameFieldEntries.apply(this); }
  get sampleData() { return sampleData.apply(this); }
  get tableData() { return tableData.apply(this); }
  get searchData() { return searchData.apply(this); }

  /** Create a NamesFilters if there is not already one for fieldName.
   * The reason for persisting these is that changes to .nameFilter are
   * debounced, so re-creating this in .columns() and setting .nameFilter
   * does not filter.
   */
  newNamesFilters(fieldName, filterChanged) {
    const
    nf = this.fieldNamesFilters[fieldName] ||
      (this.fieldNamesFilters[fieldName] = new NamesFilters(filterChanged));
    return nf;
  }

  //----------------------------------------------------------------------------

  /** User action which selects a value of a Passport field, to add/remove to
   * the corresponding column filter, implemented by mismatch in tableData().
   */
  @action
  selectFieldValue(column, target) {
    const
    fnName = 'selectFieldValue',
    selectedOptions = target.selectedOptions,
    // related : selectedGroupChangedId() in components/form/select-multiple.js
    options = Array.from(selectedOptions).mapBy('value');
    dLog(fnName, target, selectedOptions, options, column);
    this.selectedFieldValues[column.property] = options;
    this.selectedFieldValuesCount++;
  }

  @computed('selectedFieldValuesCount')
  get selectedFieldValuesTexts() {
    const
    texts = this.columns.reduce((ts, column) => {
      const
      text = this.selectedFieldValues[column.property]?.join(', ');
      ts[column.property] = text;
      return ts;
    }, {});
    return texts;
  }

  //----------------------------------------------------------------------------

  // From https://chatgpt.com/share/68d0e67a-7428-800e-85e2-e31ee741ece3


  // --- Sorting ---
  @tracked sortBy = null;     // e.g. 'sampleName'
  @tracked sortDir = 'asc';   // 'asc' | 'desc'

  // --- Selection like <select multiple> ---
  /** store stable row keys (e.g. GenotypeId / sample / accession id) */
  @tracked selectedKeys = new Set(); // stable keys for rows
  @tracked focusIndex = 0;           // index in visible (sorted+filtered) rows
  anchorIndex = null;                // start of shift-range

  /** Provide a stable key extractor. Override via @rowKey or ensure rows have `id`.
   * This works for either @rows which is {Array<string>} or
   * this.sortedRows which is {Array<row data>}
   */
  rowKey = (row) => {
    const
    text =
      typeof row === 'string' ? row :
       (typeof this.args.rowKey === 'function') ?
       this.args.rowKey(row) :
       row.GenotypeId ?? row.id ?? row.sampleName ?? row.accession ?? JSON.stringify(row);
    return text;
  };

  /*/ Wire to your existing filtering pipeline if you have one
  get filteredRows() {
    // If you already compute filtered rows elsewhere, return that instead
    return this.args.rows ?? [];
  }
  */
  @alias('tableData') filteredRows;

  @computed('filteredRows', 'sortBy', 'sortDir')
  get sortedRows() {
    const rows = this.filteredRows; // .slice(0,20); // [...this.filteredRows];
    if (!this.sortBy) return rows;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => cmp(a[this.sortBy], b[this.sortBy]) * dir);
  }

  get activeRowId() {
    const r = this.sortedRows[this.focusIndex];
    return r ? `row-${this.rowKey(r)}` : null;
  }

  // Convenience for template
  isSelected(row) {
    // dLog('isSelected', row, this.selectedKeys.size);
    return this.selectedKeys.has(this.rowKey(row));
  }
  isSelectedBound = (row) => this.isSelected(row);

  selectedRowsArray() {
    const key = this.rowKey;
    const set = this.selectedKeys;
    // Use the full dataset if you want selections to persist across filtering
    /* (currently @rows is just the GenotypeIds, whereas .sortedRows contains
     * the full row data; rowKey() handles this). */
    const source = this.args.samples /*rows*/ ?? this.sortedRows;
    return source.filter((r) => set.has(key(r)));
  }

  notify() {
    const selectedIds = this.selectedRowsArray();
    // Bubble up for Pretzel to consume
    // onSelectionChange is not currently used.
    this.args.onSelectionChange?.(selectedIds);
    this.args.selectSampleArray(selectedIds, true);
  }

  // --- Sorting actions ---
  @action toggleSort(property, evt) {
    // Don't change selection anchors when sorting
    evt?.preventDefault?.();
    if (this.sortBy === property) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = property;
      this.sortDir = 'asc';
    }
  }

  // --- Selection helpers ---
  selectOnly(index) {
    const key = this.rowKey(this.sortedRows[index]);
    this.selectedKeys = new Set([key]);
    this.focusIndex = index;
    this.anchorIndex = index;
    this.notify();
  }

  toggleIndex(index) {
    const key = this.rowKey(this.sortedRows[index]);
    const next = new Set(this.selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.selectedKeys = next;
    this.focusIndex = index;
    if (this.anchorIndex == null) this.anchorIndex = index;
    this.notify();
  }

  /** Select rows from anchorIndex to toIndex.
   * As indicated by `additive`, either add the given range to .selectedKeys or set .selectedKeys to the range.
   * @param {number} toIndex
   * @param {boolean} additive  true means add to the selection, otherwise set the selection
   * @param {number=} fromIndex optional start of range, default is .anchorIndex, which
   * defaults to toIndex, i.e. 1 row
   */
  selectRange(toIndex, additive, fromIndex) {
    if (this.anchorIndex == null) this.anchorIndex = toIndex;
    fromIndex ?? (fromIndex = this.anchorIndex);
    /** or const [start, end] = [fromIndex, toIndex].sort()  */
    const [start, end] = [
      Math.min(fromIndex, toIndex),
      Math.max(fromIndex, toIndex),
    ];

    const next = additive ? new Set(this.selectedKeys) : new Set();
    for (let i = start; i <= end; i++) next.add(this.rowKey(this.sortedRows[i]));
    this.selectedKeys = next;
    this.focusIndex = toIndex;
    this.notify();
  }

  clearSelection() {
    this.selectedKeys = new Set();
    this.anchorIndex = null;
    this.notify();
  }

  selectAllVisible() {
    const next = new Set(this.sortedRows.map((r) => this.rowKey(r)));
    this.selectedKeys = next;
    this.anchorIndex = 0;
    this.focusIndex = 0;
    this.notify();
  }

  clampIndex(i) {
    const n = this.sortedRows.length;
    if (n === 0) return 0;
    return Math.max(0, Math.min(n - 1, i));
    }

  // --- Mouse selection like listbox ---
  @action onRowClick(row, index, event) {
    // Ignore clicks originating from interactive controls in the row (links, buttons, inputs)
    const t = event.target;
    if (t.closest('a,button,input,select,textarea,[role="button"],[contenteditable="true"]')) {
      return;
    }

    const meta = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;

    if (shift) {
      // Extend range from anchor to clicked row; additive if meta also pressed
      this.selectRange(index, meta);
    } else if (meta) {
      // Toggle clicked row
      this.toggleIndex(index);
    } else {
      // Single selection (like clicking an option in <select multiple>)
      this.selectOnly(index);
    }
  }

  // Prevent text selection drags during shift-selection
  @action onMouseDownPreventSelection(event) {
    if (event.shiftKey) event.preventDefault();
  }

  // --- Keyboard navigation/selection like <select multiple> ---
  @action onKeyDown(event) {
    /** Testing shows that user actions do not trigger both onKeyDown() and
     * mousedown listener.
     */

    const { key, ctrlKey, metaKey, shiftKey } = event;
    const meta = ctrlKey || metaKey;

    dLog('onKeyDown', key, ctrlKey, metaKey, shiftKey);
    const n = this.sortedRows.length;
    if (n === 0) return;
    /** Allow user to edit the <input id="nameFilter" > */
    if (event.target.tagName === 'INPUT' ) return;

    const move = (delta) => {
      const next = this.clampIndex(this.focusIndex + delta);
      if (shiftKey) {
        this.selectRange(next, true); // extend, additive
      } else {
        this.focusIndex = next;
        this.anchorIndex = next;
        // Keep selection as-is unless you want single-select on move:
        // this.selectOnly(next);
      }
      event.preventDefault();
    };

    switch (key) {
      case 'ArrowDown': return move(1);
      case 'ArrowUp':   return move(-1);
      case 'Home': {
        const next = this.clampIndex(0);
        shiftKey ? this.selectRange(next, true) : (this.focusIndex = next, this.anchorIndex = next);
        return event.preventDefault();
      }
      case 'End': {
        const next = this.clampIndex(n - 1);
        shiftKey ? this.selectRange(next, true) : (this.focusIndex = next, this.anchorIndex = next);
        return event.preventDefault();
      }
      case 'a':
      case 'A':
        if (meta) { this.selectAllVisible(); return event.preventDefault(); }
        break;
      case 'Escape':
        this.clearSelection(); return event.preventDefault();
      case ' ':
      case 'Spacebar':
        this.toggleIndex(this.focusIndex); return event.preventDefault();
      case 'Enter':
        // Optional: treat Enter like space (toggle)
        this.toggleIndex(this.focusIndex); return event.preventDefault();

      /* ignored : Shift, Control, Alt */
    }
  }

  //----------------------------------------------------------------------------
  // Generated via Google search : "html table callback click-drag selection" / Gemini

  /**
   *
2. JavaScript for Event Handling:
Use JavaScript to attach event listeners to the table cells and manage the selection state.
   * @param table	<table  id="passport-table" >
   */
  @action
  registerListeners(table) {

    const self = this;
    this.table = table; // or document.getElementById('passport-table');
    let isMouseDown = false;
    let startCell = null;

    // Function to handle cell selection
    function selectCells(start, end, additive) {
      const headerRows = 1;
      dLog('selectCells', start, end);
      // Clear any existing selections
      table.querySelectorAll('.' + isSelectedClass).forEach(cell => cell.classList.remove(isSelectedClass));

      /* Get row and cell indices.
       * Subtract headerRows from .rowIndex to translate to the table data index.
       */
      const startRowIndex = start.closest('tr').rowIndex - headerRows;
      const startCellIndex = start.cellIndex;
      const endRowIndex = end.closest('tr').rowIndex - headerRows;
      const endCellIndex = end.cellIndex;

      // Determine the selection rectangle
      const minRow = Math.min(startRowIndex, endRowIndex);
      const maxRow = Math.max(startRowIndex, endRowIndex);
      const minCol = Math.min(startCellIndex, endCellIndex);
      const maxCol = Math.max(startCellIndex, endCellIndex);

      /** Enable this to select cells within the rectangle. */
      const rectangleSelect = false;
      for (let r = minRow; r <= maxRow; r++) {
        const row = table.rows[r];
        /* select the row */
        row.classList.add(isSelectedClass);
        if (rectangleSelect) {
          for (let c = minCol; c <= maxCol; c++) {
            if (row && row.cells[c]) {
              row.cells[c].classList.add(isSelectedClass);
            }
          }
        }
      }
      /* This does not update .anchorIndex if it is defined.
       * Perhaps .anchorIndex should be set to endRowIndex.
       */
      self.selectRange(endRowIndex, additive, startRowIndex);

      // You can trigger a callback here with the selected cells' data
      // For example:
      // onSelectionChange(getSelectedCellData());
    }

    // Event listeners
    table.addEventListener('mousedown', (e) => {
      dLog('mousedown', e.target.tagName, e.target.innerText);
      if (e.target.tagName === 'TD') {
        isMouseDown = true;
        startCell = e.target;
        /* Instead of using e.preventDefault() to prevent default text selection,
         * this is achieved via .no-select : user-select: none;
         */
        /* Set keyboard focus on the clicked element, to enable following keyboard
         * actions, defined in onKeyDown().
         */
        e.target.focus();
      }
    });

    table.addEventListener('mouseover', (e) => {
      // console.log('mouseover', e);
      if (isMouseDown && e.target.tagName === 'TD' && startCell) {
        /** e : altKey, ctrlKey, metaKey, shiftKey  */
        const additive = e.shiftKey;
        selectCells(startCell, e.target, additive);
      }
    });

    table.addEventListener('mouseup', () => {
      // console.log('mouseup');
      isMouseDown = false;
      startCell = null;
      // You might want to trigger a final callback here after selection is complete
    });

    //----------------------------------------------------------------------------
    /* moreDidInsertSetup() is not related to registerListeners(), except that
     * its contents are also required at did-insert, i.e. just temporal cohesion
     * / coupling / binding.
     */
    later(() => this.moreDidInsertSetup(), 2000);
  }
  moreDidInsertSetup() {
    this.args.scrolledDiv.addEventListener('scroll', this.scrollListener);
    // now done in paged-data.js : constructor() -> refresh() -> loadPage.perform( )
    // this.args.getNextPage();
  }

  /*
  document.addEventListener('DOMContentLoaded', function() {
    registerListeners();
  });
  */

  //------------------------------------
  /*
4. Callback Implementation (Optional):
You can define a callback function that is executed when the selection changes or is finalized. This function would receive information about the selected cells.
 */
  onSelectionChange(selectedData) {
    console.log('Selected cells data:', selectedData);
    // Perform actions based on the selected data
  }

  getSelectedCellData() {
    const selectedCells = this.table.querySelectorAll('.selected');
    const data = [];
    selectedCells.forEach(cell => {
      data.push({
        rowIndex: cell.closest('tr').rowIndex,
        cellIndex: cell.cellIndex,
        value: cell.textContent
      });
    });
    return data;
  }

  //----------------------------------------------------------------------------

  @action
  scrollListener(event) {
    const
    fnName = 'scrollListener',
    /** this.args.scrolledDiv */
    element = event.target,
    element$ = $(element),
    /** In first test `+ 100` was not required; after moving getNextPage() to
     * passport-table.js it was required.  It's good to request the next page a
     * bit earlier anyway to provide a smoother flow.
     */
    atEnd = element$.scrollTop() + element$.innerHeight() + 100 >= element.scrollHeight;
    if (atEnd) {
      dLog(fnName, 'end reached', atEnd, element, event);
      /* later() is not essential, but it is probably better to isolate API
       * requests from DOM event inputs. */
      later(() => this.args.getNextPage());
    }
    return atEnd;
  }
 
  //----------------------------------------------------------------------------

}
