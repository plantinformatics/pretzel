import Component from '@ember/component';
import { observer, computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { later as run_later } from '@ember/runloop';

import config from '../../../config/environment';

import uploadBase from '../../../utils/panel/upload-base';
import uploadTable from '../../../utils/panel/upload-table';


const dLog = console.debug;

/* global Handsontable */
/* global $ */

/*----------------------------------------------------------------------------*/

/**
 * based on backend/scripts/dnaSequenceSearch.bash : columnsKeyString
 * This also aligns with createTable() : colHeaders below.
 */
const columnsKeyString = [
  'name', 'chr', 'pcIdentity', 'lengthOfHspHit', 'numMismatches', 'numGaps', 'queryStart', 'queryEnd', 'pos', 'end'
];
const c_name = 0, c_chr = 1, c_pos = 8;

/*----------------------------------------------------------------------------*/


/** Display a table of results from sequence-search API request
 * /Feature/dnaSequenceSearch
 */
export default Component.extend({
  apiServers: service(),
  blockService : service('data/block'),
  /** Similar comment to data-csv.js applies re. store (user could select server via GUI).
   * store is used by upload-table.js : getDatasetId() and submitFile()
   */
  store : alias('apiServers.primaryServer.store'),
  auth: service('auth'),


  classNames: ['blast-results'],

  /** true enables display of the search inputs. */
  showSearch : false,

  /** true means view the blocks of the dataset after it is added. */
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

  dataMatrix : computed('data.[]', function () {
    let
    data = this.get('data'),
    cells = data ? data.map((r) => r.split('\t')) : [];
    return cells;
  }),
  dataMatrixEffect : computed('table', 'dataMatrix.[]', function () {
    let table = this.get('table');
    if (table) {
      table.loadData(this.get('dataMatrix'));
    }
  }),

  didRender() {
    // this.showTable();
  },

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
  /** comments for activeEffect() and shownBsTab() in @see data-csv.js
   * @desc
   * active is passed in from parent component sequence-search to indicate if
   * the tab containing this sub component is active.
   */
  activeEffect : computed('active', function () {
    let active = this.get('active');
    if (active) {
      this.shownBsTab();
    }
  }),
  shownBsTab() {
    run_later(() => this.showTable(), 500);
  },
  /*--------------------------------------------------------------------------*/


  showTable() {
    // Ensure table is created when tab is shown
    let table = this.get('table');
    if (! table) {
      this.createTable();
    } else {
      // trigger rerender when tab is shown
      table.updateSettings({});
      // or .updateSettings({ data : ... })
      table.loadData(this.get('dataMatrix'));
    }
  },

  createTable() {
    const cName = 'upload/blast-results';
    const fnName = 'createTable';
    dLog('createTable');
    $(() => {
      let eltId = this.search.tableId;
      let hotable = $('#' + eltId)[0];
      if (! hotable) {
        console.warn(cName, fnName, ' : #', eltId, ' not found', this);
        return;  // fail
      }
      /**
blast output columns are
query ID, subject ID, % identity, length of HSP (hit), # mismatches, # gaps, query start, query end, subject start, subject end, e-value, score, query length, subject length
      */
      var table = new Handsontable(hotable, {
        data: [['', '', '', '', '', '', '', '', '', '', '', '', '', '']],
        // minRows: 20,
        rowHeaders: true,
        /*
        columns: [
          {
            data: 'name',
            type: 'text'
          },
          {
            data: 'block',
            type: 'text'
          },
          {
            data: 'val',
            type: 'numeric',
            numericFormat: {
              pattern: '0,0.*'
            }
          }
        ],
        */
        colHeaders: [
          'query ID', 'subject ID', '% identity', 'length of HSP (hit)', '# mismatches', '# gaps', 'query start', 'query end', 'subject start', 'subject end', 'e-value', 'score', 'query length', 'subject length'
        ],
        height: 500,
        // colWidths: [100, 100, 100],
        manualRowResize: true,
        manualColumnResize: true,
        manualRowMove: true,
        manualColumnMove: true,
        contextMenu: true,
        /*
        afterChange: function() {
        },
        afterRemoveRow: function() {
        },
        */
        /* see comment re. handsOnTableLicenseKey in frontend/config/environment.js */
        licenseKey: config.handsOnTableLicenseKey
      });
      this.set('table', table);

    });
  },


  clearTable() {
    var table = this.get('table');
    table.updateSettings({data:[]});
  },

  /*--------------------------------------------------------------------------*/

  /** called by upload-table.js : onSelectChange()
   * No validation of user input is required because table content is output from blast process.
   */
  checkBlocks() {
  },


  /** upload-table.js : submitFile() expects this function.
   * In blast-results, the data is not user input so validation is not required.
   */
  validateData() {
    /** based on data-csv.js : validateData(), which uses table.getSourceData();
     * in this case sourceData is based on .dataMatrix instead
     * of going via the table.
     */
    return new Promise((resolve, reject) => {
      let table = this.get('table');
      if (table === null) {
        resolve([]);
      }
      let sourceData = this.get('dataMatrix');
      /** the last row is empty. */
      let validatedData = sourceData
          .filter((row) => (row[c_name] !== '') && (row[c_chr]))
          .map((row) => 
          ({
            name: row[c_name],
            // blast output chromosome is e.g. 'chr2A'; Pretzel uses simply '2A'.
            block: row[c_chr].replace(/^chr/,''),
            // Make sure val is a number, not a string.
            val: Number(row[c_pos])
          }) );
      resolve(validatedData);
    });
  }

  /*--------------------------------------------------------------------------*/

});
