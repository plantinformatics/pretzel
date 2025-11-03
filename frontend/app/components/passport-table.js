import Component from '@glimmer/component';
import { action, computed, set as Ember_set } from '@ember/object';
import { later } from '@ember/runloop';
import { tracked } from '@glimmer/tracking';
import { alias } from '@ember/object/computed';

//------------------------------------------------------------------------------

import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
const /*import */{
  genolinkFieldNames,
  PassportFilter,
  accessionNumbers2genotypeIds,
} = vcfGenotypeBrapi.genolinkPassport; /*from 'vcf-genotype-brapi'; */

import config from 'pretzel-frontend/config/environment';

import PagedData from '../utils/data/paged-data';

//------------------------------------------------------------------------------
// copied from genotype-samples.js and manage-genotype.js, this will be imported from environment
/** Base URL for HTTP GET request to open Genolink with the result of a search
 * for genotypeIds included in the URL.
 */
const genolinkBaseUrl = "https://genolink.plantinformatics.io";

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/** Map a search description (.currentSearch or .searchKV) to a text
 * name for caching in PagedData()
 */
function searchNameFn(search) {
  const
  name = ((search.key ?? '') + '|' + (search.value ?? '')) +
    (search.filter ? '|' + JSON.stringify(search.filter) : '');
  return name;
}

//------------------------------------------------------------------------------


export default class PassportTable extends Component {

  //----------------------------------------------------------------------------

