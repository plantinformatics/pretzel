/**
 * @module components/panel/passport-table
 *
 * @description A web component that displays a table with these features :
 *
 * - filtering via a <select> in each column header which displays the unique
 *   column values and enables the user to select multiple of these to filter
 *   the table.
 *
 * - column sorting
 *
 * - row selection of the table, in the same way a <select multiple> works,
 *   instead of a checkbox.
 *
 * @example
 * <Panel::PassportTable @columns={{this.columns}} @data={{this.data}} />
 */

import Component from '@glimmer/component';
import { action, computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { tracked } from '@glimmer/tracking';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

export default class EmberMulti2SelectComponent extends Component {

  //------------------------------------------------------------------------------

  /** Per-column filter values : [fieldName] -> [passport data values, ...] */
  selectedFieldValues = {};
  @tracked
  /** Count of changes to selectedFieldValues, for dependency. */
  selectedFieldValuesCount = 0;

  //------------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.passportTable = this;
    }
  }

  //------------------------------------------------------------------------------

  /** Collate Passport data values for @samples and @userSettings.passportFields.
   * @samples and @userSettings.passportFields may be nullish, both defaulting to [].
   * This is used to populate the column-header <select>s.
   * @return [fieldName] -> Set of unique string field values.
   * Return {} when this.args.samples is null or empty.
   */
  @computed('args.userSettings.passportFields', 'args.dataset', 'args.samples')
  get fieldsUniqueValues() {
    const
    fnName = 'fieldsUniqueValues',
    dataset = this.args.dataset,
    selectFields = this.args.userSettings.passportFields || [],
    /** manage-genotype .samples is filtered by .filterSamplesByHaplotype
     * (not filteredSamples because this component replaces 'Filter by Name').
     */
    samplesFull = this.args.samples || [],
    samples = (this.samplesListLimit ?? false) ? 
      samplesFull.slice(0, this.samplesListLimit) : samplesFull,
    /** result is [fieldName] -> unique values, i.e. filterOptions */
    fieldValues = samples.reduce((fv, sampleName) => {
      const
      /** Passport data values for sampleName */
      values = this.args.sampleNamePassportValues(sampleName, selectFields, dataset);
      // if selectFields is [], then values is [].
      values.forEach((value, i) => {
        const
        fieldName = selectFields[i],
        /** accumulated fieldValues for 1 fieldName */
        fvf = fv[fieldName] || (fv[fieldName] = new Set());
        if (value ?? false) {
          fvf.add(value);
        }
      });
      return fv;
    }, {});
    dLog(fnName, fieldValues);
    return fieldValues;
  }

  /** Each Passport field selected by the user is translated here into column
   * descriptor data.
   * Currently the header and property are both the field name; potentially the
   * header could be formatted, e.g. capitalised.
   * @userSettings.passportFields may be nullish, defaulting to [].
   * @return {Array<{header, property, filterOptions}>}
   */
  @computed('args.userSettings.passportFields')
  get columns() {
    const
    fnName = 'columns',
    fieldsValues = this.fieldsUniqueValues,
    passportFields = this.args.userSettings.passportFields || [],

    /** in this commit passport-table{,-html-row} differ in that idField is
     * prepended to columns in passport-table-html-row. */
    /** columns[this.idField].filterOptions will be []. */
    fields = this.idFieldInColumns ? [this.idField].concat(passportFields) : passportFields,
    columns = fields.map(fieldName => {
      const
      set = fieldsValues[fieldName],
      filterOptions = set ? Array.from(set) : [],
      column = {header: fieldName, property: fieldName, filterOptions};
      return column;
    });
    dLog(fnName, columns);
    return columns;
  }

  /** Filter @samples by user-selected .selectedFieldValues,
   * augment with their Passport data values.
   * The result data is displayed in the body of the table.
   * @return {Array<object>} Array of rows.  Row data is {fieldName : value, ...}
   */
  @computed(
    'args.userSettings.passportFields',
    'args.dataset', 'args.samples', 'selectedFieldValuesCount')
  get tableData() {
    const
    fnName = 'tableData',
    dataset = this.args.dataset,
    selectFields = this.args.userSettings.passportFields,
    samples = this.args.samples,
    tableLength = 20, // 500,
    rows = [];
    if (! samples) {
      return rows;
    }
    for (let sampleIndex = 0;
         (sampleIndex < samples.length) && (rows.length < tableLength);
         sampleIndex++) {
      // samples.slice(0, tableLength).map(sampleName => {
      const
      sampleName = samples[sampleIndex],
      values = this.args.sampleNamePassportValues(sampleName, selectFields, dataset),
      rowEntries = [],
      mismatch = values.find((value, fieldIndex) => {
        const
        fieldName = selectFields[fieldIndex],
        filterOptions = this.selectedFieldValues[fieldName],
        ok = ! filterOptions?.length || filterOptions.includes(value);
        if (ok) {
          const entry = [fieldName, value || 'x'];
          rowEntries.push(entry);
        }
        return ! ok;
        dLog(fnName, sampleIndex, sampleName, values, rowEntries, mismatch);
      });
      if (! mismatch) {
        rowEntries.push(['GenotypeId', sampleName]);
        const row = Object.fromEntries(rowEntries);
        rows.push(row);
      }
    }
    dLog(fnName, selectFields, rows);
    return rows;
  }


  //----------------------------------------------------------------------------

  @action
  rowText(row) {
    const
    fnName = 'rowText',
    {GenotypeId, ...nonId} = row,
    values = Object.values(nonId);
    values.unshift(GenotypeId);
    const text = values
    // .entries(), .map(kv => kv.join(':'))
      .join('&nbsp;');
    return text;
  }

  @action
  selectSample(event) {
    /** copied from manage-genotype.js : selectSample() */
    const
    selectedSamples = $(event.target).val();
    // this.selectSampleArray(selectedSamples, true);
    this.selectedSamples = selectedSamples;
  }


  //----------------------------------------------------------------------------

  // for power-select, unused
  /**
   * Handles filter changes for a column.
   * @param {string} column - The column name.
   * @param {*} selectedValue - The selected filter value.
   */
  @action
  filterColumn(column, selectedValue) {
    const fnName = 'filterColumn';
    // TODO: Add filtering logic using this.args.data and update component state as required.
    dLog(fnName, column, selectedValue);
  }

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

  //----------------------------------------------------------------------------
  // From https://chatgpt.com/share/68d0e67a-7428-800e-85e2-e31ee741ece3

  // sort + selection state
  @tracked sortBy = null;           // e.g. 'sampleName'
  @tracked sortDir = 'asc';         // 'asc' | 'desc'
  @tracked selectedIds = new Set(); // store stable row keys (e.g. accession id)

  /* If you already compute filtered rows, plug that in here instead of this.args.rows
  get filteredRows() {
    return this.args.rows ?? [];
  }
  */
  @alias('tableData') filteredRows;

  get sortedRows() {
    const rows = [...this.filteredRows];
    if (!this.sortBy) return rows;

    const dir = this.sortDir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      // basic, locale-aware, numeric-friendly compare
      const av = a[this.sortBy];
      const bv = b[this.sortBy];
      if (av == null && bv == null) return 0;
      if (av == null) return -1 * dir;
      if (bv == null) return  1 * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }

  @action toggleSort(property) {
    if (this.sortBy === property) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = property;
      this.sortDir = 'asc';
    }
  }

  @action toggleRow(id, event) {
    const fnName = 'toggleRow';
    const checked = event.target.checked;
    const next = new Set(this.selectedIds);
    checked ? next.add(id) : next.delete(id);
    this.selectedIds = next;
    dLog(fnName, checked, this.selectedIds, event.target.value);
    this.args.onSelectionChange?.([...next]); // bubble up if parent cares
  }

  @action toggleAll(event) {
    const fnName = 'toggleRow';
    const checked = event.target.checked;
    this.selectedIds = checked ? new Set(this.sortedRows.map(r => r.id)) : new Set();
    dLog(fnName, checked, this.selectedIds);
    this.args.onSelectionChange?.([...this.selectedIds]);
  }

  isAllVisibleSelected() {
    const visibleIds = this.sortedRows.map(r => r.id);
    return visibleIds.length > 0 && visibleIds.every(id => this.selectedIds.has(id));
  }


  //----------------------------------------------------------------------------

  has(selectedIds, rowId) {
    dLog('has(selectedIds, rowId)', selectedIds, rowId);
    const h = selectedIds.has(rowId);
    return  h;
  }

}
