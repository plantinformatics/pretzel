import Component from '@glimmer/component';
import { action, computed } from '@ember/object';
import { later } from '@ember/runloop';
import { tracked } from '@glimmer/tracking';


//------------------------------------------------------------------------------

import PagedData from '../utils/data/paged-data';

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

  @computed('currentSearch')
  get currentData () {
    const
    searchKV = this.currentSearch,
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
      /** /query ?_text is across all fields; key is not passed */
      promise = this.args.mg.datasetGetPassportData(this.args.dataset, {_text, page}, selectFields);
      promise.then(data => console.log(fnName, data));
    } else {
      dLog(fnName, 'selectFields is empty');
      promise = Promise.resolve([]);
    }
    }
    return promise;
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