  /** Display table rows in pages
   * passed to new PagedData() so that paged-data.js : pageSize can match this.
   */
  pageLength = 500; // 20;  // probably this.args.pageLength ??, from urlOptions
  @tracked
  /** end row of last page of Passport data requested.  */
  lastPassport = 0;

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    if (window.PretzelFrontend) {
      window.PretzelFrontend.passportTable = this;
    }
    const a = this.args;
    dLog(
      'PassportTable', 'constructor', 
      // 'the', a.the,
      'userSettings', a.userSettings,
      'dataset', a.dataset,
      'samples', a.samples,
      'rows', a.rows,
      'selectSampleArray', a.selectSampleArray,
      'tableRow', a.tableRow,
      'sampleNamePassportValues', a.sampleNamePassportValues,
      'this', this);
  }

  //----------------------------------------------------------------------------

  @alias('args.userSettings.passportTable.passportFields') passportFields;

  //----------------------------------------------------------------------------

  /** If the active dataset has _meta.Crop, select that value in the crop.name
   * column, i.e. use that as an initial filter.
   */
  get initialFilter() {
    const
    Crop = this.args.dataset?._meta?.Crop,
    filter = Crop ? {key : 'crop.name', value : Crop} : undefined;
    return filter;
  }

  @tracked
  /** true means a row is displayed iff it has a value in the id (genotypeID)
   * column. */
  requireId = true;

  @tracked
  /* incremented after accessionNumbers2genotypeIds() gets genotypeIDs for
   * _text search result */
  genotypeIDsReceived = 0;

  //----------------------------------------------------------------------------
  /** Cache of paged input data streams.
   * searchStringName ->  {PagedData}
   */
  pagedData = {};

  @tracked
  /** undefined, or {key, value} defining the most recent search entered by the user. */
  currentSearch = undefined;

  @computed('currentSearch', 'currentSearch.changeCount', 'args.mg.namesFilters.nameFilterDebounced')
  get currentData () {
    dLog('currentData', 'currentSearch', this.currentSearch, this.currentSearch?.changeCount);
    const
    /** mg.sampleNameFilter is not updated. */
    sampleNameFilter = this.args.mg .namesFilters.nameFilterDebounced,
    /** Use .currentSearch from column headers, or fall back to sampleNameFilter,
     * which sets this.currentSearch (Side-Effect). */
    searchKV = this.currentSearch ||
      ((sampleNameFilter ?? false) ?
       (this.currentSearch = { key : 'All', value : sampleNameFilter}) : undefined),
    searchName = searchKV ? searchNameFn(searchKV) : 'NoSearch',
    search = this.pagedData[searchName] ||
      (this.pagedData[searchName] = new PagedData(searchName, searchKV, this.getPage, this.pageLength));
    return search;
  }

  //----------------------------------------------------------------------------

  @action
  /** Signal from ember-multi2-column that user has entered value in column with
   * property key.
   * Update .currentSearch to implement this search.
   * @param [key, value]
   * value is an array of strings when called from selectFieldValue(),
   * or otherwise a single string.
   */
  nameFilterChanged([key, value]) {
    const fnName = 'passport-table : nameFilterChanged';
    dLog(fnName, key, value, 'currentSearch', this.currentSearch);
    const
    currentSearch = this.currentSearch || (this.currentSearch = {}),
    /** previous .filter, preserved when changing .currentSearch.{key,value}.  */
    filter = currentSearch?.filter;

    let changeCount = currentSearch?.changeCount ?? 0;
    function signalChange() { Ember_set(currentSearch, 'changeCount', ++changeCount); }
    if (genolinkFieldNames.includes(key)) {
      // key cannot be searched via /query _text
    } else if (key === 'crop.name') {
      PassportFilter.update(currentSearch, key, value);
      // this.currentSearch = Object.assign({}, currentSearch);
      signalChange();
    } else if (value) {
      if (Array.isArray(value)) {
        value = value.map(o => '"' + o + '"').join('|');
      }
      Object.assign(currentSearch, {key, value});
      // Object.assign() bypasses `set changeCount()`
      signalChange();
    } else {
      if (currentSearch.key === key) {
        dLog(fnName, 'removing', currentSearch, value);
        Object.assign(currentSearch, {key : 'All', value : ""});
        signalChange();
      }
    }
  }

  //----------------------------------------------------------------------------

  @action
  /** Get requested page of the result for searchKV. */
  getPage(searchKV, page) {
    let promise;
    if (! searchKV || ! (searchKV.value || searchKV.filter)) {
      promise = this.getNextPageNoSearch();
    } else {
      const
      fnName = 'getPage',

      selectFields = this.passportFields,
      /** name value as _text for passing in parameter bundle to getPassportData(). */
      {key, value : _text, filter : filter_} = searchKV,
      filter = filter_?.body;
      dLog(fnName, page, key, _text, this.pageLength, filter, filter_);
      // Already have sampleNames, so nothing to request if ! selectFields.length
      if (selectFields.length) {
        const dataset = this.args.dataset;
        /** /query ?_text is across all fields; key is not passed */
        const optionsParam = {_text, filter, page, pageLength : this.pageLength};
        promise = this.args.mg.datasetGetPassportData(dataset, optionsParam, selectFields);
        promise.then(dataChunks => {
          dLog(fnName, dataChunks);
          /** perhaps concat the chunk results */
          const data = dataChunks[0];
          const a2gMap = dataset.samplesPassport.a2gMap;
          /** Before accessionNumbers2genotypeIds(), a2gMap may not have
           * the necessary genotypeID-s, but render occurs before
           * accessionNumbers2genotypeIds().then().
           * This .genotypeIDForRow() is repeated in .then().
           */
          data.forEach(datum => {const sampleName = this.genotypeIDForRow(datum, a2gMap); if (sampleName) dLog(fnName, sampleName, datum);});
          const accessionNumbers = data.mapBy('accessionNumber');
          accessionNumbers2genotypeIds(accessionNumbers, genolinkBaseUrl).then(ag => {
            const
            /** Use result ag to map from accessionNumber to genotypeId.
             * @param Accession	accessionNumber
             * @param Sample	genotypeId
             */
            a2gMap = ag.Samples.reduce((map, {Accession, Sample}) => {
              map.set(Accession, Sample);
              return map;
            }, dataset.samplesPassport.a2gMap);
            this.toSamplesPassport(a2gMap, dataset, data);
            /** after genotypeIDForRow(), searchData() needs re-filter. */
            this.genotypeIDsReceived++;
          });
        });
      } else {
        dLog(fnName, 'selectFields is empty');
        promise = Promise.resolve([]);
      }
    }
    return promise;
  }
  genotypeIDForRow(datum, a2gMap) {
    const
    fnName = 'genotypeIDForRow',
    sampleName = a2gMap.get(datum.accessionNumber);

    if (sampleName) {
      /** In a Genolink API endpoint if genotypeIds are given as search
       * parameters, then Genolink inserts the genotypeID in the result.
       * Otherwise the .genotypeID field is "", so in this case augment the
       * result with .genotypeID = sampleName.
       */
      // if datum.genotypeID is undefined, null, or ''
      if (! datum.genotypeID) {
        // Modify the parsed result, as this is returned by .tableData().
        datum.genotypeID = sampleName;
      } else if (datum.genotypeID !== sampleName) {
        dLog(fnName, sampleName, datum.genotypeID, datum);
      }
    }

    return sampleName;
  }
  /** Store the received data in data.samplesPassport.{genotypeID,accessionNumber}.
   * Use a2gMap to map accessionNumber in data[] to genotypeId, which is the
   * sampleName used to index .samplesPassport.genotypeID
   */
  toSamplesPassport(a2gMap, dataset, data) {
    /** Based on datasetGetPassportData() : receive(). (manage-genotype.js)
     */
    const
    fnName = 'toSamplesPassport',
    samplesPassport = dataset.samplesPassport;
    data.forEach((datum, i) => {
      const sampleName = this.genotypeIDForRow(datum, a2gMap);

      /** accessionNumber is the Genesys ID, so if corresponding Genolink /
       * Pretzel ID (genotypeID) is not found, cache the data by
       * accessionNumber.
       */
      function store(cache, key) {
        const
        sp = cache[key] || (cache[key] = {});
        Object.assign(sp, datum);
      }
      if (! sampleName) {
        // dLog(fnName, datum.accessionNumber, datum);
        store(samplesPassport.accessionNumber, datum.accessionNumber);
      } else {
        store(samplesPassport.genotypeID, sampleName);
      }
    });

  }


  @action
  getNextPage() {
    let promise;
    if (this.currentSearch?.value ?? false) {
      promise = this.currentData?.loadNextPage();
    } else {
      // this uses @samples, which getPage() does not.
      promise = this.getNextPageNoSearch();
    }
    return promise;
  }

  @action
  getNextPageNoSearch() {
    let promise;
    const datasetSamplesTask = this.args.dataset[Symbol.for('samplesP')];
    if (! this.args.samples.length && datasetSamplesTask) {
      promise = datasetSamplesTask.promise.then(() => this.getNextPageNoSearch());
    } else if (
      /** .samples.length is limited to 2000 in development */
      (this.lastPassport > this.args.samples.length) &&
        (config.environment !== 'development')) {
      promise = Promise.reject('No more data');
    } else {
      /** get next chunk */
      const
      fnName = 'getNextPageNoSearch',
      lastPassport = this.lastPassport,
      lastPassportNew = this.lastPassport + this.pageLength,
      /** could filter [0, lastPassportNew] @samples for selectFields; group by
       * required fields and request in groups. */
      sampleNames = this.args.samples.slice(lastPassport, lastPassportNew), 
      selectFields = this.passportFields;
      dLog(fnName, lastPassport, lastPassportNew, this.pageLength);
      // Already have sampleNames, so nothing to request if ! selectFields.length
      if (selectFields.length) {
        const optionsParam = {sampleNames, pageLength : this.pageLength};
        promise = this.args.mg.datasetGetPassportData(this.args.dataset, optionsParam, selectFields);
      } else {
        dLog(fnName, 'selectFields is empty');
        promise = Promise.resolve([]);
      }

      later(() => this.lastPassport = lastPassportNew);
    }
    return promise;
  }

  //----------------------------------------------------------------------------

  @action
  /**
   * @param sampleNames	aka genotypeIds, rowNames. (could use accessionNumbers)
   */
  getNamedRows(sampleNames, selectFields = this.passportFields) {
    const
    fnName = 'getNamedRows';
    dLog(fnName, sampleNames);
    let promise;
    /* if ! selectFields.length, and sampleNames is searching genotypeIds,
     * can get those from mg.samples */
    /*if (selectFields.length)*/ {
      const optionsParam = {sampleNames, pageLength : this.pageLength};
      promise = this.args.mg.datasetGetPassportData(this.args.dataset, optionsParam, selectFields);
    }
    return promise;
  }

  //----------------------------------------------------------------------------


}
