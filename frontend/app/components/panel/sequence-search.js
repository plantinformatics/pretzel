import Component from '@ember/component';
import { bind, once, later, throttle } from '@ember/runloop';
import { inject as service } from '@ember/service';
import { observer, computed } from '@ember/object';


const dLog = console.debug;

export default Component.extend({
  auth: service(),

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
  /*--------------------------------------------------------------------------*/
  /** copied from data-csv.js; could factor as a mixin. */
  newDatasetName: '',
  nameWarning: null,
  /** Checks if entered dataset name is already taken in dataset list
   *  Debounced call through observer */
  isDupName: function() {
    let selectedMap = this.get('selectedDataset');
    if (selectedMap === 'new') {
      let newMap = this.get('newDatasetName');
      let datasets = this.get('datasets');
      let matched = datasets.findBy('name', newMap);
      if(matched){
        this.set('nameWarning', `Dataset name '${newMap}' is already in use`);
        return true;
      }
    }
    this.set('nameWarning', null);
    return false;
  },
  onNameChange: observer('newDatasetName', function() {
    debounce(this, this.isDupName, 500);
  }),
  onSelectChange: observer('selectedDataset', 'selectedParent', function() {
    this.clearMsgs();
    this.isDupName();
    this.checkBlocks();
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
        this.dnaSequenceInput(/*text*/);
      }, 500);
    },

    dnaSequenceInput(text, event) {
      dLog("dnaSequenceInput", this, text.length, event.keyCode);
      this.set('text', text);
      throttle(this.get('dnaSequenceInputBound'), 2000);
    }

  },

  /*--------------------------------------------------------------------------*/

  /** throttle depends on constant function  */
  dnaSequenceInputBound : computed(function() {
    return bind(this, this.dnaSequenceInput);
  }),

  dnaSequenceInput(rawText) {
    rawText = this.get('text');
    // dLog("dnaSequenceInput");

    /*
    let
      text$ = $('textarea', this.element),
      /** before textarea is created, .val() will be undefined. */
      // rawText = text$.val();
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
        parent = "Triticum_aestivum_IWGSC_RefSeq_v1.0",
        searchType = 'blast',
        promise = auth.dnaSequenceSearch(
          apiServer,
          seq, parent, searchType,
          this.get('resultRows'),
          this.get('addDataset'),
          this.get('newDatasetName'),
          /*options*/{/*dataEvent : receivedData, closePromise : taskInstance*/});

        promise.then(
          (data) => {
            dLog('dnaSequenceInput', data.features.length);
            this.set('data', data.features); },
          // copied from data-base.js - could be factored.
          (err, status) => {
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
            this.scrollToTop();
          }

        );
    }
  }

});
