/**
 * @module components/panel/passport-table
 * @description A web component that displays a table with filtering support using ember-contextual-table and ember-power-select.
 *
 * @example
 * <Panel::PassportTable @columns={{this.columns}} @data={{this.data}} />
 */

import Component from '@glimmer/component';
import { action, computed } from '@ember/object';
import { tracked } from '@glimmer/tracking';

//------------------------------------------------------------------------------

import { sampleNamePassportValues } from '../../utils/data/vcf-feature';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

export default class PanelPassportTableComponent extends Component {

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
   * This is used to populate the column-header <select>s.
   * @return [fieldName] -> Set of unique string field values.
   */
  @computed('args.userSettings.passportFields', 'args.dataset', 'args.samples')
  get fieldsUniqueValues() {
    const
    fnName = 'fieldsUniqueValues',
    dataset = this.args.dataset,
    selectFields = this.args.userSettings.passportFields,
    /** manage-genotype .samples is filtered by .filterSamplesByHaplotype
     * (not filteredSamples because this component replaces 'Filter by Name').
     */
    samples = this.args.samples,
    /** result is [fieldName] -> unique values, i.e. filterOptions */
    fieldValues = samples.reduce((fv, sampleName) => {
      const
      /** Passport data values for sampleName */
      values = sampleNamePassportValues(sampleName, selectFields, dataset);
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
   * @return {Array<{header, property, filterOptions}>}
   */
  @computed('args.userSettings.passportFields')
  get columns() {
    const
    fnName = 'columns',
    fieldsValues = this.fieldsUniqueValues,
    columns = this.args.userSettings.passportFields.map(fieldName => {
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
    tableLength = 50, // 500,
    rows = [];
    for (let sampleIndex = 0;
         (sampleIndex < samples.length) && (rows.length < tableLength);
         sampleIndex++) {
      // samples.slice(0, tableLength).map(sampleName => {
      const
      sampleName = samples[sampleIndex],
      values = sampleNamePassportValues(sampleName, selectFields, dataset),
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
        const row = Object.fromEntries(rowEntries);
        rows.push(row);
      }
    }
    dLog(fnName, selectFields, rows);
    return rows;
  }

  //----------------------------------------------------------------------------

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

}
