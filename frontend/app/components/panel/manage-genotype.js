import Component from '@glimmer/component';
import EmberObject, { computed, action, set as Ember_set } from '@ember/object';
import { alias, reads } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { later } from '@ember/runloop';
import { A as Ember_A } from '@ember/array';


import { toPromiseProxy, toArrayPromiseProxy } from '../../utils/ember-devel';
import { contentOf } from '../../utils/common/promises';
import { intervalSize } from '../../utils/interval-calcs';
import { overlapInterval } from '../../utils/draw/zoomPanCalcs';
import {
  refAlt,
  vcfGenotypeLookup,
  addFeaturesJson, vcfFeatures2MatrixView, vcfFeatures2MatrixViewRows,
  featureSampleNames,
 } from '../../utils/data/vcf-feature';
import { stringCountString } from '../../utils/string';

/* global $ */

// -----------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

const haplotypeFiltersSymbol = Symbol.for('haplotypeFilters');
const haplotypeFeaturesSymbol = Symbol.for('haplotypeFeatures');
const sampleMatchesSymbol = Symbol.for('sampleMatches');

//------------------------------------------------------------------------------

/** Given a key within Feature.values, classify it as sample (genotype data) or other field.
 */
function valueNameIsNotSample(valueName) {
  return ['ref', 'alt', 'tSNP', 'MAF'].includes(valueName);
}


// -----------------------------------------------------------------------------


/**
 * @param selectBlock action
 * @param selectedBlock selected data block
 * @param selectedFeatures
 * @param updatedSelectedFeatures 'updateSelectedFeatures'
 * @param userSettings  userSettings.genotype
 * user-selected values are preserved in args.userSettings
 * (related : services/data/selected.js)
 * Within userSettings (object) :
 *
 * Arrays of sample names selected by the user, per dataset. indexed by VCF datasetId
 * .vcfGenotypeSamplesSelected = {} (aliased as vcfGenotypeSamplesSelectedAll)
 *
 * .requestFormat 'Numerical' (default), 'CATG'
 * .replaceResults default: false
 * .showResultText default: false
 * .filterBySelectedSamples default : true
 * .mafUpper default : true
 * .mafThreshold default 0
 * .haplotypeFilterRef default : false
 * @see userSettingsDefaults()
 */
export default class PanelManageGenotypeComponent extends Component {
  @service() controls;
  @service() auth;
  /** used for axisBrush.brushedAxes to instantiate axis-brush s. */
  @service('data/flows-collate') flowsService;
  @service('data/block') blockService;
  @service('data/vcf-genotype') sampleCache;
  @service('query-params') queryParamsService;


  @alias('controls.apiServerSelectedOrPrimary') apiServerSelectedOrPrimary;

  @alias('queryParamsService.urlOptions') urlOptions;


  // ---------------------------------------------------------------------------

  /** Raw text result from vcfGenotypeLookup() : bcftools query. */
  @tracked
  vcfGenotypeText = '';

  /** Comment header of VCF file; prepended to query result to create VCF Download. */
  @tracked
  headerText = undefined;

  /** combined headerText and .vcfGenotypeText, for export via file-anchor */
  @tracked
  vcfExportText = [];

  /** Counter of results from vcfGenotypeSamples(). */
  @tracked
  receivedNamesCount = 0;

  // @alias('lookupBlockSamples.names')
  @computed('lookupDatasetId', 'receivedNamesCount')
  get vcfGenotypeSamplesText() {
    return this.sampleCache.sampleNames[this.lookupDatasetId];
  }
  set vcfGenotypeSamplesText(names) {
    this.sampleCache.sampleNames[this.lookupDatasetId] = names;
  }

  @alias('args.userSettings.vcfGenotypeSamplesSelected')
  vcfGenotypeSamplesSelectedAll;

  // @computed('lookupBlockSamples.selected')
  @computed('lookupDatasetId', 'receivedNamesCount')
  get vcfGenotypeSamplesSelected() {
    let selected = this.vcfGenotypeSamplesSelectedAll[this.lookupDatasetId];
    return selected;
  }
  set vcfGenotypeSamplesSelected(selected) {
    this.vcfGenotypeSamplesSelectedAll[this.lookupDatasetId] = selected;
  }

  @tracked
  displayData = Ember_A();
  /** data for matrix-view displayDataRows,
   * [feature position][sample name]{name, value, Symbol feature }
   */
  @tracked
  displayDataRows = null;

  /** derived from brushedVCFBlocks .featuresInBrush  .values. sampleNames 
   * in showSamplesWithinBrush()
   */
  @tracked
  columnNames = null;

  /** in .args.userSettings : */
  /** true means replace the previous result Features added to the block. */
  // replaceResults = undefined;

  @tracked
  axisBrushBlockIndex = undefined;

  @tracked
  showInputDialog = false;

  @alias('args.userSettings.showResultText')
  showResultText;

  /** Warning message from failure of vcfGenotypeLookup or vcfGenotypeSamples API */
  @tracked
  lookupMessage = null;

