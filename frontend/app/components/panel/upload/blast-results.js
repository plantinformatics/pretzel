import Component from '@ember/component';
import { observer, computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';

import uploadBase from '../../../utils/panel/upload-base';
import uploadTable from '../../../utils/panel/upload-table';

const dLog = console.debug;

/* global $ */


/*----------------------------------------------------------------------------*/


/** Display a table of results from sequence-search API request
 * /Feature/dnaSequenceSearch
 */
export default Component.extend({
  apiServers: service(),
  blockService : service('data/block'),
  queryParams: service('query-params'),

  urlOptions : alias('queryParams.urlOptions'),

  /*--------------------------------------------------------------------------*/

  classNames: ['blast-results'],

  /** true enables display of the table. */
  tableVisible : true,
  /** true enables display of the table in a modal dialog. */
  tableModal : false,
  /** true enables display of the search inputs. */
  showSearch : false,

  /** true means view the blocks of the dataset after it is added.
   * Used in upload-table.js : submitFile().
   */
  viewDatasetFlag : false,


  /*--------------------------------------------------------------------------*/

  /** copied from data-base.js. for uploadBase*/
  isProcessing: false,
  successMessage: null,
  errorMessage: null,
  warningMessage: null,
  progressMsg: '',


  setProcessing : uploadBase.setProcessing,
  setSuccess : uploadBase.setSuccess,
  setError : uploadBase.setError,
  setWarning : uploadBase.setWarning,
  clearMsgs : uploadBase.clearMsgs,

  /** data-csv.js : scrollToTop() scrolls up #left-panel-upload, but that is not required here. */
  scrollToTop() {
  },

  updateProgress : uploadBase.updateProgress,


  /*--------------------------------------------------------------------------*/

  /** copied from data-base.js, for uploadTable */

  selectedDataset: 'new',
  newDatasetName: '',
  nameWarning: null,
  selectedParent: '',
  dataType: 'linear',
  namespace: '',

  getDatasetId : uploadTable.getDatasetId,
  isDupName : uploadTable.isDupName,
  onNameChange : observer('newDatasetName', uploadTable.onNameChange),
  onSelectChange : observer('selectedDataset', 'selectedParent', uploadTable.onSelectChange),

  /*--------------------------------------------------------------------------*/

  actions : {
    submitFile : uploadTable.submitFile
  },

  /*--------------------------------------------------------------------------*/

  didReceiveAttrs() {
    this._super(...arguments);
    this.set('selectedParent', this.get('search.parent'));
    this.set('namespace',  this.get('search.parent') + ':blast');
  },

  /*--------------------------------------------------------------------------*/

  /** Outcomes of the API search request.
   */
  resultEffect : computed('search.promise', function () {
    const fnName = 'resultEffect';
    /** auth.dnaSequenceSearch request */
    let promise = this.search.promise;

    promise.catch(
      (error) => {
        dLog(fnName, 'catch', error, arguments);
      });
    promise.then(
      (data) => {
        dLog(fnName, data.features.length);
        this.set('data', data.features);
        if (this.get('addDataset') && this.get('replaceDataset')) {
          this.unviewDataset(this.get('newDatasetName'));
        }
      },
      // copied from data-base.js - could be factored.
      (err, status) => {
        dLog(fnName, 'dnaSequenceSearch reject', err, status);
        let errobj = err.responseJSON.error;
        console.log(errobj);
        let errmsg = null;
        if (errobj.message) {
          errmsg = errobj.message;
        } else if (errobj.errmsg) {
          errmsg = errobj.errmsg;
        } else if (errobj.name) {
          errmsg = errobj.name;
        }
        this.setError(errmsg);
        // upload tabs do .scrollToTop(), doesn't seem applicable here.
      }

    );
    
  }),

  /*--------------------------------------------------------------------------*/
  /* copied from file-drop-zone.js, can factor if this is retained.  */

  /** Unview the blocks of the dataset which has been replaced by successful upload.
   */
  unviewDataset(datasetName) {
    let
    store = this.get('apiServers').get('primaryServer').get('store'),
    replacedDataset = store.peekRecord('dataset', datasetName);
    if (replacedDataset) {
      let
      viewedBlocks = replacedDataset.get('blocks').toArray().filterBy('isViewed'),
      blockService = this.get('blockService'),
      blockIds = viewedBlocks.map((b) => b.id);
      dLog('unviewDataset', datasetName, blockIds);
      blockService.setViewed(blockIds, false);
    }
  },

  /*--------------------------------------------------------------------------*/

  /** called by upload-table.js : onSelectChange()
   * No validation of user input is required because table content is output from blast process.
   */
  checkBlocks() {
  },

  /*--------------------------------------------------------------------------*/

});
