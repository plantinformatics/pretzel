import Component from '@glimmer/component';
import { action, computed } from '@ember/object';
import { later } from '@ember/runloop';
import { tracked } from '@glimmer/tracking';


//------------------------------------------------------------------------------

import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
const /*import */{
  accessionNumbers2genotypeIds,
} = vcfGenotypeBrapi.genolinkPassport; /*from 'vcf-genotype-brapi'; */

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


export default class PassportTable extends Component {

  //----------------------------------------------------------------------------

  /** Display table rows in pages */
  pageLength = 20;  // probably this.args.pageLength ??, from urlOptions
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
  /** Cache of paged input data streams.
   * searchStringName ->  {PagedData}
   */
  pagedData = {};

  @tracked
  /** undefined, or {key, value} defining the most recent search entered by the user. */
  currentSearch = undefined;

  @computed('currentSearch', 'args.mg.namesFilters.nameFilterDebounced')
  get currentData () {
    const
    /** mg.sampleNameFilter is not updated. */
    sampleNameFilter = this.args.mg .namesFilters.nameFilterDebounced,
    /** Use .currentSearch from column headers, or fall back to sampleNameFilter,
     * which sets this.currentSearch (Side-Effect). */
    searchKV = this.currentSearch ||
      ((sampleNameFilter ?? false) ?
       (this.currentSearch = { key : 'All', value : sampleNameFilter}) : undefined),
    searchName = searchKV ? searchKV.key + '|' + searchKV.value : 'NoSearch',
    search = this.pagedData[searchName] ||
      (this.pagedData[searchName] = new PagedData(searchName, searchKV, this.getPage));
    return search;
  }

  //----------------------------------------------------------------------------

  @action
  /** Signal from ember-multi2-column that user has entered value in column with
   * property key.
   * @param [key, value]
   */
  nameFilterChanged([key, value]) {
    this.currentSearch = {key, value};
  }

  //----------------------------------------------------------------------------

  @action
  /** Get requested page of the result for searchKV. */
  getPage(searchKV, page) {
    let promise;
    if (! searchKV) {
      promise = this.getNextPageNoSearch();
    } else {
    const
    fnName = 'getPage',

    selectFields = this.args.userSettings.passportFields,
    /** name value as _text for passing in parameter bundle to getPassportData(). */
    {key, value : _text} = searchKV;
    dLog(fnName, page, key, _text, this.pageLength);
    // Already have sampleNames, so nothing to request if ! selectFields.length
    if (selectFields.length) {
      const dataset = this.args.dataset;
      /** /query ?_text is across all fields; key is not passed */
      promise = this.args.mg.datasetGetPassportData(dataset, {_text, page}, selectFields);
      promise.then(data => {
        dLog(fnName, data);
        const accessionNumbers = data[0].mapBy('accessionNumber');
        accessionNumbers2genotypeIds(accessionNumbers, genolinkBaseUrl).then(ag => {
          const
          /** Use result ag to map from accessionNumber to genotypeId.
           * @param Accession	accessionNumber
           * @param Sample	genotypeId
           */
          a2gMap = ag.Samples.reduce((map, {Accession, Sample}) => {
            map.set(Accession, Sample);
            return map;
          }, new Map());
          this.toSamplesPassport(a2gMap, dataset, data[0]);
        });
      });
    } else {
      dLog(fnName, 'selectFields is empty');
      promise = Promise.resolve([]);
    }
    }
    return promise;
  }

  /** Store the received data in data.samplesPassport
   * Use a2gMap to map accessionNumber in data[] to genotypeId, which is the
   * sampleName used to index .samplesPassport.
   */
  toSamplesPassport(a2gMap, dataset, data) {
    /** Based on datasetGetPassportData() : receive(). (manage-genotype.js)
     */
    const
    fnName = 'toSamplesPassport',
    samplesPassport = dataset.samplesPassport || (dataset.samplesPassport = {});
    data.forEach((datum, i) => {
      const sampleName = a2gMap.get(datum.accessionNumber);
      if (! sampleName) {
        dLog(fnName, datum.accessionNumber, datum);
      } else {
        const sp = samplesPassport[sampleName] || (samplesPassport[sampleName] = {});
        Object.entries(datum).forEach(([field, value]) => {
          sp[field] = value; // datum[field];
        });
        // if datum.genotypeID is undefined, null, or ''
        if (! datum.genotypeID) {
          // Modify the parsed result, as this is returned by .tableData().
          datum.genotypeID = sampleName;
        } else if (datum.genotypeID !== sampleName) {
          dLog(fnName, sampleName, datum.genotypeID, datum);
        }
        sp.genotypeID = sampleName;
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
    } else
    if (this.lastPassport > this.args.samples.length) {
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
    selectFields = this.args.userSettings.passportFields;
    dLog(fnName, lastPassport, lastPassportNew, this.pageLength);
    // Already have sampleNames, so nothing to request if ! selectFields.length
    if (selectFields.length) {
      promise = this.args.mg.datasetGetPassportData(this.args.dataset, {sampleNames}, selectFields);
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
   * @param sampleNames	{accessionNumbers, genotypeIds} (aka rowNames)
   */
  getNamedRows(sampleNames) {
    const
    fnName = 'getNamedRows',
    selectFields = this.args.userSettings.passportFields;
    dLog(fnName, sampleNames);
    /* if ! selectFields.length, and sampleNames is searching genotypeIds,
     * can get those from mg.samples */
    /*if (selectFields.length)*/ {
      this.args.mg.datasetGetPassportData(this.args.dataset, sampleNames, selectFields);
    }
  }
 
  //----------------------------------------------------------------------------


}
