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
  PassportSearch,
  accessionNumbers2genotypeIds,
  possibleValues,
  countryAlpha3ToName,
} = vcfGenotypeBrapi.genolinkPassport; /*from 'vcf-genotype-brapi'; */

import config from 'pretzel-frontend/config/environment';

import PagedData from '../utils/data/paged-data';
import { toTitleCase } from '../utils/string';

//------------------------------------------------------------------------------
// copied from genotype-samples.js and manage-genotype.js, this will be imported from environment
/** Base URL for HTTP GET request to open Genolink with the result of a search
 * for genotypeIds included in the URL.
 */
const genolinkBaseUrl = "https://genolink.plantinformatics.io";

//------------------------------------------------------------------------------

const dLog = console.debug;

const
isDevelopment =
  (config.environment === 'development') &&
  ! config.apiHost.endsWith('3000');

//------------------------------------------------------------------------------

/** Values used are :
 * - crop
 * - OriginOfMaterial
 * The OriginOfMaterial values are the alpha-3 values (e.g. "AFG") from
 plantinformatics/genolink/shared-data/Country2Region.json
 * This is used in /query body { countryOfOrigin": { "code3" : ... } }
 */

const possibleValuesForFiltersP = possibleValues(genolinkBaseUrl);


// import country2Region from '../utils/Country2Region.json';

//------------------------------------------------------------------------------


export default class PassportTable extends Component {

  //----------------------------------------------------------------------------

  /** Display table rows in pages
   * passed to new PagedData() so that paged-data.js : pageSize can match this.
   */
  pageLength = isDevelopment ? 20 : 500;  // probably this.args.pageLength ??, from urlOptions
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

  /** /possibleValues is requested when this file is loaded.
   * When that promise resolves .possibleValuesForFilters is set and
   * possibleValuesFilterOptions() depends on that value.
   */
  possibleValuesForFiltersP = possibleValuesForFiltersP
    .then(result => later(() => this.possibleValuesForFilters = result));
  @tracked
  possibleValuesForFilters = null;

  @computed('possibleValuesForFilters')
  /** Map .possibleValuesForFilters to populate <select><option>s
   * for the category fields (pull-down lists).
   */
  get possibleValuesFilterOptions() {
    const fnName = 'possibleValuesFilterOptions';
    dLog(fnName, this.possibleValuesForFilters);
    if (! this.possibleValuesForFilters) {
      return {};
    }
    dLog(fnName, typeof this.possibleValuesForFilters, Object.keys(this.possibleValuesForFilters));
    const
    OriginOfMaterial1 = this.possibleValuesForFilters.OriginOfMaterial,
    {institute, crop, taxonomy, OriginOfMaterial, BiologicalStatus, TypeOfGermplasmStorage} = this.possibleValuesForFilters,
    countryNames = OriginOfMaterial1.map(alpha3 => countryAlpha3ToName[alpha3]),
    /** Passport data has crop names in upper case, and crop.name is used for filtering  */
    cropCapital = crop.map(c => toTitleCase(c)),
    obj = {
      instituteCode : institute,
      'crop.name' : cropCapital,
      cropName : crop,
      genus : taxonomy,
      'countryOfOrigin.name' : countryNames,
    };
    dLog(fnName, obj);
    return obj;
  }

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
    /** reference to signalChange() if required. */
    let postSignal;
    const
    /** mg.sampleNameFilter is not updated. */
    sampleNameFilter = this.args.mg .namesFilters.nameFilterDebounced,
    /** do .signalChange() after storeSearch(). */
    signalChange = search => { postSignal = () => this.signalChange(search); },
    /** Use .currentSearch from column headers, or fall back to sampleNameFilter,
     * which sets this.currentSearch (Side-Effect). */
    searchKV = this.currentSearch ||
      ((sampleNameFilter ?? false) ?
       (this.currentSearch =
        PassportSearch.update(signalChange, {}, 'All', sampleNameFilter)) :
       undefined),
    pagedData = this.storeSearch(searchKV);
    /* Handle the case where a search template is created with
     * PassportSearch.update(), which provides searchName, which storeSearch()
     * finds in .pagedData[], so search is a reference to the existing search in
     * .pagedData[]; change this.currentSearch because the template reference
     * was assigned to it.
     */
    if (pagedData.searchKV !== this.currentSearch) {
      this.currentSearch = pagedData.searchKV;
    }
    postSignal?.();