  // ---------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    this.userSettingsDefaults();
  }
  /** Provide default values for args.userSettings; used in constructor().
   */
  userSettingsDefaults() {
    const userSettings = this.args.userSettings;
    if (userSettings.vcfGenotypeSamplesSelected === undefined) {
      userSettings.vcfGenotypeSamplesSelected = {};
    }

    // possible values listed in comment before requestFormat
    this.requestFormat =
      userSettings.requestFormat || 'Numerical';  // alternate : CATG

    /* most of the following flags are (mut) in checkboxes in .hbs, which
     * may require that they have a defined initial value.
     */

    if (userSettings.replaceResults === undefined) {
      userSettings.replaceResults = false;
    }

    if (userSettings.showResultText === undefined) {
      userSettings.showResultText = false;
    }

    if (userSettings.filterBySelectedSamples === undefined) {
      userSettings.filterBySelectedSamples = true;
    }

    if (userSettings.mafUpper === undefined) {
      userSettings.mafUpper = false;
    }
    if (userSettings.mafThreshold === undefined) {
      userSettings.mafThreshold = 0;
    }

    if (userSettings.haplotypeFilterRef === undefined) {
      userSettings.haplotypeFilterRef = false;
    }


    if (this.urlOptions.gtMergeRows === undefined) {
      this.urlOptions.gtMergeRows = false;
    }

  }

  // ---------------------------------------------------------------------------

  /** Called by user selecting a dataset from <select>,
   * via <select onchange={{action this.mut_axisBrushBlockIndex value="target.value"}}>
   * @param value is a string, because <option> values are strings.
   */
  @action
  mut_axisBrushBlockIndex(value) {
    dLog('axisBrushBlockIndex', value, arguments, this);
    this.axisBrushBlockIndex = +value;
    /** save user setting for next component instance. */
    this.args.userSettings.lookupBlock = this.lookupBlock;
    /*
    later(() => {
      if (this.vcfGenotypeSamplesSelected === undefined) {
        this.vcfGenotypeSamplesSelected = [];
      }
    });
    */
  }

  // ---------------------------------------------------------------------------

  /** Maximum interval for VCF lookup request.
   * This initial default value is coordinated with hbs : <input ... value=1 ... intervalLimitInput >
   * If ! gtIntervalLimit, don't apply a limit.
   */
  @tracked
  intervalLimit = this.urlOptions.gtIntervalLimit ? 1 : 1e5;

  @action
  intervalLimitInput(event) {
    /** default is 1 : value=1 in hbs
     * event.target.value is a string; convert to a number.
     */
    let value = +event.target.value;
     dLog('intervalLimitInput', value, event.target.value);
    this.intervalLimit = value;
  }

  // -----------------------------------

  /** Limit on result rows for VCF lookup response.
   * This initial default value is coordinated with hbs : <input ... value=100 ... rowLimitInput >
   */
  @tracked
  rowLimit = 100;

  @action
  rowLimitInput(event) {
    /** default is 100 : value=100 in hbs
     * event.target.value is a string; convert to a number.
     */
    let value = +event.target.value;
     dLog('rowLimitInput', value, event.target.value);
    this.rowLimit = value;
  }

  //----------------------------------------------------------------------------

  mafThresholdMin = .001;
  mafThresholdMax = 1;

  /** @userSettings.mafUpper : true means use maf threshold as an upper limit. */

  /** @return < or > to indicate whether .maf is an upper or lower threshold,
   * respectively, depending on .mafUpper
   */
  @computed('args.userSettings.mafUpper')
  get mafThresholdText() {
    const
    text = this.args.userSettings.mafUpper ? '<' : '>';
    dLog('mafThresholdText', this.args.userSettings.mafUpper, text);
    return text;
   }

  /**
   * @param inputType "text" or "range"
   */
  @action
  mafThresholdChanged(value, inputType) {
    /* if (trace) { */
    dLog('mafThresholdChanged', value, inputType);
    Ember_set(this, 'args.userSettings.mafThreshold', value);
  }

  //----------------------------------------------------------------------------

  /** User may select tSNP values which are then used to filter samples,
   * in combination with a flag which selects match with Ref or non-Ref values :
   * columns of samples with the expected value are displayed.
   */
  @action
  blockHaplotypeFilters(block) {
    // equivalent : block = contentOf(block);
    if (block.content) {
      block = block.content;
    }
    const filters = block[haplotypeFiltersSymbol] || (block[haplotypeFiltersSymbol] = Ember_A());
    return filters;
  }

  @action
  haplotypeToggle(feature, haplotype) {
    const
    block = feature.get('blockId'),
    filters = this.blockHaplotypeFilters(block);
    this.arrayToggleObject(filters, haplotype);
    this.haplotypeFiltersSet();
  }
  /** If object is in array, remove it, otherwise add it.
   * @param object  any value - string or object, etc
   */
  arrayToggleObject(array, object) {
    const present = array.includes(object);
    if (present) {
      /* currently getting multiple calls to afterSelectionHaplotype(), so disable toggle off
      array.removeObject(object);
      */
    } else {
      array.addObject(object);
    }
    return present;
  }

  @action
  haplotypeFiltersClear() {
    const fnName = 'haplotypeFiltersClear';
    dLog(fnName);
    const
    abBlocks = this.brushedOrViewedVCFBlocks;
    abBlocks.forEach((abBlock) => {
      const
      block = abBlock.block,
      selected = block[haplotypeFiltersSymbol];
      if (abBlock.haplotypeFilters !== selected) {
        dLog(fnName, abBlock, abBlock.haplotypeFilters, selected);
      }
      if (selected.length) {
        selected.removeAt(0, selected.length);
      }
    });
    // Refresh display.
    this.haplotypeFiltersSet();
    // also done in hbs via action pipe
    // this.haplotypeFiltersApply();
  }

  @action
  haplotypeFiltersApply() {
    if (this.matrixView && ! this.matrixView.isDestroying) {
      this.matrixView.filterSamplesBySelectedHaplotypes();
      later(() => this.matrixView.table.render(), 2000);
    }
  }
  

  /** Use Ember_set() to signal update of tracked properties and trigger re-render. */
  haplotypeFiltersSet() {
    dLog('haplotypeFiltersSet');
    const
    abBlocks = this.brushedOrViewedVCFBlocks;
    abBlocks.forEach((abBlock) => {
      const
      block = abBlock.block;
      Ember_set(abBlock, 'haplotypeFilters', abBlock.haplotypeFilters);
    });
  }


  // ---------------------------------------------------------------------------


  /** 
   *    requestFormat : string : 'CATG', 'Numerical'
   */

  /** The user can choose the format of information to request from bcftools,
   * which is associated with a corresponding Renderer. */
  @tracked
  requestFormat = undefined;
  requestFormatChanged(value) {
    dLog('requestFormatChanged', value);
    this.requestFormat = value;
  }

  //----------------------------------------------------------------------------

  /** The user can choose how to determine the samples to request from bcftools.
   * input radio : choose how to specify which samples / individuals to request genotype of. 
   * requestSamples : string : 'Selected', 'All', 'Filtered'
   */
  @tracked
  requestSamples = undefined;
  requestSamplesChanged(value) {
    dLog('requestSamplesChanged', value);
    this.requestSamples = value;
  }

  // ---------------------------------------------------------------------------

  /** @return array of blocks and the haplotypes selected on them for filtering samples.
   */
  @computed('brushedOrViewedVCFBlocks')
  get blocksHaplotypeFilters() {
    const
    fnName = 'blocksHaplotypeFilters',
    axisBrushes = this.brushedOrViewedVCFBlocks,
    blocksHF = axisBrushes.map(
      (ab) => ({block : ab.block, haplotypeFilters : this.blockHaplotypeFilters(ab.block)}));
    dLog(fnName, axisBrushes, blocksHF);
    return blocksHF;
  }

  //----------------------------------------------------------------------------

  /** @return the {axisBrush, vcfBlock} selected via gui pull-down
   */
  @computed('brushedOrViewedVCFBlocks', 'axisBrushBlockIndex')
  get axisBrushBlock() {
    const
    fnName = 'axisBrushBlock',
    axisBrushes = this.brushedOrViewedVCFBlocks;
    let abb = axisBrushes &&
        ((this.axisBrushBlockIndex === undefined) ? undefined : 
         axisBrushes[this.axisBrushBlockIndex]);
    dLog(fnName, axisBrushes, abb);
    return abb;
  }

  /**
   * @return model:axis-brush
   */
  @computed('axisBrushBlock')
  get axisBrush() {
    const abb = this.axisBrushBlock;
    return abb?.axisBrush;
  }

  @computed('axisBrushBlock')
  get lookupBlock() {
    const abb = this.axisBrushBlock;
    return abb?.block;
  }
  /** axisBrushBlock -> lookupBlock is selected from a list which satisfies dataset .hasTag('view').
   * May later pass lookupDatasetId .meta.vcfFilename
   * See comments in vcfGenotypeLookup() re. vcfDatasetId / parent.
   */
  @computed('lookupBlock')
  get lookupDatasetId() {
    const b = this.lookupBlock;
    return b?.get('datasetId.id');
  }
  @computed('lookupBlock')
  get lookupScope() {
    const b = this.lookupBlock;
    /** Using .name instead of .scope to handle some test datasets which have
     * 'chr' prefixing the chr name, e.g. chr1A
     * Will probably revert this to 'scope'.
     */
    return b?.get('name');
  }
  /** @return for .lookupDatasetId selected by user, the sampleNames array
   * received, and the .selectedSamples the user has selected from those.
   */
  @computed('lookupDatasetId', 'receivedNamesCount')
  get lookupBlockSamples() {
    const names = this.sampleCache.sampleNames[this.lookupDatasetId];
    let selected = this.vcfGenotypeSamplesSelectedAll[this.lookupDatasetId];
    if (false && names?.length && ! selected) {
      selected = names.slice(0, 256).split('\n').slice(0, 6).join('\n');
      this.vcfGenotypeSamplesSelected = selected;
    }
    return {names, selected};
  }

  /** @return number of sample names in .vcfGenotypeSamplesText
   */
  @computed('vcfGenotypeSamplesText')
  get samples() {
    const
    samples = this.vcfGenotypeSamplesText?.split('\n')
    ;//.map((name) => ({name, selected : false}));
    return samples;
  }
  @computed('samples')
  get vcfGenotypeSamplesCount() {
    const count = this.samples?.length;
    return count;
  }

  //------------------------------------------------------------------------------

  @alias('vcfGenotypeSamplesSelected')
  selectedSamples;
  /*
  @tracked
  selectedSamples = [];
  */

  @reads('selectedSamples.length')
  selectedCount;

  /** Use jQuery target.val() to map the multi-select to an array of selected sample names.
   *
   * This function, selectedCount(), and in hbs :
   *  <select> #each this.samples <option>
   *  <ul> #each .selectedSamples <li>
   * are based on https://balinterdi.com/blog/select-in-ember-with-multiple-selection/ 25 September 2015
   */
  @action
  selectSample(event) {
    const selectedSamples = $(event.target).val();
    this.selectedSamples = selectedSamples || [];
  }


  //------------------------------------------------------------------------------

  /** @return selectedSamples of the given blocks
   * If no samples are selected, result is [].
   * @param blocks  VCF blocks, which may be brushed
   */
  blocksSelectedSamples(blocks) {
    const
    fnName = 'blocksSelectedSamples',
    brushedVCFDatasetIds = blocks.map((block) => block.get('datasetId.id')),
    selected = brushedVCFDatasetIds.map((datasetId) => this.vcfGenotypeSamplesSelectedAll[datasetId])
      .filter((a) => a)
      .flat();
    return selected;
  }


  /** Return brushed VCF blocks
   *
   * @return [{axisBrush, vcfBlock}, ...]
   * axisBrush will be repeated when there are multiple vcfBlocks on the axis of that axisBrush.
   * @desc
   * Dependency on .viewed provides update when a data block is added to an axis which is brushed.
   * axis1d.brushedBlocks also depends (indirectly) on viewed[].
   */
  @computed('flowsService.axisBrush.brushedAxes', 'blockService.viewed.[]')
  get brushedVCFBlocks() {
    const
    fnName = 'brushedVCFBlocks',
    axisBrushes = this.flowsService.axisBrush.brushedAxes,
    blocks = axisBrushes.map((ab) => {
      let
      axis1d = ab.block.get('axis1d'),
      vcfBlocks = axis1d.brushedBlocks
        .filter(
          (b) => b.get('datasetId').content.hasTag('VCF')),
      ab1 = vcfBlocks.map((block) => ({axisBrush : ab, block}));
      return ab1;
    })
      .flat();
    dLog(fnName, axisBrushes, blocks, this.blockService.viewed.length, this.blockService.params.mapsToView);
    return blocks;
  }
  /** Set .axisBrushBlockIndex from userSettings.lookupBlock, with the
   * constraint that it is within the blocks in the dataset selector in the
   * samples dialog.
   * @param blocks  result of brushedOrViewedVCFBlocks :  [{axisBrush, vcfBlock}, ...]
   */
  lookupBlockWithinBlocks(blocks) {
    const fnName = 'lookupBlockWithinBlocks';
    if (blocks.length) {
      /** Update .axisBrushBlockIndex : find .lookupBlock in blocks[], or ensure
       * .axisBrushBlockIndex is within blocks[].
       */
      const lookupBlock = this.args.userSettings.lookupBlock;
      if (lookupBlock !== undefined) {
        this.axisBrushBlockIndex = blocks.findIndex((abb) => abb.block === lookupBlock);
        if (this.axisBrushBlockIndex === undefined) {
          this.args.userSettings.lookupBlock = undefined;
        }
        dLog(fnName, this.axisBrushBlockIndex, blocks[this.axisBrushBlockIndex].block.id, blocks, lookupBlock.id);
      } else if ((this.axisBrushBlockIndex === undefined) || (this.axisBrushBlockIndex > blocks.length-1)) {
        /* first value is selected. if only 1 value then select onchange action will not be called.  */
        this.axisBrushBlockIndex = 0;
      }
    }
  }
  /** Return viewed (loaded) VCF blocks
   *
   * @return [{axisBrush, vcfBlock}, ...]
   */
  @computed('blockService.viewed.[]')
  get viewedVCFBlocks() {
    const
    fnName = 'viewedVCFBlocks',
    vcfBlocks = this.blockService.viewed.filter(
      (b) => b.get('datasetId').content.hasTag('VCF')),
    blocks = vcfBlocks.map((block) => ({
      axisBrush : EmberObject.create({block : block.referenceBlock}),
      block}));
    dLog(fnName, blocks, this.blockService.viewed.length, this.blockService.params.mapsToView);
    return blocks;
  }

  @computed('viewedVCFBlocks', 'brushedVCFBlocks')
  get brushedOrViewedVCFBlocks() {
    const fnName = 'brushedOrViewedVCFBlocks';
    let blocks = this.brushedVCFBlocks;
    const
    brushedBlockSet = blocks.reduce((result, abb) => result.add(abb.block), new Set()),
    unBrushedAndViewed = this.viewedVCFBlocks.filter((abb) => ! brushedBlockSet.has(abb.block));
    if (unBrushedAndViewed.length) {
      blocks = blocks.concat(unBrushedAndViewed);
    }
    this.lookupBlockWithinBlocks(blocks);
    dLog(fnName, blocks.length);
    return blocks;
  }

  // ---------------------------------------------------------------------------

  /** dataset parent name of the selected block for lookup.
   * related : mapview : selectedDataset is the reference (parent) of the selected axis.
   */
  @alias('lookupBlock.datasetId.parentName') referenceDatasetName;

  // ---------------------------------------------------------------------------

  @computed('axisBrush.brushedDomain')
  get brushedDomainRounded () {
    /** copied from axis-brush.js */
    let domain = this.axisBrush?.brushedDomain;
    if (domain) {
      domain = domain.map((d) => d.toFixed(2));
    }
    return domain;
  }

  @computed('axisBrush.brushedDomain', 'intervalLimit')
  get vcfGenotypeLookupDomain () {
    /** copied from sequenceLookupDomain() axis-brush.js
     * could be factored to a library - probably 2 1-line functions - not compelling.
     */
    let
    domain = this.axisBrush?.brushedDomain,
    domainInteger = domain && 
      (intervalSize(domain) <= this.intervalLimit * 1e6) &&
      domain.map((d) => +d.toFixed(0));
    return domainInteger;
  }

  // ---------------------------------------------------------------------------

  /** Request the list of samples of the vcf of the brushed block.
   */
  vcfGenotypeSamples() {
    /** implemented by common/models/block.js : Block.vcfGenotypeSamples().  */
    const
    fnName = 'vcfGenotypeSamples',
    scope = this.lookupScope,
    vcfDatasetId = this.lookupDatasetId;
    if (scope && vcfDatasetId)
    {
      this.lookupMessage = null;

      let textP = this.auth.vcfGenotypeSamples(
        this.apiServerSelectedOrPrimary, vcfDatasetId, scope,
        {} );
      textP.then(
        (text) => {
          const t = text?.text;
          dLog(fnName, t?.length || Object.keys(text), t?.slice(0, 60));
          this.sampleCache.sampleNames[vcfDatasetId] = t;
          if ((vcfDatasetId === this.lookupDatasetId) &&
              (this.vcfGenotypeSamplesSelected === undefined)) {
            this.vcfGenotypeSamplesSelected = [];
          }
          this.receivedNamesCount++;
        })
        .catch(this.showError.bind(this, fnName));
    }
  }

  // ---------------------------------------------------------------------------

  showError(fnName, error) {
    let
    message = error.responseJSON?.error?.message || error;
    dLog(fnName, message, error.status, error.statusText);
    const match = message?.split('Error: Unable to run bcftools');
    if (match.length > 1) {
      message = match[0];
    }
    this.lookupMessage = message;
  }


  // ---------------------------------------------------------------------------

  /** if .requestSamples !== 'All', collate samples.
   * @return {samples, samplesOK}, which samplesOK is true if All or samples.length
   */
  get samplesOK() {
    let samples;
    const
    ok = this.requestSamples === 'All';
    if (! ok) {
      const
      samplesRaw = this.vcfGenotypeSamplesSelected || [];
      /** result is 1 string of names, separated by 1 newline.  */
      samples = samplesRaw?.join('\n');
      ok = samples?.length;
    }
    return {samples, samplesOK : ok};
  }

  /** Lookup the genotype for the selected samples in the interval of the brushed block.
   */
  vcfGenotypeLookup() {
    const
    fnName = 'vcfGenotypeLookup',
    /** this.axisBrush.block is currently the reference; lookup the data block. */
    // store = this.axisBrush?.get('block.store'),
    store = this.apiServerSelectedOrPrimary?.store,
    {samples, samplesOK} = this.samplesOK,
    domainInteger = this.vcfGenotypeLookupDomain,
    vcfDatasetId = this.lookupDatasetId;
    if (samplesOK && domainInteger && vcfDatasetId) { // && scope
      this.lookupMessage = null;
      let
      scope = this.lookupScope,
      requestFormat = this.requestFormat,
      requestSamples = this.requestSamples,
      requestOptions = {requestFormat, requestSamples},
      textP = vcfGenotypeLookup(this.auth, this.apiServerSelectedOrPrimary, samples, domainInteger,  requestOptions, vcfDatasetId, scope, this.rowLimit);
      // re-initialise file-anchor with the new @data
      this.vcfExportText = null;
      textP.then(
        (text) => {
          // displays vcfGenotypeText in textarea, which triggers this.vcfGenotypeTextSetWidth();
          this.vcfGenotypeText = text;
          this.headerTextP.then((headerText) => {
            const combined = this.combineHeader(headerText, this.vcfGenotypeText)
            /** ember-csv:file-anchor.js is designed for spreadsheets, and hence
             * expects each row to be an array of cells.
             */
                  .map((row) => [row]);
            // re-initialise file-anchor with the new @data
            later(() => this.vcfExportText = combined, 1000);
          });

          /** .lookupDatasetId is derived from .lookupBlock so .lookupBlock must be defined here. */
          let blockV = this.lookupBlock;
          dLog(fnName, text.length, text && text.slice(0,200), blockV.get('id'));
          if (text && blockV) {
            const added = addFeaturesJson(
              blockV, this.requestFormat, this.args.userSettings.replaceResults,
              this.args.selectedFeatures, text);

            if (added.createdFeatures && added.sampleNames) {
              /* Update the filtered-out samples, including the received data,
               * for the selected haplotypeFilters.
               * The received data (createdFeatures) is in lookupBlock, so could
               * limit this update to lookupBlock.
               * showHideSampleFn is passed undefined - this is just updating
               * the sample status, and table display is done by
               * showSamplesWithinBrush().
               */
              this.haplotypeFilterSamples(/*showHideSampleFn*/undefined, /*matrixView*/undefined);
              const showOtherBlocks = true;
              if (showOtherBlocks) {
                this.showSamplesWithinBrush();
              } else {
              /* use this to show just the result of this request in the table,
               * not showing other blocks; the other rows are not cleaned out
               * correctly by progressiveRowMerge(), leaving rows with no rowHeader
               * and/or Block/Position/Alt/Ref, and added.createdFeatures[] is shorter
               * than table data causing undefined / mis-aligned associated
               * features.
               */
              const displayData = vcfFeatures2MatrixView
                (this.requestFormat, added, this.featureFilter.bind(this));
              this.displayData.addObjects(displayData);
              }
              // equivalent : displayData[0].features.length
              if (added.createdFeatures.length) {
                this.showInputDialog = false;
              }
              /** added.sampleNames is from the column names of the result,
               * which should match the requested samples (.vcfGenotypeSamplesSelected).
               */
            }
          }

      })
      .catch(this.showError.bind(this, fnName));
    }
  }

  //----------------------------------------------------------------------------

  featureFilter(feature) {
    const
    MAF = feature.values.MAF,
    /** don't filter datasets which don't have MAF */
    ok = (MAF === undefined) || 
      ((+MAF < this.args.userSettings.mafThreshold) === this.args.userSettings.mafUpper);
    return ok;
  }

  //----------------------------------------------------------------------------


  @computed(
    'lookupDatasetId', 'lookupScope', 'vcfGenotypeLookupDomain',
    'vcfGenotypeSamplesSelected', 'requestFormat')
  get vcfExportFileName() {
    const
    scope = this.lookupScope,
    vcfDatasetId = this.lookupDatasetId,
    domainText = this.vcfGenotypeLookupDomain.join('-'),
    samplesLength = this.vcfGenotypeSamplesSelected ? this.vcfGenotypeSamplesSelected.length : '',
    fileName = vcfDatasetId +
      '_' + scope +
      '_' + domainText +
      '_' + this.requestFormat +
      '_' + samplesLength +
      '.vcf' ;
    return fileName;
  }

  // ---------------------------------------------------------------------------

  /** Show genotype for the samples and brushed block interval.
   */
  showBlockIntervalSamplesGenotype() {
    const fnName = 'showBlockIntervalSamplesGenotype';
    if (! this.displayData.length) {
      this.showSamplesWithinBrush();
    }
  }
  /** Show VCF data which has been received.
   * For those on brushed axes, filter features by the brush interval.
   * If any axes are brushed, show just (VCF) data blocks of brushed axes.
   * 
   */
  showSamplesWithinBrush() {
    const fnName = 'showSamplesWithinBrush';
    if (! this.axisBrush /* || ! this.lookupBlock*/) {
      // perhaps clear table
    } else {
      let
      referenceBlock = this.axisBrush?.get('block'),
      /** expect : block.referenceBlock.id === referenceBlock.id
       */
      blocks = this.brushedVCFBlocks.map((abb) => abb.block);
      /* Filter out blocks
       * which are isZoomedOut.  This is one way to enable .rowLimit
       * (or block.featuresCountsThreshold) to limit the
       * number of rows displayed in the genotype table.
       * related : block : isZoomedOut(), isBrushableFeatures(), featuresCountIncludingZoom()
       * (previously used : b.get('featuresCountsThreshold') in place of .rowLimit)
       * Now featuresArrays[] are sliced to rowLimit, so this may not be required, trialling without.
        .filter((b) => 
            b.get('featuresCountIncludingBrush') <= this.rowLimit);
       */
      if (blocks.length === 0) {
        blocks = this.blockService.viewed.filter((b) => b.hasTag('VCF'));
      }
      dLog(fnName, blocks.mapBy('id'));
      if (blocks.length) {
        const
        featuresArrays = blocks
        .filterBy('visible')
          .map((b) => b.featuresInBrush)
          .filter((features) => features.length)
          .map((features) => features.slice(0, this.rowLimit));

        this.collateBlockHaplotypeFeatures(featuresArrays);

        if (featuresArrays.length) {
          if (this.urlOptions.gtMergeRows) {
            /** {rows, sampleNames}; */
            const
            sampleGenotypes = 
              vcfFeatures2MatrixViewRows(
                this.requestFormat, featuresArrays, this.featureFilter.bind(this));
            this.displayDataRows = sampleGenotypes.rows;
            /* Position value is returned by matrix-view : rowHeaders().
             * for gtMergeRows the Position column is hidden.
             * .sampleNames contains : [ 'Ref', 'Alt', 'tSNP', 'MAF' ]; 'tSNP' is mapped to 'Haplotype'
             */
            this.columnNames = ['Block', 'Position', 'Name'].concat(sampleGenotypes.sampleNames);
          } else {
            let sampleNames;
            if (this.args.userSettings.filterBySelectedSamples) {
              /** instead of this.selectedSamples (i.e. of lookupDatasetId), show
               * selected samples of all .brushedVCFBlocks.
               */
              const selectedSamplesOfBrushed = this.blocksSelectedSamples(blocks);
              if (selectedSamplesOfBrushed.length) {
                sampleNames = selectedSamplesOfBrushed;
              }
            }
            if (! sampleNames) {
              sampleNames = this.featuresArraysToSampleNames(featuresArrays);
            }

            const
            features = featuresArrays.flat(),
            sampleGenotypes =  {createdFeatures : features, sampleNames},
            displayData = vcfFeatures2MatrixView
              (this.requestFormat, sampleGenotypes, this.featureFilter.bind(this));
            this.displayData = displayData;
          }
        }
      }
    }
  }
  /** A filterFn for featureSampleNames() : omit Ref & Alt.
   * Used in showSamplesWithinBrush() to omit Ref & Alt
   * from sampleNames because vcfFeatures2MatrixView() prepends
   * refAltColumns.
   * Does not use `this`, so bind is not required.
   */
  omitRefAlt(sampleName) {
    return ! refAlt.includes(sampleName) && sampleName;
  }
  featuresArraysToSampleNames(featuresArrays) {
    const
    sampleNamesSet = featuresArrays
      .reduce(
        (sampleNamesSet, features) => features
          .reduce(
            (sampleNamesSet, feature) =>
              featureSampleNames(sampleNamesSet, feature, this.omitRefAlt),
            sampleNamesSet),
        new Set()),
    sampleNames = Array.from(sampleNamesSet.keys());
    return sampleNames;
  }

  @computed(
    'axisBrush.brushedDomain',

    /* In vcfFeatures2MatrixViewRows() / gtMergeRows currently all samples
     * results received are displayed; vcfFeatures2MatrixView() filters by the
     * given added.sampleNames.   Added <select> for samples
     * in samples dialog in place of content-editable
     * vcfGenotypeSamplesSelected, then it would make sense to narrow the
     * display to just the samples the user currently selected, and then this
     * dependancy should be enabled :
     */
    'vcfGenotypeSamplesSelected.[]',

    'blockService.viewedVisible',
    'requestFormat', 'rowLimit',
    'args.userSettings.filterBySelectedSamples',
    /** showSamplesWithinBrush() uses gtMergeRows */
    'urlOptions.gtMergeRows',
    /** showSamplesWithinBrush() -> featureFilter() uses .mafUpper, .mafThreshold */
    'args.userSettings.mafUpper',
    'args.userSettings.mafThreshold',
  )
  get selectedSampleEffect () {
    const fnName = 'selectedSampleEffect';
    const viewedVisible = this.blockService.viewedVisible;
    dLog(fnName, viewedVisible.length);
    // remove all because sampleNames / columns may have changed.
    if (this.displayData.length) {
      this.displayData.removeAt(0, this.displayData.length);
    }
    this.showSamplesWithinBrush();
  }

  //----------------------------------------------------------------------------

  /** Construct a map from haplotype / tSNP values to Feature arrays.
   * @param featuresArrays  array of arrays of features, 1 array per block
   */
  collateBlockHaplotypeFeatures(featuresArrays) {
    featuresArrays
      .forEach(
        (features) => {
          const
          blockp = features?.[0].get('blockId'),
          /** blockp may be a proxy; want the actual Block, for reference via Symbol */
          block = blockp && contentOf(blockp),
          map = block[haplotypeFeaturesSymbol] || (block[haplotypeFeaturesSymbol] = {});
          features
          .reduce(
            (map, feature) => {
              const
              tSNP = feature.values?.tSNP;
              if (tSNP) {
                const features = map[tSNP] || (map[tSNP] = Ember_A());
                features.push(feature);
              }
              return map;
            },
            map);
        }
      );
  }

  /** for brushedOrViewedVCFBlocks, apply any haplotypeFilters which the blocks have.
   *
   * design :
   * block *
   *   Haplotype / tSNP *
   *     feature *
   *       sample *
   *         accumulate : block : sample : count of matches and mismatches 
   *
   * @param showHideSampleFn if provided, after filtering, call this for each
   * sample to hide/show the column.
   */
  @action
  haplotypeFilterSamples(showHideSampleFn, matrixView) {
    const
    matchRef = this.args.userSettings.haplotypeFilterRef,
    matchKey = matchRef ? 'ref' : 'alt',
    matchNumber = matchRef ? '0' : '2',
    /** to match homozygous could use .startsWith(); that will also match 1/2 of heterozygous.
     * Will check on (value === '1') : should it match depending on matchRef ?
     * @param value sample/individual value at feature / SNP
     * @param matchValue  ref/alt value at feature / SNP (depends on matchRef)
     */
    matchFn = (value, matchValue) => (value === matchNumber) || (value === '1') || value.includes(matchValue),

    ablocks = this.brushedOrViewedVCFBlocks;
    ablocks.forEach((abBlock) => {
      const
      block = abBlock.block,
      selected = block[haplotypeFiltersSymbol],
      matchesR = selected.reduce((matches, tSNP) => {
        const features = block[haplotypeFeaturesSymbol][tSNP];
        features.forEach((feature) => {
          const
          matchValue = feature.values[matchKey];
          Object.entries(feature.values).forEach(([key, value]) => {
            if (! valueNameIsNotSample(key)) {
              const match = matchFn(value, matchValue);
              const sampleMatch = matches[key] || (matches[key] = {matches: 0, mismatches : 0});
              sampleMatch[match ? 'matches' : 'mismatches']++;
            }
          });
        });
        return matches;
      }, {});
      block[sampleMatchesSymbol] = matchesR;
      if (showHideSampleFn) {
        /* 
         * block *
         *   sample*
         *     show/hide according to count
         */
        Object.entries(matchesR).forEach(([sampleName, counts]) => {
          showHideSampleFn(sampleName, counts);
        });
      }
    });
    if (matrixView) {
      // to enable trialling of action to filer after Clear
      this.matrixView = matrixView;
    }
  }


  //----------------------------------------------------------------------------

  @computed('vcfGenotypeSamplesSelected', 'lookupDatasetId', 'lookupScope')
  get headerTextP() {
    const
    fnName = 'headerText',
    {samples, samplesOK} = this.samplesOK,
    domainInteger = [0, 1],
    vcfDatasetId = this.lookupDatasetId,
    scope = this.lookupScope;
    let textP;
    if (samplesOK && scope && vcfDatasetId) {
      const
      requestFormat = this.requestFormat,
      requestSamples = this.requestSamples,
      requestOptions = {requestFormat, requestSamples, headerOnly : true};
      /** these params are not applicable when headerOnly : samples, domainInteger, rowLimit. */
      textP = vcfGenotypeLookup(
        this.auth, this.apiServerSelectedOrPrimary, samples, domainInteger,
        requestOptions, vcfDatasetId, scope, this.rowLimit);
      textP.then(
        (text) => {
          this.headerText = text;
          if (trace) {
            dLog(fnName, text);
          }
        })
        .catch(this.showError.bind(this, fnName));
      textP = toPromiseProxy(textP);
    }
    return textP;
  }

  @computed('headerText', 'vcfGenotypeText')
  get vcfExportTextP() {
    let combinedP;
    if (this.headerTextP) {
      combinedP = this.headerTextP
        .then((headerText) => {
          const
          combined = this.combineHeader(headerText, this.vcfGenotypeText);
          return combined;
        });
    } else {
      /** file-anchor.js requires a defined value for @data */
      combinedP = Promise.resolve([]);
    }
    combinedP = toArrayPromiseProxy(combinedP);
    return combinedP;
  }

  combineHeader(headerText, vcfGenotypeText) {
    /** remove trailing \n, so that split does not create a trailing empty line.  */
    headerText = headerText.trim().split('\n');
    /** vcfGenotypeText starts with column header line (#CHROM...), so trim the
     * column header line off the end of headerText.
     */
    if (headerText[headerText.length-1].startsWith('#CHROM')) {
      headerText = headerText.slice(0, headerText.length-1);
    }
    const
    tableRows = this.insertChromColumn(vcfGenotypeText),
    combined = headerText.concat(tableRows);
    return combined;
  }

  /** The vcf-genotype.js : vcfGenotypeLookup() format omits CHROM because it is
   * constant - each request is specific to a chromosome.
   * This function re-inserts the CHROM column in the conventional (left) position.
   * @param vcfGenotypeText string
   * @return array of strings, 1 per line
   */
  insertChromColumn(vcfGenotypeText) {
    const
    withChrom = vcfGenotypeText
    // ignore trailing \n which otherwise creates an empty line.
      .trim()
      .split('\n')
      .map((line, rowIndex) => {
        let result;
        if (rowIndex === 0) {
          // insert CHROM column header
          result = line
            .replace(/# /, '#CHROM\t')
          /* Strip out the column numbers [1] etc which are shown before column
           * headers by bcftools query -H.
           * Could match [ \t], but previous line changes that initial space to \t
           */
            .replaceAll(/\t\[\d+\]/g, '\t');
        } else {
          // insert chromosome / scope column value.
          result = this.lookupScope + '\t' + line;
        }
        return result;
      });
    return withChrom;
  }
  
  // ---------------------------------------------------------------------------

  @computed('vcfGenotypeText')
  get vcfGenotypeTextSizeDescription()
  {
    const
    fnName = 'vcfGenotypeTextSizeDescription',
    text = this.vcfGenotypeText,
    row0 = text.slice(0, text.indexOf('\n'));
    let
    columns = stringCountString(row0, '\t'),
    rows = stringCountString(text, '\n');
    if (columns) {
      /* count just the data columns.
       * first 2 columns are : ID	POS, so -2.  \t is column separator, so +1. result -1. */
      columns--;
    }
    if (rows) {
      /* count just the data rows.
       * first row is header, so -1  */
      rows--;
    }

    const
    description = '' + columns + ' columns, ' + rows + ' rows, ' + text.length + ' characters';
    return description;
  }

  @computed('auth.apiStats.vcfGenotypeLookup')
  get vcfGenotypeLookupCount() {
    const count = this.auth.apiStats['vcfGenotypeLookup'];
    return count;
  }

  @action
  vcfGenotypeTextWidthStyle() {
    const
    fnName = 'vcfGenotypeTextSetWidth',
    text = this.vcfGenotypeText,
    lastRowWidth = text.length - text.lastIndexOf('\n', text.length-2),
    style = lastRowWidth ? 'width:' + lastRowWidth + 'em' : '';
    console.log(fnName, arguments, lastRowWidth, style);
    return style;
  }

  // ---------------------------------------------------------------------------

  @action
  userMessage(text) {
    alert(text);
  }

  // ---------------------------------------------------------------------------
}
