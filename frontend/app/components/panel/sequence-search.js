import Component from '@ember/component';
import { bind, once, later, throttle, debounce } from '@ember/runloop';
import { inject as service } from '@ember/service';
import { observer, computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { A as array_A } from '@ember/array';
import { on } from '@ember/object/evented';

import { task, didCancel } from 'ember-concurrency';

import $ from 'jquery';

import sequenceSearchData from '../../utils/data/sequence-search-data';
import { isValidAlternateBasesOrAmbiguityCodes, alternateBasesToAmbiguityCodes } from '../../utils/data/sequenceChars';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

function logArray(a) { return a.length > 4 ? a.length : a; }

/** From :
 * https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Web&PAGE_TYPE=BlastDocs&DOC_TYPE=BlastHelp
 * 
Blank lines are not allowed in the middle of FASTA input.

Sequences are expected to be represented in the standard IUB/IUPAC amino acid and nucleic acid codes, with these exceptions: lower-case letters are accepted and are mapped into upper-case; a single hyphen or dash can be used to represent a gap of indeterminate length; and in amino acid sequences, U and * are acceptable letters (see below). Before submitting a request, any numerical digits in the query sequence should either be removed or replaced by appropriate letter codes (e.g., N for unknown nucleic acid residue or X for unknown amino acid residue). The nucleic acid codes supported are: 
		A  adenosine          C  cytidine             G  guanine
		T  thymidine          N  A/G/C/T (any)        U  uridine 
		K  G/T (keto)         S  G/C (strong)         Y  T/C (pyrimidine) 
		M  A/C (amino)        W  A/T (weak)           R  G/A (purine)        
		B  G/T/C              D  G/A/T                H  A/C/T      
		V  G/C/A              -  gap of indeterminate length
		
 */
const validSequenceChars = 'ACGTUMRWSYKVHDBN';

const searchInputsMax = 5;

/*----------------------------------------------------------------------------*/

export default Component.extend({
  auth: service(),
  queryParams: service('query-params'),
  controls : service(),

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

  classNames: ['panel-section'],

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

  /** set up a component reference for use in the Web Inspector console */
  develRefnSetup : on('init', function () {
    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.sequenceSearch = this;
    }
  }),  

  /** Preserve a reference to the <BsTab> so that when the result is received
   * (sendRequest -> dnaSequenceSearch() resolves), .then() can switch to that
   * result tab.
   *
   * This design is sufficient in this case; for further tab control and
   * interactions see also components/elem/tab-names, used in
   * panel/manage-genotype for the sampleFilter tabs.
   *
   * The <BsTab> contains these tabs :
   * - #sequence-search-input 'Sequence Input',
   * - #sequence-search-output-3'Blast Output ({{search.timeId}}'
   */
  storeBsTab(argA) {
    const tab = argA[0];
    this.bsTab = tab;
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

  setText(text) {
    this.set('text', text);
  },

  //----------------------------------------------------------------------------

  /** Trim out newlines which are not required.
   * Factored out of paste(), above. This is not an action.
   */
  formatText(text) {
        /** Between each '>marker-name' line, join the subsequent lines. */
        let lines = text.split('\n');
        let textOut = lines.reduce((linesOut, line, i) => {
          if (line.startsWith('>')) {
            if (i > 0) { linesOut.push('\n'); } linesOut.push(line); linesOut.push('\n');
          } else {
            linesOut.push(line); }
          return linesOut;
        }, []);

        text = textOut.join('');
    return text;
  },

  //----------------------------------------------------------------------------

 // actions
  actions: {
 
    clear() {
      this.setText('');
    },

    search() {
      this.setText(this.formatText(this.text));
      if (this.checkInputs()) {
      let text = this.get('text');
        this.dnaSequenceInput(text);
      }
    }

  },

  text$ : computed(function () {
    return $('textarea', this.element);
  }),

  fromSelectedFeatures() {
    const fnName = 'fromSelectedFeatures';

    let
    tableSelectedFeatures = this.get('controls').get('tableSelectedFeatures'),
    selectedFeatures = tableSelectedFeatures?.length ? tableSelectedFeatures : this.get('selectedFeatures');
    /** copied from feature-list.js, this could be factored. */
    let selectedFeaturesEmpty = ! selectedFeatures.length ||
        ((selectedFeatures.length === 1) && (selectedFeatures[0].Feature === undefined));

    /** allow several rows if user has sub-selected in table with rectangle select. */
    const subSelection = !! tableSelectedFeatures?.length;
    this.set('subSelection', subSelection);
    if (! selectedFeaturesEmpty) {
      let
      /** if selectedFeatures contains QTLs which have Feature.values.Sequence
       * then map the first one into a FASTA format for the search string.
       */
      selectedFeaturesSequence = selectedFeatures
        .filter(
          (sf) => 
            {
              let f = sf.feature;
              return f.values && f.values.Sequence;
            });
      dLog('fromSelectedFeatures', logArray(selectedFeaturesSequence));
      if (selectedFeaturesSequence.length) {
        let selectedFeaturesFasta = selectedFeaturesSequence
            .slice(0, subSelection ? 3 : 1)
            .map(function (sf) {
              let f = sf.feature;
              return '>' + sf.feature.name + '\n' + f.values.Sequence;
            });

        let text = selectedFeaturesFasta.join('\n');
        this.setText(text);

        let warningMessage = this.checkTextInput(text);
        if (warningMessage) {
          this.set('warningMessage', warningMessage);
        }
      }
    }

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
  searchButtonDisabled : computed('searching', 'text', 'isProcessing', function() {
    /** originally checked inputsOK instead of text. */
    return this.get('searching') || ! this.get('text') || this.get('isProcessing');
  }),

  /** Bind on this for use in throttle, which depends on having a constant function.
   * This was used (until 1e7c0e9e when it was deferred to search) in
   * actions.dnaSequenceInput() via
   *   throttle(this.get('dnaSequenceInputBound'), 2000);
   * as that action was called via enter / newline / escape in the textarea.
   * The button which calls actions.search() ... this.dnaSequenceInput() is
   * disabled while this.searching, so throttle is likely not needed now.
   */
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
      .filter((l) => ! isValidAlternateBasesOrAmbiguityCodes(l)),
    keys = notBases
      .filter((maybeKey) => maybeKey.match(/^>[^\n]+$/)),
    other = notBases
      .filter((maybeKey) => ! maybeKey.match(/^>[^\n]+$/))
      .filter((maybeEmpty) => ! maybeEmpty.match(/^[ \t\n]*$/));
    switch (keys.length) {
    case 0:
      warningMessages.push('Key line is required : >MarkerName ...');
      break;
    default:
      if (keys.length > searchInputsMax) {
        warningMessages.push('Limit is 1 FASTA search');
      }
      break;
    }
    let
      sequenceLinesLength = lines.length - notBases.length;
    if (sequenceLinesLength === 0) {
      warningMessages.push('DNA text is required : e.g. ' + validSequenceChars + '..., either case.');
    }
    if (other.length) {
      warningMessages.push('Input should be either >MarkerName or DNA text e.g. ' + validSequenceChars + '..., either case; this input not valid :' + other[0]);
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
      let converted = alternateBasesToAmbiguityCodes(rawText);
      let taskInstance = this.get('sendRequest').perform(converted);
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
        promise.then(() => this.selectResultTab(searchData));

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
    
  },

  selectResultTab(searchData) {
    this.bsTab.select(searchData.tabId);
  },

  /*--------------------------------------------------------------------------*/

});
