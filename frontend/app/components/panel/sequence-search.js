import Component from '@ember/component';
import { bind, once, later, throttle, debounce } from '@ember/runloop';
import { inject as service } from '@ember/service';
import { observer, computed } from '@ember/object';
import { alias } from '@ember/object/computed';


const dLog = console.debug;

export default Component.extend({
  auth: service(),
  apiServers: service(),

  /** limit rows in result */
  resultRows : 50,
  /** true means add / upload result to db as a Dataset */
  addDataset : false,

  classNames: ['col-xs-12'],

  /*--------------------------------------------------------------------------*/
  /** copied from data-base.js; may factor or change the approach. */
  isProcessing: false,
  successMessage: null,
  errorMessage: null,
  warningMessage: null,
  progressMsg: '',
  setError(msg) {
    this.setProperties({
      isProcessing: false,
      errorMessage: msg,
    });
  },

  clearMsgs() {
    this.setProperties({
      successMessage: null,
      errorMessage: null,
      warningMessage: null,
      nameWarning : null,
    });
  },

  /*--------------------------------------------------------------------------*/
  /** copied from data-csv.js; could factor as a mixin. */
  newDatasetName: '',
  nameWarning: null,
  selectedParent: '',
  /** Checks if entered dataset name is already taken in dataset list
   *  Debounced call through observer */
  isDupName: function() {
    {
      let datasetName = this.get('newDatasetName');
      let datasets = this.get('datasets');
      let matched = datasets.findBy('name', datasetName);
      if(matched){
        this.set('nameWarning', `Dataset name '${datasetName}' is already in use`);
        return true;
      }
    }
    this.set('nameWarning', null);
    return false;
  },
  onNameChange: observer('newDatasetName', function() {
    debounce(this, this.isDupName, 500);
  }),
  onSelectChange: observer('selectedParent', function() {
    this.checkInputs();
  }),

  /*--------------------------------------------------------------------------*/

  loading : alias('taskGet.isRunning'),

  refreshClassNames : computed('loading', function () {
    let classNames = "btn btn-info pull-right";
    return this.get('loading') ? classNames + ' disabled' : classNames;
  }),

  /*--------------------------------------------------------------------------*/

  /** Filter for those datasets which have tag : BlastDb
   */
  datasetsToSearch : computed('datasets.[]', function () {
    // could also check d.get('_meta.type') === 'Genome'
    let datasetsWithBlastDb = this.get('datasets').filter((d) => d.hasTag('BlastDb'));
    return datasetsWithBlastDb;
  }),

  /*--------------------------------------------------------------------------*/

  // actions
  actions: {
    // copied from feature-list, may not be required
    inputIsActive() {
      dLog('inputIsActive');
    },
    paste: function(event) {
      let text = event && (event.target.value || event.originalEvent.target.value);
      console.log('paste', event, text.length);
      /** this action function is called before jQuery val() is updated. */
      later(() => {
        this.set('text', text);
        // this.dnaSequenceInput(/*text*/);
      }, 500);
    },

    dnaSequenceInput(text, event) {
      dLog("dnaSequenceInput", this, text.length, event.keyCode);
      this.set('text', text);
      // throttle(this.get('dnaSequenceInputBound'), 2000);
    },

    search() {
      if (this.checkInputs()) {
      let text = this.get('text');
        this.dnaSequenceInput(text);
      }
    }

  },

  /*--------------------------------------------------------------------------*/

  checkInputs() {
    let ok;
    this.clearMsgs();

    let datasetName = this.get('newDatasetName');
    let parentName = this.get('selectedParent');
    if (! parentName || ! parentName.length || (parentName === 'None')) {
      this.set('nameWarning', 'Please select a reference genome to search');
      ok = false;
    } else if (this.get('addDataset') && ! (datasetName && datasetName.length)) {
      this.set('nameWarning', 'Please enter name for the dataset to add containing the search results.o');
      ok = false;
    } else if (this.get('addDataset') && this.isDupName()) {
      ok = false;
    } else {
      ok = true;
    }
    return ok;
  },
  inputsOK : computed('selectedParent', 'addDataset', 'newDatasetName', 'datasets.[]', function() {
    return this.checkInputs();
  }),
  searchButtonDisabled : computed('inputsOK', 'isProcessing', function() {
    return ! this.get('inputsOK') || this.get('isProcessing');
  }),

  /** throttle depends on constant function  */
  dnaSequenceInputBound : computed(function() {
    return bind(this, this.dnaSequenceInput);
  }),

  dnaSequenceInput(rawText) {
    const fnName = 'dnaSequenceInput';
    // dLog("dnaSequenceInput", rawText && rawText.length);
    /** if the user has use paste or newline then .text is defined,
     * otherwise use jQuery to get it from the textarea.
     */
    if (! rawText) {
      let text$ = $('textarea', this.element);
      /** before textarea is created, .val() will be undefined. */
      rawText = text$.val();
    }
      if (rawText)
      {
        let
        seq = rawText;
	/*
          .replaceAll(/[ \n\t]+/g, "")
          .toLowerCase();
	*/
        dLog("dnaSequenceInput", seq);
        let
        /** based on serverTabSelected or primary */
        apiServer = this.get('controls.apiServerSelectedOrPrimary'),
        auth = this.get('auth'),
        parent = this.get('selectedParent'),
        searchType = 'blast',
        promise = auth.dnaSequenceSearch(
          apiServer,
          seq, parent, searchType,
          this.get('resultRows'),
          this.get('addDataset'),
          this.get('newDatasetName'),
          /*options*/{/*dataEvent : receivedData, closePromise : taskInstance*/});

        promise.catch(
          (error) => {
            dLog('dnaSequenceInput catch', error, arguments);
          });
        promise.then(
          (data) => {
            dLog('dnaSequenceInput', data.features.length);
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
    }
  },

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
  }

  /*--------------------------------------------------------------------------*/

});