    return pagedData;
  }

  /** Store the given search in the cache, .pagedData.
   * @param {PassportSearch} searchKV
   * @return {PagedData} containing searchKV
   */
  storeSearch(searchKV) {
    const
    fnName = 'storeSearch',
    searchName = searchKV ? searchKV.searchNameFn() : 'NoSearch', 
    search = this.pagedData[searchName] ||
      (this.pagedData[searchName] =
       new PagedData(searchName, searchKV, this.getPage, this.pageLength));
    if (searchKV?.filterCode && ! search.searchKV?.filterCode) {
      console.warn(
        fnName, searchKV?.filterCode, search.searchKV?.filterCode,
        searchKV, search.searchKV);
    }
    return search;
  }


  //----------------------------------------------------------------------------

  /** Signal that params of search have changed, and currentData should be updated.
   * Now that .currentSearch is again being replaced when params are changed,
   * the dependency on .currentSearch should be sufficient, and .changeCount should
   * not be required.
   */
  signalChange(search) { Ember_set(search, 'changeCount', (search.changeCount ?? 0) + 1); }

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
    currentSearch = this.currentSearch || (this.currentSearch = {});
    /** Create a new .currentSearch, enabling search in
     * this.pagedData[] cache for matching filter and re-use, including
     * .filterCode */
    this.currentSearch =
      PassportSearch.update(this.signalChange, currentSearch, key, value);
    const search = this.storeSearch(this.currentSearch);
  }

  //----------------------------------------------------------------------------

  @action
  /** Get requested page of the result for searchKV.
   * @param {PassportSearch} searchKV
   * @param {optional number} page
   */
  getPage(searchKV, page) {
    let promise;
    if (! searchKV || ! (searchKV.value || searchKV.filter)) {
      promise = this.getNextPageNoSearch();
    } else {
      const
      fnName = 'getPage',

      selectFields = this.passportFields,
      /** name value as _text for passing in parameter bundle to getPassportData(). */
      {key, value : _text, filter : filter_, filterCode} = searchKV,
      filter = filter_?.body;
      dLog(fnName, page, key, _text, this.pageLength, filter, filter_, filterCode);
      // Already have sampleNames, so nothing to request if ! selectFields.length
      if (selectFields.length) {
        const dataset = this.args.dataset;
        /** /query ?_text is across all fields; key is not passed */
        const optionsParam = {_text, filter, filterCode, page, pageLength : this.pageLength};
        promise = this.args.mg.datasetGetPassportData(dataset, optionsParam, selectFields);
        promise.then(responses => {
          const dataChunks = responses.mapBy('content');
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
          /** Filter out accessionNumbers which Genolink has indicated are unknown (null in a2gMap).  */
          const accessionNumbers = data.mapBy('accessionNumber')
                .filter(accessionNumber => a2gMap.get(accessionNumber) === undefined);
          /** Record the given accessionNumbers as not having a GenotypeID. */
          function accessionNumbersSetMissing(accessionNumbers) {
            accessionNumbers.forEach(accessionNumber => a2gMap.set(accessionNumber, null));
          }
          if (accessionNumbers.length) {
            accessionNumbers2genotypeIds(accessionNumbers, genolinkBaseUrl)
              .catch(error => {
                /** response is 400 if none of accessionNumbers have a corresponding genotypeID. */
                dLog(fnName, 'error', error);
                accessionNumbersSetMissing(accessionNumbers);
              })
              .then(ag => {
                /** accessionNumbers2genotypeIds() catches 404 and returns [].
                 * This case is also handled by the following */
                if (ag.Samples.length < accessionNumbers.length) {
                  const missing = new Set(accessionNumbers).difference(new Set(ag.Samples));
                  dLog(
                    fnName,
                    ag.Samples.length, '<', accessionNumbers.length,
                    missing,
                    ag.Samples, accessionNumbers);
                  accessionNumbersSetMissing(Array.from(missing));
                }
                /** Use result ag to map from accessionNumber to genotypeId.
                 * The reference a2gMap is unchanged by this .reduce();
                 * the contents of the Map are modified.
                 * @param Accession	accessionNumber
                 * @param Sample	genotypeId
                 */
                /*a2gMap =*/ ag.Samples.reduce((map, {Accession, Sample}) => {
                  /* Requested Samples are omitted from response if their Accession
                   * does not have a corresponding genotypeID.  Record these as
                   * null. */
                  map.set(Accession, Sample);
                  return map;
                }, a2gMap);
                this.toSamplesPassport(a2gMap, dataset, data);
                /** after genotypeIDForRow(), searchData() needs re-filter. */
                this.genotypeIDsReceived++;
              });
          }
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
    if (this.currentSearch?.isSearch ?? false) {
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
