import Component from '@ember/component';
import { bind, once, later, throttle, debounce } from '@ember/runloop';
import { inject as service } from '@ember/service';
import { observer, computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { A as array_A } from '@ember/array';
import { task, didCancel } from 'ember-concurrency';


import sequenceSearchData from '../../utils/data/sequence-search-data';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

export default Component.extend({
  auth: service(),
  queryParams: service('query-params'),

  urlOptions : alias('queryParams.urlOptions'),

  /*--------------------------------------------------------------------------*/

  /** required minimum length for FASTA DNA text search string input. */
  searchStringMinLength : 25,
  /** length limit for FASTA DNA text search string input. */
  searchStringMaxLength : 10000,
  /** limit rows in result */
  resultRows : 500,

  /** minimum values for 3 columns, to filter blast output. */
  minLengthOfHit : 0,
  minPercentIdentity : 0, // 75,
  minPercentCoverage : 0, // 50,

  /** true means add / upload result to db as a Dataset */
  addDataset : false,
  /** true means view the blocks of the dataset after it is added. */
  viewDatasetFlag : false,

  classNames: ['col-xs-12'],

  /** array of current searches.  each one is data for blast-result component. */
  searches : undefined,

  /*--------------------------------------------------------------------------*/

  init() {
    this._super(...arguments);

    this.set('searches', array_A());

    let searchStringMaxLength = this.get('urlOptions.searchStringMaxLength');
    if (searchStringMaxLength) {
      this.set('searchStringMaxLength', searchStringMaxLength);
    }
  },

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

  searching : alias('sendRequest.isRunning'),

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
    /** called for single-character input to textarea; similar to
     * actions.dnaSequenceInput() but that is only called for defined events
     * (enter / escape), and actions.paste() (paste).
     */
    inputIsActive(event) {
      // function name and use is copied from feature-list.
      // dLog('inputIsActive', event?.target);
      let text = event?.target?.value;
      if (text) {
        this.set('text', text);
      }
    },
    paste: function(event) {
      /** text is "" at this time. */
      /** this action function is called before jQuery val() is updated. */
      later(() => {
        let text = event && (event.target.value || event.originalEvent.target.value);
        console.log('paste', event, text.length);
        /** Join the subsequent lines. */
        let lines = text.split('\n');
        if (lines[0].startsWith('>') && (lines.length > 1)) {
          let marker = lines.shift();
          text = marker + '\n' + lines.join('');
        }
        this.set('text', text);
        this.text2Area();
        // this.dnaSequenceInput(/*text*/);
      }, 500);
    },

    dnaSequenceInput(text, event) {
      dLog("dnaSequenceInput", this, text.length, event.keyCode);
      this.set('text', text);
      // throttle(this.get('dnaSequenceInputBound'), 2000);
    },

    clear() {
      this.set('text', '');
      this.text2Area();
    },

    search() {
      if (this.checkInputs()) {
      let text = this.get('text');
        this.dnaSequenceInput(text);
      }
    }

  },

  text$ : computed(function () {
    return $('textarea', this.element);
  }),

  /** Copy .text to the textarea. */
  text2Area() {
    this.get('text$').val(this.get('text'));
  },

  /*--------------------------------------------------------------------------*/

  /** Check GUI inputs which are parameters for addDataset :
   *  - datasetName (newDatasetName)
   *  - parent name (selectedParent)
   * Both are required - check that they have been entered.
   * Check that newDatasetName is not a duplicate of an existing dataset.
   * Display messages if any checks fail.
   *
   * @return true if all checks pass.
   */
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
  inputsOK : computed('text', 'selectedParent', 'addDataset', 'newDatasetName', 'datasets.[]', function() {
    let warningMessage = this.checkTextInput(this.get('text'));
    if (warningMessage) {
      this.set('warningMessage', warningMessage);
    }
    /** checkInputs() sets .nameWarning */
    return ! warningMessage && this.checkInputs();
  }),
  searchButtonDisabled : computed('searching', 'inputsOK', 'isProcessing', function() {
    return this.get('searching') || ! this.get('inputsOK') || this.get('isProcessing');
  }),

  /** throttle depends on constant function  */
  dnaSequenceInputBound : computed(function() {
    return bind(this, this.dnaSequenceInput);
  }),

  /** @return a warningMessage if rawText does not meet input requirements, otherwise falsy.
   */
  checkTextInput(rawText) {
    let warningMessages = [];
    if (! rawText) {
      warningMessages.push("Please enter search text in the field 'DNA Sequence Input'");
    } else {
    let
    lines = rawText.split('\n'),
    notBases = lines
      .filter((l) => ! l.match(/^[ATGCN]+$/i)),
    keys = notBases
      .filter((maybeKey) => maybeKey.match(/^>[^\n]+$/)),
    other = notBases
      .filter((maybeKey) => ! maybeKey.match(/^>[^\n]+$/))
      .filter((maybeEmpty) => ! maybeEmpty.match(/^[ \t\n]*$/));
    switch (keys.length) {
    case 0:
      warningMessages.push('Key line is required : >MarkerName ...');
      break;
    case 1:
      break;
    default:
      warningMessages.push('Limit is 1 FASTA search');
      break;
    }
    let regexpIterator = rawText.matchAll(/\n[ATGCN]+/ig),
        sequenceLinesLength = Array.from(regexpIterator).length;
    if (sequenceLinesLength === 0) {
      warningMessages.push('DNA text is required : e.g. ATGCNatgcn...');
    }
    if (other.length) {
      warningMessages.push('Input should be either >MarkerName or DNA text e.g. ATGCNatgcn...; this input not valid :' + other[0]);
    }

    if (rawText.length > this.searchStringMaxLength) {
      warningMessages.push('FASTA search string is limited to ' + this.searchStringMaxLength);
    } else if (rawText.length <  this.searchStringMinLength) {
      warningMessages.push('FASTA search string should have minimum length ' + this.searchStringMinLength);
    } 
    }

    let warningMessage = warningMessages.length && warningMessages.join('\n');
    return warningMessage;
  },
  dnaSequenceInput(rawText) {
    const fnName = 'dnaSequenceInput';
    // dLog("dnaSequenceInput", rawText && rawText.length);
    let warningMessage;
    /** if the user has use paste or newline then .text is defined,
     * otherwise use jQuery to get it from the textarea.
     */
    if (! rawText) {
      let text$ = $('textarea', this.element);
      /** before textarea is created, .val() will be undefined. */
      rawText = text$.val();
    }
    if ((warningMessage = this.checkTextInput(rawText))) {
      this.set('warningMessage', warningMessage);
    } else {
      let taskInstance = this.get('sendRequest').perform(rawText);
    }
  },
  sendRequest : task(function* (rawText) {
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
          this.get('minLengthOfHit'),
          this.get('minPercentIdentity'),
          this.get('minPercentCoverage'),
          /*options*/{/*dataEvent : receivedData, closePromise : taskInstance*/});

        if (this.get('addDataset')) {
          /* On complete, trigger dataset list reload.
           * refreshDatasets is passed from controllers/mapview (updateModel ).
           */
          promise =
          promise.then(() => {
            const viewDataset = this.get('viewDatasetFlag');
            let refreshed = this.get('refreshDatasets')();
            if (viewDataset) {
              refreshed
                .then(() => {
                  /** same as convertSearchResults2Json() in dnaSequenceSearch.bash and
                   * backend/common/models/feature.js :  Feature.dnaSequenceSearch() */
                  let
                  datasetName = this.get('newDatasetName'),
                  datasetNameFull=`${parent}.${datasetName}`;
                  dLog(fnName, 'viewDataset', datasetNameFull);
                  this.get('viewDataset')(datasetNameFull, viewDataset);
                });
            }
          });
        }

        let searchData = sequenceSearchData.create({promise, seq, parent, searchType});
        this.get('searches').pushObject(searchData);

    return promise;
  }).drop(),


  closeResultTab(tabId) {
    dLog('closeResultTab', tabId);
    let searches = this.get('searches'),
        tab = searches.find((s) => s.tabId === tabId);
    if (tab) {
      searches.removeObject(tab);
    } else {
      dLog('closeResultTab', tabId, tab);      
    }
    
  }

  /*--------------------------------------------------------------------------*/

});
