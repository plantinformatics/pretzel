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
import { debounce } from '@ember/runloop';

//------------------------------------------------------------------------------


import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
const /*import */{
  genotypeIDnone,
  fieldName2ParamName,
  passportFieldNamesCategory,
  uniqueByIds,
} = vcfGenotypeBrapi.genolinkPassport; /*from 'vcf-genotype-brapi'; */

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

  /** done in ember-multi2-table.js
  @alias('args.userSettings.passportTable.passportFields') passportFields;
   */

  /** Collate Passport data values for @samples and .passportFields.
   * @samples and .passportFields may be nullish, both defaulting to [].
   * This is used in columns() to populate the column-header <select>s;
   * those fields which have @possibleValuesFilterOptions[fieldName] use it in
   * preference.
   * @return [fieldName] -> array of unique string field values.
   * Return {} when this.args.samples is null or empty.
   */
  @computed(
    'passportFields', 'args.dataset', 'args.samples',
    'args.lastPassport',
    'args.mg.passportDataCount',
    'args.currentData.rows.length',
    'args.samples.length'
  )
  get fieldsUniqueValues() {
    const
    fnName = 'fieldsUniqueValues',
    dataset = this.args.dataset,
    passportFields = this.passportFields || [],
    selectFields = passportFields.filter(
      fieldName => passportFieldNamesCategory.includes(fieldName)),
    /** manage-genotype .samples is filtered by .filterSamplesByHaplotype
     * (not filteredSamples because this component replaces 'Filter by Name').
     */
    samplesFull = this.args.samples || [],
    /** could .slice(0, this.lastPassport) */
    samples = /*(this.samplesListLimit ?? false) ? 
      samplesFull.slice(0, this.samplesListLimit) :*/ samplesFull,
    /** result is [fieldName] -> unique values, i.e. filterOptions */
    fieldValues = samples.reduce((fv, sampleName) => {
      const
      /** Passport data values for sampleName */
      values = this.args.sampleNamePassportValues(sampleName, null, selectFields, dataset);
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
    }, {}),
    entriesSorted = 
      Object.entries(fieldValues).map(([fieldName, set]) =>
        [fieldName, Array.from(set).sort()]),
    sorted = Object.fromEntries(entriesSorted);
    dLog(fnName, sorted /*,fieldValues*/);
    return sorted;
  }

  /** Each Passport field selected by the user is translated here into column
   * descriptor data.
   * Currently the header and property are both the field name; potentially the
   * header could be formatted, e.g. capitalised.
   * .passportFields may be nullish, defaulting to [].
   * @return {Array<{header, property, filterOptions}>}
   */
  @computed(
    'passportFields',
    /* 'fieldsUniqueValues' is based on received Passport data, so it updates
     * when that is received, but making fieldsUniqueValues a dependency causes
     * too many column header refreshes, causing loss of user focus in the seach
     * <input> fields.
     * possibleValuesFilterOptions is the more significant source of filterOptions.
     */
    'args.possibleValuesFilterOptions',
  )
  get columns() {
    const
    fnName = 'columns',
    filterChanged = () => this.namesFiltersCount++,
    /** The dependency fieldsUniqueValues is commented out because it causes the
     * column headers to redraw, which disrupts focus while the user is entering
     * text into a search filter <input>.
     * fieldsUniqueValues depends on args.mg.passportDataCount because received
     * passport data will extend the range of fieldsUniqueValues.  But the
     * <option> values come primarily from possibleValuesFilterOptions[], and
     * passport data is being received continually, so re-rendering column
     * headers makes it hard for the user to retain focus and type in the
     * <input>.
     */
    fieldsValues = this.fieldsUniqueValues,
    passportFields = this.passportFields || [],

    /** in this commit passport-table{,-html-row} differ in that idField is
     * prepended to columns in passport-table-html-row. */
    /** columns[this.idField].filterOptions will be []. */
    fields = this.idFieldInColumns ? [this.idField].concat(passportFields) : passportFields,
    columns = fields.map(fieldName => {
      const
      array = this.args.possibleValuesFilterOptions[fieldName] || fieldsValues[fieldName],
      filterOptions = array || [],
      isCategory = passportFieldNamesCategory.includes(fieldName),
      isId = fieldName === this.idField,
      namesFilters = isCategory ? undefined : this.newNamesFilters(fieldName, filterChanged),
      /** Persist fieldSearchString because columns[] is re-created after paging. */
      fieldSearchString = this.fieldSearchString,
      column = {
        header: fieldName, property: fieldName, isId,
        filterOptions, namesFilters,
        fieldSearchString
      };
      if (namesFilters && fieldSearchString[fieldName] && ! namesFilters.nameFilter) {
        namesFilters.set('nameFilter', fieldSearchString[fieldName]);
      }
      return column;
    });
    dLog(fnName, columns);
    return columns;
  }

  @computed('namesFiltersCount')
  /** The fields genotypeID and accessionNumber identify the passport data rows.
   * Collate an array of these identity / name fields for which the user has
   * entered a search string.
   * @return {Array<[key, value]>}	key is "genotypeIds" or "accessionNumbers"
   * and value is the search string which the user has entered.
   */
  get nameFieldEntries() {
    const
    /** same as @column.fieldSearchString */
    fieldSearchString = this.fieldSearchString,
    nameEntries = ['genotypeID', 'accessionNumber'].map(
      /** Genolink expects an array of names. Initially handle search string
       * being just 1 name; later can split into an array, e.g. at '|'. */
      fieldName => [fieldName2ParamName[fieldName], [fieldSearchString[fieldName]]])
      .filter(([key, value]) => value[0]);
    return nameEntries;
  }

  /** Filter @samples by user-selected .selectedFieldValues,
   * augment with their Passport data values.
   * The result data is displayed in the body of the table.
   * @return {Array<object>} Array of rows.  Row data is {fieldName : value, ...}
   */
  @computed(
    'args.samples.length',
    'passportFields',
    'passportFields.length',
    'args.lastPassport', 'args.mg.passportDataCount',
    'args.dataset', 'args.samples', 'selectedFieldValuesCount',
    'namesFiltersCount',
    // used in matchField() : okFn()
    'args.requireId',
  )
  get sampleData() {
    const
    fnName = 'sampleData',
    dataset = this.args.dataset,
    selectFields = this.passportFields,
    /** cache of okFn-s for matchField */
    matchFieldFns = {},
    // tableLength = (this.samplesListLimit ?? 500),
    rows = [];
    let samples = this.args.samples;
    if (! samples?.length) {
      return rows;
    }
    /** Pre-filter samples by genotypeID if it has a search input. */
    const nf = this.columns[0].namesFilters;
    if (nf.nameFilterArray.length) {
      samples = samples.filter(value =>   
        ((value === null) ? false :
         nf.matchFilters(value, nf.nameFilterArray, true, true)));
    }
    for (
      let sampleIndex = 0;
      /*&& (rows.length < tableLength)*/
      (sampleIndex < samples.length) && (sampleIndex <= this.args.lastPassport);
      sampleIndex++) {
      // samples.slice(0, tableLength).map(sampleName => {
      const
      sampleName = samples[sampleIndex],
      values = this.args.sampleNamePassportValues(sampleName, null, selectFields, dataset),
      rowEntries = [],
      /** find any field which has a filter and the data does not match it. */
      mismatchIndex = values.findIndex((value, fieldIndex) => {
        const
        fieldName = selectFields[fieldIndex],
        ok = this.matchField(matchFieldFns, value, fieldIndex, fieldName);
        if (ok) {
          const
          /** null is not treated as missing by missingCells(). */
          valueText = value === null ? value : value || '_', 
          entry = [fieldName, valueText];
          rowEntries.push(entry);
        }
        return ! ok;
        dLog(fnName, sampleIndex, sampleName, values, rowEntries, mismatchIndex);
      });
      if (mismatchIndex === -1) {
        rowEntries.push(['genotypeID', sampleName]);	// or genotypeId
        const row = Object.fromEntries(rowEntries);
        rows.push(row);
      }
    }
    dLog(fnName, selectFields, rows);

    /** If user has entered name fields (genotypeID / accessionNumber),
     * use those for lookup. */
    const
    nameEntries = this.nameFieldEntries,
    rowNames = Object.fromEntries(nameEntries);
    // if accessionNumber or GenotypeId, search
    if (! rows.length && nameEntries.length) {
      this.args.getNamedRows(rowNames);
    }
    /* If the rows do not fill the current height of the table, get more.
     * Limited to a few pages - need to throttle this to a reasonable number / rate,
     * and it will be solved by using Genolink search endpoints including /text.
     */
    else if ((rows.length < 10) && (this.args.lastPassport < 4 * 20)) {
      this.args.getNextPage();
    }
    this.requestMissing(rows);

    return rows;
  }
  /** Return a function to match column values against the defined filters.
   * @param cache functions are cached to assist the JavaScript engine to optimise.
   * The cache key combines fieldIndex and fieldName, since they are tied.
   * @param {number} (integer >= 0) fieldIndex  index of column / field
   * @param {string} fieldName name of column / field
   * @return {function({number, string})} : boolean
   */
  okFn(cache, fieldIndex, fieldName) {
    const
    fnName = 'okFn',
    cacheKey = fieldIndex + '|' + fieldName,
    fn = cache[cacheKey] ||
      (cache[cacheKey] = constructFieldFilter.apply(this, [fieldIndex, fieldName]));
    function constructFieldFilter(fieldIndex, fieldName) {
      const
      column = this.columns[fieldIndex + (this.idFieldInColumns ? 1 : 0)],
      nf = column.namesFilters,
      okFn = nf ? 
        (value) => nf.nameFilterArray.length ?
        ((value === null) ? false :
         nf.matchFilters(value, nf.nameFilterArray, true, true)) :
        true :
      (value) => {
        const
        filterOptions = this.selectedFieldValues[fieldName],
        /** possibleValuesFilterOptions.crop has been mapped to "Title Case" in
         * 'crop.name', i.e. first letter is capitalised, to enable it to match
         * value.
         */
        ok = ! filterOptions?.length || filterOptions.includes(value);
        return ok;
      },
      combinedFn = this.args.requireId && (fieldName === this.idField) ?
        value => !! value && okFn(value) : okFn;
      return combinedFn;
    }
    return fn;
  }
  matchField(cache, value, fieldIndex, fieldName) {
    const
    fnName = 'matchField',
    /** based on get filteredSamples() (panel/manage-genotype.js )
     * null values are from Genesys so they can't match - assigned false in okFn
     * undefined values are not yet retrieved, so assign ok = true here.
     */
    ok = (value === undefined) || this.okFn(cache, fieldIndex, fieldName)(value);
    return ok;
  }

  /** If the user has entered a search string, return .searchData,
   * otherwise data for a page of all samples (.sampleData).
   * When requireId && isSearch, concat .searchData and .sampleData and use
   * uniqueByIds() to remove duplicates by genotypeID and accessionNumber.
   *
   * sampleNamePassportValues() is used to augment the row data to satisfy
   * selectFields[].  This is in line with a medium term plan to merge results
   * from searches, e.g. when a column is added after a search, a request by
   * accessionNumber for the added field can be merged into the search result
   * rows.
   */
  @computed ('sampleData', 'searchData', 'args.currentData.searchKV')
  get tableData() {
    const
    fnName = 'tableData',
    searchKV = this.args.currentData.searchKV,
    isSearch = searchKV && searchKV.isSearch,
    /** don't concat searchData and sampleData if filterSamplesByHaplotype or if
     * search is just dataset Crop
     */
    filterSamplesByHaplotype = this.args.userSettings.filterSamplesByHaplotype,
    rows = filterSamplesByHaplotype || searchKV?.searchIs1Crop ?
      this.sampleData :
      (this.args.requireId && isSearch) ?
      uniqueByIds(
        [].concat(
          this.searchData.filter(r => r.genotypeID && r.genotypeID !== genotypeIDnone),
          this.sampleData),
        ['genotypeID', 'accessionNumber']) :
      isSearch ? this.searchData : this.sampleData;
    dLog(fnName, isSearch, searchKV, rows);
    return rows;
  }

  /** Filter @currentData.rows by matchField().
   */
  @computed(
    'args.currentData.searchKV',
    'args.currentData.rows',
    'args.currentData.rows.length',
    'passportFields.length',
    /* incremented when user selects a category in column filter.
     * Used in .matchField()
     */
    'selectedFieldValuesCount',
    // incremented when user alters nameFilter
    'namesFiltersCount',
    // used in matchField() : okFn()
    'args.requireId',
    'args.genotypeIDsReceived',
    /* incremented by receiving Passport data which may have been requested to
     * populate columns added by user. */
    'args.mg.passportDataCount',
  )
  get searchData() {
    const
    fnName = 'searchData',
    selectFields = this.passportFields,
    /** cache of okFn-s for matchField */
    matchFieldFns = {},
    cdRows = this.args.currentData.rows,
    /** If @currentData.rows is empty, use cached pages of data.
     * It may be worth merging these based on accessionNumber in loadPage(),
     * instead of simply storing pages in cache */
    rows = cdRows?.length ? cdRows : this.cachedRows(),
    dataset = this.args.dataset,
    fieldValueFromCache = (row, selectField) => 
      this.args.sampleNamePassportValues(
        (row.genotypeID !== genotypeIDnone) && row.genotypeID, row.accessionNumber, [selectField], dataset)[0],
    filteredRows = rows.filter(row => {
      const
      mismatchIndex = selectFields.findIndex((fieldName, fieldIndex) => {
        const
        value = row[fieldName] || (row[fieldName] = fieldValueFromCache(row, fieldName)),
        /** (for fieldName 'aliases'), map array of objects to array of name strings. */
        valueName = Array.isArray(value) ? value.mapBy('name') : value,
        ok = this.matchField(matchFieldFns, valueName, fieldIndex, fieldName);
        return ! ok;
      });
      return mismatchIndex === -1;
    });

    /** passport-table.pageLength === 500
     * This condition is not necessarily exactly pageLength - just enough to
     * fill the user's screen.
     */
    if (! this.args.currentData.searchKV.last  && (filteredRows.length < 500)) {
      /** debounce because searchData() is triggered twice before page updates. */
      debounce(this, this.getNextPage, 200, /*immediate*/ true);
    }

    /** search result cdRows will generally have selectFields, except after a
     * new column is added, which doesn't trigger a search. */
    this.requestMissing(filteredRows);

    dLog(fnName, filteredRows, this.args.currentData.searchKV);

    return filteredRows;
  }

  //----------------------------------------------------------------------------

  @action
  rowText(row) {
    const
    fnName = 'rowText',
    {genotypeID, ...nonId} = row,
    values = Object.values(nonId);
    values.unshift(genotypeID);
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
   * the corresponding column filter, implemented by mismatchIndex in {sample,search}Data().
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

  /** Currently ember-multi2-table.js : sortedRows() is used instead of this
   */
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
