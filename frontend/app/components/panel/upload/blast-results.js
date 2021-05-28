import Component from '@ember/component';
import { observer, computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { later as run_later } from '@ember/runloop';


import config from '../../../config/environment';


const dLog = console.debug;

/* global Handsontable */
/* global $ */

/** Display a table of results from sequence-search API request
 * /Feature/dnaSequenceSearch
 */
export default Component.extend({
  apiServers: service(),
  blockService : service('data/block'),

  /** true enables display of the search inputs. */
  showSearch : false,


  /** copied from data-base.js, not used yet */
  isProcessing: false,
  successMessage: null,
  errorMessage: null,
  warningMessage: null,
  progressMsg: '',

  dataMatrix : computed('data.[]', function () {
    let cells = this.get('data').map((r) => r.split('\t'));
    return cells;
  }),
  dataMatrixEffect : computed('dataMatrix.[]', function () {
    let table = this.get('table');
    if (table) {
      table.loadData(this.get('dataMatrix'));
    }
  }),

  didRender() {
    // this.showTable();
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


});
