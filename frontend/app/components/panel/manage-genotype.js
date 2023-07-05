import Component from '@glimmer/component';
import EmberObject, { computed, action, set as Ember_set, setProperties } from '@ember/object';
import { alias, reads } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { later } from '@ember/runloop';
import { A as Ember_A } from '@ember/array';

import { uniq } from 'lodash/array';

import NamesFilters from '../../utils/data/names-filters';
import { toPromiseProxy, toArrayPromiseProxy } from '../../utils/ember-devel';
import { thenOrNow, contentOf } from '../../utils/common/promises';
import { clipboard_writeText } from '../../utils/common/html';
import { intervalSize } from '../../utils/interval-calcs';
import { overlapInterval } from '../../utils/draw/zoomPanCalcs';
import {
  refAlt,
  datasetId2Class,
  vcfGenotypeLookup,
  addFeaturesJson,
  resultIsGerminate,
  addFeaturesGerminate,
  sampleIsFilteredOut,
  vcfFeatures2MatrixView, vcfFeatures2MatrixViewRows,
  rowsAddFeature,
  annotateRowsFromFeatures,
  featuresValuesFields,
  featureSampleNames,
 } from '../../utils/data/vcf-feature';
import { stringCountString } from '../../utils/string';

import { text2EltId } from '../../utils/explorer-tabId';

import { Germinate } from '../../utils/data/germinate';


/* global $ */
/* global d3 */

// -----------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

/** Feature SNP Positions which are selected for filtering.
 * block[featureFiltersSymbol] -> [] of Feature (or Position)
 */
const featureFiltersSymbol = Symbol.for('featureFilters');
/** tSNP values which are selected for filtering.
 * block[haplotypeFiltersSymbol] -> [] of tSNP
 */
const haplotypeFiltersSymbol = Symbol.for('haplotypeFilters');
/** array of Features / SNPs in a tagged SNP set, i.e. equal tSNP value.
 * features = block[haplotypeFeaturesSymbol][tSNP]
 */
const haplotypeFeaturesSymbol = Symbol.for('haplotypeFeatures');
/** Counts for filtering by LD Block (Haplotype) values
 * block[sampleMatchesSymbol] : {matches: 0, mismatches : 0}
 * also used in sampleIsFilteredOut{,Blocks}()
 */
const sampleMatchesSymbol = Symbol.for('sampleMatches');
/** Counts for calculating Call Rate of a sample.
 * sampleCount = block[callRateSymbol][sampleName] : {calls:0, misses:0}  */
const callRateSymbol = Symbol.for('callRate');

const tab_view_prefix = "tab-view-";
const tab_view_prefix_Datasets = "tab-view-Datasets-";

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
 * .showConfigureLookup default: false
 * .showSampleFilters default : false

 * .filterBySelectedSamples default : true
 * .mafUpper default : true
 * .mafThreshold default 0
 * .callRateThreshold default 0
 * .samplesLimit default 10
 * .samplesLimitEnable default false
 * .selectFeaturesByLDBlock default false
 * .haplotypeFilterRef default : false
 * .showNonVCFFeatureNames default : true
 * .showAxisLDBlocks default : false
 * .showTablePositionAlignment default : false
 * .cellSizeFactorInt default : 100
 * .cellSizeFactor default : 1
 *
 * .haplotypeFiltersEnable default : false
 * true means apply haplotypeFilters to filter out non-matchng sample columns;
 * otherwise show the non-Ref Samples at the right of the matching samples - use
 * .sort(sampleNamesCmp), instead of sampleIsFilteredOut().
 *
 * The user can choose how to determine the samples to request from bcftools.
 * .requestSamplesAll boolean, default : false
 *   All samples in VCF, or selected by user from list.
 * .requestSamplesFiltered boolean, default : false
 *   The samples indicated by requestSamplesAll can be optionally filtered before request.
 *
 * @see userSettingsDefaults()
 */
export default class PanelManageGenotypeComponent extends Component {
  @service() controls;
  @service() auth;
  /** used for axisBrush.brushedAxes to instantiate axis-brush s. */
  @service('data/flows-collate') flowsService;
  @service('data/block') blockService;
  @service('data/vcf-genotype') sampleCache;
  @service('data/haplotype') haplotypeService;
  @service('query-params') queryParamsService;


  @alias('controls.apiServerSelectedOrPrimary') apiServerSelectedOrPrimary;

  @alias('queryParamsService.urlOptions') urlOptions;

  @alias('haplotypeService.haplotypeColourScale') haplotypeColourScale;


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

  /** see selectedSamples() */
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

  /** Genotype (VCF) datasets are allocated 1 column each, showing Block colour, and
   * containing the feature name as cell title.
   */
  @tracked
  gtDatasetColumns = null;

  /** Non-VCF datasets are allocated 1 column each, displaying the feature name
   * when enabled by showNonVCFFeatureNames.
   */
  @tracked
  datasetColumns = null;

  /** Extra fields of non-VCF datasets may be shown, displaying the Feature.values[fieldName].
   * These are currently allocated 1 column per fieldName, but perhaps will
   * change to 1 per dataset x fieldName.
   */
  @tracked
  extraDatasetColumns = null;

  /** in .args.userSettings : */
  /** true means replace the previous result Features added to the block. */
  // replaceResults = undefined;

  @tracked
  axisBrushBlockIndex = undefined;

  // @tracked
  @alias('args.userSettings.hideControls') 
  showInputDialog;

  @alias('args.userSettings.showResultText')
  showResultText;

  /** Warning message from failure of vcfGenotypeLookup or vcfGenotypeSamples API */
  @tracked
  lookupMessage = null;

  /** Enable dialog to select fields of non-VCF dataset features to display as
   * additional columns.  */
  @tracked
  featureColumnDialogDataset = false;

  /** Enable dialog to toggle VCF dataset intersection none/+/-.  */
  @tracked
  intersectionDialogDataset = false;
  get intersectionDialogDatasetId() { return this.intersectionDialogDataset?.id; }
  set intersectionDialogDatasetId(datasetId) {
    const dataset = this.gtDatasets.find(dataset => dataset.id === datasetId);
    this.intersectionDialogDataset = dataset;
    dLog('intersectionDialogDatasetId', datasetId, dataset);
  }

  /** selectedFeaturesValuesFields[datasetId] is selected from
   * .currentFeaturesValuesFields[datasetId],
   * where datasetId is a non-VCF dataset. */
  @tracked
  selectedFeaturesValuesFields = {};

  /** dataClipboard() can be re-factored into manage-genotype, but that may pull
   * out half of matrix-view - perhaps wait until changing table component, so
   * use this action bundle to prototype and refine the requirements.
   */
  tableApi = { dataClipboard : null};

  //----------------------------------------------------------------------------

  // @action  // called via (action to pass target.value)
  nameFilterChanged(value) {
    this.namesFilters.nameFilterChanged(value);
  }

  // ---------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    this.userSettingsDefaults();
    /* if (trace) { */
      dLog('manage-genotype', 'constructor', 'this', this, 'args', Object.entries(this.args));
    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.manageGenotype = this;
    }

    this.namesFilters = new NamesFilters();
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
    if (userSettings.showConfigureLookup === undefined) {
      userSettings.showConfigureLookup = true;
    }
    if (userSettings.showSampleFilters === undefined) {
      userSettings.showSampleFilters = false;
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
    if (userSettings.callRateThreshold === undefined) {
      userSettings.callRateThreshold = 0;
    }

    if (userSettings.samplesLimit === undefined) {
      userSettings.samplesLimit = 10;
    }
    if (userSettings.samplesLimitEnable === undefined) {
      userSettings.samplesLimitEnable = false;
    }

    if (userSettings.selectFeaturesByLDBlock === undefined) {
      userSettings.selectFeaturesByLDBlock = false;
    }
    if (userSettings.haplotypeFilterRef === undefined) {
      userSettings.haplotypeFilterRef = false;
    }
    if (userSettings.haplotypeFiltersEnable === undefined) {
      userSettings.haplotypeFiltersEnable = false;
    }

    if (userSettings.requestSamplesAll === undefined) {
      userSettings.requestSamplesAll = false;
    }

    if (userSettings.requestSamplesFiltered === undefined) {
      userSettings.requestSamplesFiltered = false;
    }

    if (userSettings.showNonVCFFeatureNames === undefined) {
      userSettings.showNonVCFFeatureNames = false;
    }

    if (userSettings.showAxisLDBlocks === undefined) {
      userSettings.showAxisLDBlocks = false;
    }

    if (userSettings.showTablePositionAlignment === undefined) {
      userSettings.showTablePositionAlignment = false;
    }

    if (userSettings.autoLookup === undefined) {
      userSettings.autoLookup = true;
    }

    if (userSettings.cellSizeFactor === undefined) {
      userSettings.cellSizeFactorInt = 100;
      userSettings.cellSizeFactor = 1;
    }


    if (this.urlOptions.gtMergeRows === undefined) {
      this.urlOptions.gtMergeRows = true;
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

    later(() => {
      this.selectedSamplesText = this.selectedSamples?.join('\n');
    });
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

  /** Adjust table cell size.
   * This initial default value is coordinated with hbs : <input ... value=100 ... cellSizeFactorInput >
   * Factor domain is (0, 2], default 1.
   * <input> range is [0, 200]; divide value by /100, i.e. value is %
   * userSettings.cellSizeFactor{Int,} initialised in userSettingsDefaults().
   */

  @action
  cellSizeFactorInput(event) {
    this.args.userSettings.cellSizeFactorInt = +event.target.value;
    /** default is 100% : value=100 in hbs
     * event.target.value is a string; convert to a number.
     * Exclude 0, map it to 0.01.
     */
    let value = (+event.target.value || 1) / 100;
    dLog('cellSizeFactorInput', value, event.target.value);
    /* cellSizeFactor is tracked by matrix-view.js : cellSize() */
    Ember_set(this, 'args.userSettings.cellSizeFactor', value);
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

  /**
   * @param inputType "text" or "range"
   */
  @action
  callRateThresholdChanged(value, inputType) {
    /* if (trace) { */
    dLog('callRateThresholdChanged', value, inputType);
    Ember_set(this, 'args.userSettings.callRateThreshold', value);
  }

  //----------------------------------------------------------------------------

  /**
   * @param inputType "text" or "range"
   */
  @action
  samplesLimitChanged(value, inputType) {
    /* if (trace) { */
    dLog('samplesLimitChanged', value, inputType);
    Ember_set(this, 'args.userSettings.samplesLimit', Math.round(value));
  }

  //----------------------------------------------------------------------------

  /** User may select tSNP values which are then used to filter samples,
   * in combination with a flag which selects match with Ref or non-Ref values :
   * columns of samples with the expected value are displayed.
   * @return [] of tSNP
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
    fnName = 'haplotypeToggle',
    block = feature.get('blockId'),
    filters = this.blockHaplotypeFilters(block);
    this.arrayToggleObject(filters, haplotype);

    /** filtered/sorted display depends on .samples, which depends on
     * this.vcfGenotypeSamplesText, so request all sampleNames if not received.
     */
    let textP = ! this.vcfGenotypeSamplesText && this.vcfGenotypeSamples();
    thenOrNow(textP, () => {
      if (textP) {
        dLog(fnName);
      }
      // Refresh display.
      this.haplotypeFiltersSet();
    });
  }
  /** If object is in array, remove it, otherwise add it.
   * @param object  any value - string or object, etc
   */
  arrayToggleObject(array, object) {
    const present = array.includes(object);
    if (present) {
      /* currently getting multiple calls to afterSelectionHaplotype(), so disable toggle off
      */
      array.removeObject(object);
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
    let filterCount = 0;
    const
    abBlocks = this.blocksHaplotypeFilters;
    abBlocks.forEach((abBlock) => {
      const
      block = abBlock.block;
      Ember_set(abBlock, 'haplotypeFilters', abBlock.haplotypeFilters);
      filterCount += abBlock.haplotypeFilters.length;
    });
    this.haplotypeFiltersCount = filterCount;
  }
  @tracked
  haplotypeFiltersCount = 0;

  /** Map haplotype / tSNP to a colour
   * @param tSNP  string represention of a number
   */
  @action
  haplotypeColour(tSNP) {
    const colour = this.haplotypeColourScale(tSNP);
    return colour;
  }

  //----------------------------------------------------------------------------
  /** copied, with haplotype -> feature : blockHaplotypeFilters(),
   * haplotypeToggle(), haplotypeFiltersClear(), haplotypeFiltersApply(),
   * haplotypeFiltersSet().
   * The requirements are in prototype phase; after settling possibly there
   * will be enough commonality to factor some of this.
   * The filter may be an array of features or positions; currently features and
   * they are stored as block[featureFiltersSymbol] (copying the use of
   * block[haplotypeFiltersSymbol]), but if they are positions then they don't
   * need to be per-block - can be per axis-brush.
   */

  /** User may select tSNP values which are then used to filter samples,
   * in combination with a flag which selects match with Ref or non-Ref values :
   * columns of samples with the expected value are displayed.
   * @return [] of tSNP
   */
  @action
  blockFeatureFilters(block) {
    // equivalent : block = contentOf(block);
    if (block.content) {
      block = block.content;
    }
    const filters = block[featureFiltersSymbol] || (block[featureFiltersSymbol] = Ember_A());
    return filters;
  }

  @action
  featureToggle(feature, columnName) {
    const
    fnName = 'featureToggle',
    /** probably want to apply filter at SNP position to other VCF blocks in the
     * table (abBlocks = this.brushedOrViewedVCFBlocks); match features in those
     * blocks with the same feature.value.0
     */
    block = feature.get('blockId'),
    filters = this.blockFeatureFilters(block);
    this.arrayToggleObject(filters, feature);

    /** filtered/sorted display depends on .samples, which depends on
     * this.vcfGenotypeSamplesText, so request all sampleNames if not received.
     */
    let textP = ! this.vcfGenotypeSamplesText && this.vcfGenotypeSamples();
    thenOrNow(textP, () => {
      if (textP) {
        dLog(fnName);
      }
      // Refresh display.
      this.featureFiltersSet();
    });
  }

  @action
  featureFiltersClear() {
    const fnName = 'featureFiltersClear';
    dLog(fnName);
    const
    abBlocks = this.brushedOrViewedVCFBlocks;
    abBlocks.forEach((abBlock) => {
      const
      block = abBlock.block,
      selected = block[featureFiltersSymbol];
      if (abBlock.featureFilters !== selected) {
        dLog(fnName, abBlock, abBlock.featureFilters, selected);
      }
      if (selected.length) {
        selected.removeAt(0, selected.length);
      }
    });
    // Refresh display.
    this.featureFiltersSet();
    // also done in hbs via action pipe
    // this.haplotypeFiltersApply();
  }

  /* haplotypeFiltersApply() -> filterSamplesBySelectedHaplotypes()
   * also applies featureFilters, so there is no need for a separate
   * @action featureFiltersApply() 
   */
 

  /** Use Ember_set() to signal update of tracked properties and trigger re-render. */
  featureFiltersSet() {
    dLog('featureFiltersSet');
    let filterCount = 0;
    const
    abBlocks = this.blocksFeatureFilters;
    abBlocks.forEach((abBlock) => {
      const
      block = abBlock.block;
      Ember_set(abBlock, 'featureFilters', abBlock.featureFilters);
      filterCount += abBlock.featureFilters.length;
    });
    this.featureFiltersCount = filterCount;
  }
  @tracked
  featureFiltersCount = 0;

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

  /**
   * @param value radio button can only provide a string value
   */
  @action
  positionFilterChanged(valueText) {
    const fnName = 'positionFilterChanged';
    dLog(fnName, valueText);
    let value = valueText;
    if (typeof value === 'string') {
      // the radio button values are lower case.
      value = JSON.parse(valueText.toLowerCase());
      dLog(fnName, value);
    }
    const dataset = this.intersectionDialogDataset;
    if (! dataset) {
      dLog(fnName, this.lookupDatasetId);
      // const lookupDataset = this.lookupBlock.get('datasetId');
    } else {
      dataset.set('positionFilter', value);
      this.datasetPositionFilterChangeCount++;
      /** This works except it is incremental - prepending continuously;
       * using instead : positionFilterEffect() -> updateSettings().
       * this.showDatasetPositionFilter(dataset, dataset.positionFilterText);
       */
    }
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
  /** @return array of blocks and the features selected on them for filtering samples.
   */
  @computed('brushedOrViewedVCFBlocks')
  get blocksFeatureFilters() {
    /** copied from blocksHaplotypeFilters(), with haplotype -> feature
     */
    const
    fnName = 'blocksFeatureFilters',
    axisBrushes = this.brushedOrViewedVCFBlocks,
    blocksHF = axisBrushes.map(
      (ab) => ({block : ab.block, featureFilters : this.blockFeatureFilters(ab.block)}));
    dLog(fnName, axisBrushes, blocksHF);
    return blocksHF;
  }

  @computed('brushedOrViewedVCFBlocks')
  get brushedOrViewedScope () {
    const fnName = 'brushedOrViewedScope';
    const scope = this.lookupScope || this.brushedOrViewedVCFBlocks.mapBy('scope').uniq();
    dLog(fnName, scope);
    return scope;
  }

  @computed('brushedOrViewedVCFBlocks')
  get brushedOrViewedVCFBlocksVisible () {
    const
    fnName = 'brushedOrViewedVCFBlocks',
    blocks = this.brushedOrViewedVCFBlocks
      .map(abb => abb.block),
    visibleBlocks = blocks
      .filterBy('visible');
    dLog(fnName, visibleBlocks, blocks);
    return visibleBlocks;
  }

  @alias('brushedOrViewedVCFBlocksVisible') gtBlocks;

  /** genotype datasets on the brushed / viewed axes
   */
  @computed('brushedOrViewedVCFBlocks')
  get gtDatasets () {
    const
    fnName = 'gtDatasets',
    /** brushedOrViewedVCFBlocksVisible.mapBy('datasetId') are Proxy,
     * which is true of both its sources : .viewedVCFBlocks and .brushedVCFBlocks.
     * so use .content
     */
    gtDatasets = this.brushedOrViewedVCFBlocksVisible.mapBy('datasetId.content');
    dLog(fnName, gtDatasets);
    return gtDatasets;
  }

  @computed('gtDatasets')
  get gtDatasetIds() {
    const
    fnName = 'gtDatasetIds',
    datasetIds = this.gtDatasets.mapBy('id');
    dLog(fnName, datasetIds);
    return datasetIds;
  }

  @computed('gtDatasets')
  get gtDatasetTabs() {
    const
    fnName = 'gtDatasets',
    datasetIds = this.gtDatasetIds;
    if (! this.activeDatasetId && datasetIds.length) {
      dLog(fnName, 'initial activeDatasetId', datasetIds[0], this.activeDatasetId);
      later(() => {
        this.setSelectedDataset(datasetIds[0]);
      });
    }
    dLog(fnName, datasetIds, this.gtDatasets);
    return datasetIds;
  }

  /** identify the reference datasetId and scope of the axis of the genotype
   * datasets which are displayed in the table.
   * There could be multiple such axes; the components handle that but it may not be used.
   * This is displayed in the top-left corner of the table.
   */
  @computed('brushedOrViewedScope', 'gtDatasets')
  get dataScope () {
    const
    fnName = 'dataScope',
    scope = this.brushedOrViewedScope,
    gtDatasetIds = this.gtDatasetIds,
    /** The top-left corner cell is not rotated - text is horizontal.
     * When gtMergeRows, the left column (row header) is narrow because it holds
     * Position instead of feature name, so there is no width for the
     * datasetIds; they seem unnecessary because the "Block" columns headers
     * have the datasetIds - possibly added after gtDatasetIds were appended to
     * scope here.  So disable this :
    texts = (scope ? [scope] : []).concat(gtDatasetIds),
    text = texts.join('\n');
    */
    text = scope;

    /* gtMergeRows : rowHeader is Position, which is narrower than name, and
     * datasetId gets truncated and moves the centre (where scope is
     * positioned) out of view, so omit it.
     if (gtDatasetIds?.length && ! this.urlOptions.gtMergeRows)
    */
    dLog(fnName, scope, gtDatasetIds, text);

    return text;
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

  /** @return sample names in .vcfGenotypeSamplesText
   */
  @computed('vcfGenotypeSamplesText')
  get samples() {
    const
    samples = this.vcfGenotypeSamplesText?.split('\n')
    ;//.map((name) => ({name, selected : false}));
    // text ends with \n, which creates '' at the end of the array, so pop that.
    if ((samples?.length && (samples[samples.length-1]) === '')) {
      dLog('samples', samples.length && samples.slice(samples.length-2, samples.length));
      samples.pop();
    }
 
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
    const
    previousSelected = this.selectedSamples,
    selectedSamples = $(event.target).val();
    this.selectedSamples.addObjects(selectedSamples);
    if (selectedSamples.length) {
      this.selectedSamplesText = previousSelected.addObjects(selectedSamples).join('\n');
    }
  }

  /**
   * @return undefined if .samples is undefined
   */
  @computed('samples', 'namesFilters.nameFilterArray')
  get filteredSamples() {
    const
    fnName = 'filteredSamples',
    nameFilterArray = this.namesFilters.nameFilterArray,
    filteredSamples = this.samples
      ?.filter(sampleName => this.namesFilters.matchFilters(
        sampleName, nameFilterArray,
        /*this.caseInsensitive*/ true,
        /*this.searchFilterAll*/ true));
    return filteredSamples;
  }

  // copied from feature-list, not used.
  @tracked
  activeInput = false;
  /* related user actions :
   *  change filter : doesn't change selectedSamples{,Text}
   *  user select -> append to selectedSamples ( -> selectedSamplesText)
   *  paste -> (selectedSamplesText and) selectedSamples
   */
  @tracked
  selectedSamplesText = '';

  /** parse the contents of the textarea -> selectedSamples
   */
  @action
  sampleNameListInput(value) {
    const
    fnName = 'sampleNameListInput',
    /** empty lines are invalid sample names, so trim \n and white-space lines */
    selected = value
      .trimEnd(/\n/)
      .split(/\n *\t*/g)
      .filter((name) => !!name);
    dLog(fnName, value, selected);
    this.selectedSamples = selected;
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
      vcfBlocks = ! axis1d ? [] : axis1d.brushedBlocks
        .filter(
          (b) => b.get('isVCF')),
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
        /** .axisBrushBlockIndex maybe -1, when data block is un-viewed while brushed. */
        dLog(fnName, this.axisBrushBlockIndex, blocks[this.axisBrushBlockIndex]?.block.id, blocks, lookupBlock.id);
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
      (b) => b.get('isVCF')),
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

  //----------------------------------------------------------------------------

  /** @return a mapping from datasets -> block colour
   * @desc
   * Also set .brushedOrViewedVCFDatasets : array of datasets of brushedOrViewedVCFBlocks.
   */
  @computed('brushedOrViewedVCFBlocks')
  get datasetsColour() {
    /** related : axis-1d.js : datasetsColour() */
    const
    fnName = 'datasetsColour',
    /** [{axisBrush, vcfBlock}, ...], refn : brushedVCFBlocks() */
    abBlocks = this.brushedOrViewedVCFBlocks,
    datasetsSet = new Set(),
    blockColourMap = abBlocks.reduce((map, abBlock) => {
      const
      block = abBlock.block,
      dataset = block.get('datasetId.content'),
      axis1d = block.get('axis1d'),
      colour = axis1d.blockColourValue(block);
      datasetsSet.add(dataset);
      map.set(dataset, colour);
      return map;
    }, new Map()),
    datasets = Array.from(datasetsSet.keys());
    dLog(fnName, blockColourMap, abBlocks, datasets);
    Ember_set(this, 'brushedOrViewedVCFDatasets', datasets);
    return blockColourMap;
  }

  /** @return the CSS class names for the datasets which are displayed in the table.
   */
  @computed('brushedOrViewedVCFDatasets', 'gtDatasetColumns')
  get datasetsClasses() {
    const
    fnName = 'datasetsClasses',
    datasetsColour = this.datasetsColour,
    /** to remove duplicates, use .addObjects() instead of .concat(). */
    datasets =
      this.brushedOrViewedVCFDatasets
      .addObjects(this.gtDatasets),
    classes = datasets.map(dataset => ({
      id : datasetId2Class(dataset.get('id')),
      colour : datasetsColour.get(dataset)
    }));
    dLog(fnName, classes);
    return classes;
  }

  //----------------------------------------------------------------------------

  /** To enable non-VCF features to be displayed in the table,
   * determine the non-VCF data blocks which are on the axes displayed in the table.
   * @return axis1d []
   */
  @computed('brushedVCFBlocks')
  /* brushedVCFBlocks depends on .brushedAxes, so will update when brush is
   * started / ended, but not changed */
  get brushedOrViewedVCFAxes() {
    const
    vcfBlocks = this.brushedVCFBlocks.map((abb) => abb.block),
    axes = vcfBlocks.mapBy('axis1d').uniq();
    return axes;
  }
  @computed('brushedOrViewedVCFAxes', 'brushedOrViewedVCFAxes.0.zoomCounter')
  get nonVCFFeaturesWithinBrush() {
    const
    axes = this.brushedOrViewedVCFAxes,
    axesBlocksFeatures = axes.map((axis1d) => {
      const
      blocksFeatures = axis1d.zoomedAndOrBrushedFeatures(/*includeVCF*/false);
      return [axis1d, blocksFeatures];
    });
    return axesBlocksFeatures;
  }
  /** Map nonVCFFeaturesWithinBrush to a feature proxy with just
   * { Block : feature.blockId, [datasetId.id] : feature.name, Position }
   * @return {columnNames [], features [] }
   * columnNames[] contains the .blockId.datasetId.id of filtered features.
   */
  @computed('nonVCFFeaturesWithinBrush')
  get nonVCFFeaturesWithinBrushData() {
    const
    result = {columnNames : [], features : [] },
    axesBlocksFeatures = this.nonVCFFeaturesWithinBrush;
    axesBlocksFeatures.forEach(([axis1d, blocksFeatures]) => {
      blocksFeatures.forEach(([block, blockFeatures]) => {
        const
        datasetId = block.get('datasetId.id');
        result.features = result.features.concat(blockFeatures);
        if (blockFeatures.length) {
          result.columnNames.push(datasetId);
        }
      });
    });
    return result;
  }

  //----------------------------------------------------------------------------

  @computed('selectedFeaturesValuesFields', 'featureColumnDialogDataset')
  get selectedFeaturesValuesFieldsForDataset() {
    let selected;
    const datasetId = this.featureColumnDialogDataset;
    if (datasetId) {
      selected = this.selectedFeaturesValuesFields[datasetId] ||
        (this.selectedFeaturesValuesFields[datasetId] = []);
    }
    return selected;
  }

  /** @return
   * .currentFeaturesValuesFields[featureColumnDialogDataset] minus
   * .selectedFeaturesValuesFields[featureColumnDialogDataset]
   */
  @computed('currentFeaturesValuesFields', 'selectedFeaturesValuesFieldsForDataset.[]')
  get forSelectFeaturesValuesFields() {
    const
    fnName = 'forSelectFeaturesValuesFields',
    datasetId = this.featureColumnDialogDataset,
    current = this.currentFeaturesValuesFields[datasetId],
    selected = this.selectedFeaturesValuesFields[datasetId],
    /** Copy current and subtract selected from it, remainder is available for selection */
    unselected = selected.reduce((set, field) => {
      set.delete(field);
      return set;
    }, new Set(current)),
    unselectedArray = Array.from(unselected);
    return unselectedArray;
  }  

  /** Map the multi-select to an array of selected sample names.
   * Based on @see selectSample().
   * @desc
   */
  @action
  selectFieldName(event) {
    const
    selectedFieldNames = $(event.target).val(),
    datasetId = this.featureColumnDialogDataset;
    this.selectedFeaturesValuesFields[datasetId] = selectedFieldNames || [];
  }

  // ---------------------------------------------------------------------------

  /** dataset parent name of the selected block for lookup.
   * related : mapview : selectedDataset is the reference (parent) of the selected axis.
   */
  @alias('lookupBlock.datasetId.parentName') referenceDatasetName;

  // ---------------------------------------------------------------------------

  /** .brushedDomain is not rounded, but could be because base positions are integral.
   * This result is rounded.
   */
  @computed('axisBrush.brushedDomain')
  get brushedDomainLength () {
    let domain = this.axisBrush?.brushedDomain;
    if (domain) {
      domain = Math.abs(domain[1] - domain[0]).toFixed();
    }
    return domain;
  }

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
   * @return undefined if scope or vcfDatasetId are not defined,
   * or a promise yielding received text
   */
  vcfGenotypeSamples() {
    /** implemented by common/models/block.js : Block.vcfGenotypeSamples().  */
    const
    fnName = 'vcfGenotypeSamples',
    scope = this.lookupScope,
    vcfDatasetId = this.lookupDatasetId;
    let textP;
    if (scope && vcfDatasetId)
    {
      this.lookupMessage = null;

      textP = this.auth.genotypeSamples(
        this.apiServerSelectedOrPrimary, this.lookupBlock, vcfDatasetId, scope,
        {} );
      textP.then(
        (text) => {
          const t = text?.text;
          dLog(fnName, t?.length || Object.keys(text), t?.slice(0, 60));
          const isGerminate = resultIsGerminate(t);
          this.sampleCache.sampleNames[vcfDatasetId] = isGerminate ? t.join('\n') : t;
          /* result from Germinate is currently an array of string sample names. */
          /** trim off trailing newline; other non-sample column info could be
           * removed; it is not a concern for the mapping. */
          const sampleNames = isGerminate ? t : t.trim().split('\n');
          this.mapSamplesToBlock(sampleNames, this.lookupBlock);
          if ((vcfDatasetId === this.lookupDatasetId) &&
              (this.vcfGenotypeSamplesSelected === undefined)) {
            this.vcfGenotypeSamplesSelected = [];
          }
          this.receivedNamesCount++;
        })
        .catch(this.showError.bind(this, fnName));
    }
    return textP;
  }

  //----------------------------------------------------------------------------

  /** When user clicks All & Filtered, action ensureSamples() is used to request
   * All sample names so that .samples is available for samplesOK() to filter.
   */
  @action
  ensureSamples() {
    const
    userSettings = this.args.userSettings,
    requestSamplesAll = userSettings.requestSamplesAll,
    requestSamplesFiltered = userSettings.requestSamplesFiltered,
    samplesLimitEnable = userSettings.samplesLimitEnable;

    if (requestSamplesAll && (requestSamplesFiltered || samplesLimitEnable) &&
        ! this.vcfGenotypeSamplesText) {
      dLog('ensureSamples');
      this.vcfGenotypeSamples();
    }
  }

  /** When a dataset tab in the control dialog is displayed, request samples for
   * the dataset if not already done.  
   */
  @computed('lookupDatasetId')
  get ensureSamplesForDatasetTabEffect() {
    const fnName = 'ensureSamplesForDatasetTabEffect';
    /** Originally vcfGenotypeSamples() was manually triggered by user click;
     * this function is added to improve the ergonomics of the user workflow,
     * i.e. in the dataset tab the user will often want to select from the
     * available samples, so pre-emptively request the samples to reduce button
     * clicks.
     * related : .ensureSamples();
     */
    if (! this.vcfGenotypeSamplesText) {
      dLog(fnName);
      this.vcfGenotypeSamples();
    }

  }

  //----------------------------------------------------------------------------

  /** block[sampleNamesSymbol] is a map from sampleName to block */
  sampleName2Block = {}
  /** Record a mapping from sampleNames to the block which they are within.
   * @param sampleNames []
   * @param block the lookupBlock use in API request which returned the sampleNames
   */
  mapSamplesToBlock(sampleNames, block) {
    sampleNames.forEach((sampleName) => this.sampleName2Block[sampleName] = block);
  }

  // ---------------------------------------------------------------------------

  showError(fnName, error) {
    let
    message = error.responseJSON?.error?.message ?? error;
    dLog(fnName, message, error.status, error.statusText);
    if (message?.split) {
    const match = message?.split('Error: Unable to run bcftools');
    if (match.length > 1) {
      message = match[0];
    }
    }
    this.lookupMessage = message;
  }


  // ---------------------------------------------------------------------------

  /** Determine sample names to request genotype for.
   * if ! .requestSamplesAll, use selected samples.
   * Filter if .requestSamplesFiltered.
   * @param limitSamples if true, apply this.samplesLimit.  Equal to
   * .samplesLimitEnable except when requesting headers - headerTextP().
   * @param datasetId if defined, then return the samples for this dataset,
   * otherwise for the selected dataset : this.lookupDatasetId
   * @return {samples, samplesOK}, where samplesOK is true if All or samples.length
   */
  samplesOK(limitSamples, datasetId) {
    let samplesRaw, samples;
    const
    userSettings = this.args.userSettings,
    requestSamplesAll = userSettings.requestSamplesAll,
    requestSamplesFiltered = userSettings.requestSamplesFiltered,
    samplesLimit = userSettings.samplesLimit;
    let ok = requestSamplesAll && ! requestSamplesFiltered && ! limitSamples;
    if (! ok) {
      if (requestSamplesAll) {
        if (datasetId) {
          // All sample names received for datasetId.
          // As in vcfGenotypeSamples(). related : lookupBlockSamples(), vcfGenotypeSamplesText().
          samplesRaw = this.sampleCache.sampleNames[datasetId]
            ?.trim().split('\n');
          ok &&= ! samplesRaw;
        } else {
        // All sample names received for lookupDatasetId.
        samplesRaw = this.samples;
        }
      } else {
        if (datasetId) {
          // as in lookupBlockSamples() and blocksSelectedSamples()
          samplesRaw = this.vcfGenotypeSamplesSelectedAll[datasetId] || [];
        } else {
        samplesRaw = this.vcfGenotypeSamplesSelected || [];
        }
      }
    }
    if (requestSamplesFiltered) {
      samplesRaw = samplesRaw
        .filter(
          (sampleName) =>
            (! userSettings.haplotypeFiltersEnable || ! sampleIsFilteredOut(this.lookupBlock, sampleName)) &&
            (! this.sampleFilter || this.sampleFilter(this.lookupBlock, sampleName)) );
    }

    if (limitSamples && (samplesRaw?.length > samplesLimit)) {
      samplesRaw = samplesRaw.slice(0, samplesLimit);
    }

    /* Handle samplesLimit===0; that may not have a use since the features are
     * already requested without samples. */
    ok ||= (samplesRaw?.length || (limitSamples && !samplesLimit));
    /** result is 1 string of names, separated by 1 newline.  */
    samples = samplesRaw?.join('\n');

    return {samples, samplesOK : ok};
  }

  /** Lookup the genotype for the selected samples in the interval of, depending on autoLookup : 
   * . all visible brushed VCF blocks, or 
   * . the brushed block selected by the currently viewed Datasets tab.
   */
  vcfGenotypeLookup() {
    const
    fnName = 'vcfGenotypeLookup';
    if (this.args.userSettings.autoLookup) {
      this.vcfGenotypeLookupAllDatasets();
    } else {
      this.vcfGenotypeLookupSelected();
    }
  }

  //----------------------------------------------------------------------------

  /** Lookup the genotype for the selected samples in the interval of the brushed block,
   * selected by the currently viewed Datasets tab.
   */
  vcfGenotypeLookupSelected() {
    const
    fnName = 'vcfGenotypeLookupSelected',
    /** this.axisBrush.block is currently the reference; lookup the data block. */
    // store = this.axisBrush?.get('block.store'),
    store = this.apiServerSelectedOrPrimary?.store,
    userSettings = this.args.userSettings,
    samplesLimitEnable = userSettings.samplesLimitEnable,
    {samples, samplesOK} = this.samplesOK(samplesLimitEnable),
    domainInteger = this.vcfGenotypeLookupDomain,
    vcfDatasetId = this.lookupDatasetId;
    /* Possibly filter out .lookupBlock if .datasetId positionFilter === false,
     * as is done in vcfGenotypeLookupAllDatasets().
     */
    if (samplesOK && domainInteger && vcfDatasetId) { // && scope
      this.lookupMessage = null;
      let
      scope = this.lookupScope;
      /** .lookupDatasetId is derived from .lookupBlock so .lookupBlock must be defined here. */
      let blockV = this.lookupBlock;

      this.vcfGenotypeLookupDataset(blockV, vcfDatasetId, scope, domainInteger, samples, samplesLimitEnable);
    }
  }
  /** Request VCF genotype for brushed datasets which are visible
   */
  vcfGenotypeLookupAllDatasets() {
    // related : notes in showSamplesWithinBrush() re. isZoomedOut(), .rowLimit.
    const
    visibleBlocks = this.brushedOrViewedVCFBlocksVisible;
    visibleBlocks
    /** filter out blocks which are `minus` in the positionFilter - if requested
     * the result should be empty.
     * See table in vcfGenotypeLookupDataset().
     */
      .filter(block => {
        const dataset = block.get('datasetId.content');
        return dataset.positionFilter !== false;
      })
      .forEach((blockV, i) => {
      const
      vcfDatasetId = blockV.get('datasetId.id'),
      /** use .name instead of .scope, because some VCF files use 'chr' prefix
       * on chromosome name e.g. chr1A, and .name reflects that;
       * as in lookupScope().
       */
      scope = blockV.name,
      userSettings = this.args.userSettings,
      samplesLimitEnable = userSettings.samplesLimitEnable,
      {samples, samplesOK} = this.samplesOK(samplesLimitEnable, vcfDatasetId),
      domainInteger = this.vcfGenotypeLookupDomain;
      /* samplesOK() returns .samples '' if none are selected; passing
       * vcfGenotypeLookupDataset( samples==='' ) will get all samples, which
       * may be valid, but for now skip this dataset if ! .length.
       */
      if (this.args.userSettings.requestSamplesAll || samples.length) {
        this.vcfGenotypeLookupDataset(blockV, vcfDatasetId, scope, domainInteger, samples, samplesLimitEnable);
      }
    });
  }
  /** Send API request for VCF genotype of the given vcfDatasetId.
   * @param blockV
   * @param vcfDatasetId one of the VCF genotype datasets on the brushed axis
   * @param scope of the brushed axis
   * @param domainInteger brushed domain on the axis / parent
   * @param samples selected samples to request
   * @param samplesLimitEnable  .args.userSettings.samplesLimitEnable
   */
  vcfGenotypeLookupDataset(blockV, vcfDatasetId, scope, domainInteger, samples, samplesLimitEnable) {
    const fnName = 'vcfGenotypeLookupDataset';
    if (scope) {
      const
      userSettings = this.args.userSettings,
      requestFormat = this.requestFormat,
      requestSamplesFiltered = userSettings.requestSamplesFiltered,
      /** If filtered or column-limited, then samples is a subset of All. */
      requestSamplesAll = userSettings.requestSamplesAll && ! requestSamplesFiltered && ! samplesLimitEnable,
      requestOptions = {requestFormat, requestSamplesAll},
      /** Datasets selected for intersection.
       * Used to indicate if any positionFilter are defined and hence isecFlags
       * and isecDatasets will be set.  If no datasets other than this one
       * (vcfDatasetId) have positionFilter, then isec is not required.
       */
      isecDatasetsNotSelf = this.gtDatasets
          .filter(dataset =>
            ('boolean' === typeof dataset.positionFilter) &&
              (dataset.id !== vcfDatasetId));
      if (isecDatasetsNotSelf.length) {
        const
        /** filter out null and undefined; include vcfDatasetId i.e. the dataset
         * which is being requested.
         * 
         * table value indicates if dataset should be included in isecDatasets.
         * |------------------------+-------------------------------+-------|
         * |                        | (dataset.id === vcfDatasetId) |       |
         * | dataset.positionFilter | true                          | false |
         * |------------------------+-------------------------------+-------|
         * | undefined              | true                          | false |
         * | true                   | true                          | true  |
         * | false                  | (true) N/A                    | true  |
         * |------------------------+-------------------------------+-------|
         *
         * N/A : this case is filtered out in vcfGenotypeLookupAllDatasets().
         */
        isecDatasets = this.gtDatasets
          .filter(dataset =>
            ('boolean' === typeof dataset.positionFilter) ||
              (dataset.id === vcfDatasetId)),
        isecDatasetIds = isecDatasets
          .mapBy('id'),
        /** in isecDatasets[] dataset positionFilter is only nullish at this
         * point if dataset.id is vcfDatasetId - use flag true in that case. */
        flags = isecDatasets.map(dataset => dataset.positionFilter ?? true),
        allTrue = flags.findIndex(flag => !flag) === -1,
        isecFlags = allTrue ? isecDatasetIds.length :
          '~' + flags.map(flag => flag ? '1' : '0').join('');
        requestOptions.isecDatasetIds = isecDatasetIds;
        requestOptions.isecFlags = '-n' + isecFlags;
      }
      const
      textP = vcfGenotypeLookup(this.auth, this.apiServerSelectedOrPrimary, samples, domainInteger,  requestOptions, vcfDatasetId, scope, this.rowLimit);
      // re-initialise file-anchor with the new @data
      this.vcfExportText = null;
      textP.then(
        (text) => {
          const
          isGerminate = resultIsGerminate(text),
          callsData = isGerminate && text;
          if (isGerminate) {
            text = callsData.map(snp => Object.entries(snp).join('\t')).join('\n');
            dLog(fnName, text.length, callsData.length);
          }
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

          dLog(fnName, text.length, text && text.slice(0,200), blockV.get('id'));
          if (text && blockV) {
            const
            replaceResults = this.args.userSettings.replaceResults,
            selectedFeatures = this.args.selectedFeatures,
            added = isGerminate ?
              addFeaturesGerminate(blockV, requestFormat, replaceResults, selectedFeatures, callsData) :
              addFeaturesJson(blockV, requestFormat, replaceResults, selectedFeatures, text);

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
                (this.requestFormat, added, this.featureFilter.bind(this), this.sampleFilter,
                 this.sampleNamesCmp, /*options*/ {userSettings});
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

  @tracked
  datasetPositionFilterChangeCount = 0;
  @action
  changeDatasetPositionFilter(dataset, pf) {
    this.datasetPositionFilterChangeCount++;
  }
  showDatasetPositionFilter(dataset, positionFilterText) {
    const
    datasetId = dataset.get('id'),
    // positionFilterText = datasetId.positionFilterText,
    // th.ht__highlight - class is ephemeral.
    // change ht_master and/or ht_clone_top ?
    // [title=' + datasetId + ']
    head$ = $(
      '#observational-table > div.ht_clone_top.handsontable > div.wtHolder > div.wtHider > div.wtSpreader > table.htCore > thead > tr > th > div > span.colHeader > div.head.col-Dataset-Name'),
    prefix = positionFilterText + '  ';
    head$.text(prefix + head$.text());
  }

  /** @return those blocks which have positionFilter and featurePositions
   */
  get blockIntersections() {
    const
    blocks = this.brushedOrViewedVCFBlocksVisible
      .filter(block => block[Symbol.for('featurePositions')] && 
              ((block.positionFilter ?? null) !== null));
    return blocks;
  }

  /** If blocks ("datasets") are selected for intersection filtering,
   * filter an array of features.
   * @return features, or a filtered copy of it.
   */
  featureFilterPre(block, features) {
    const
    fnName = 'featureFilterPre',
    blocks = this.blockIntersections;
    if (blocks.length) {
      const
      /** refer : models/block.js : addFeaturePositions()  */
      featurePositions = blocks.map(block => block[Symbol.for('featurePositions')]);
      const feature0 = features[0];

      features = features.filter(feature => 
        blocks.find((block, blockIndex) => {
          const
          positionIsInBlock = featurePositions[blockIndex].has(feature.get('value.0')),
          out = positionIsInBlock !== block.positionFilter;
          return out;
        }) === undefined);
      /** If all are filtered out, the headers are not displayed, so retain 1 feature. */
      if (! features.length && feature0) {
        features = [feature0];
      }
    }
    return features;
  }

  featureFilter(feature) {
    const
    MAF = feature.values.MAF,
    /** don't filter datasets which don't have MAF */
    ok = (MAF === undefined) || 
      ((+MAF < this.args.userSettings.mafThreshold) === this.args.userSettings.mafUpper);
    return ok;
  }

  /** @return undefined if callRateThreshold is 0, otherwise a filter function with signature
   * sampleFilter(block, sampleName) -> boolean, false means filter out
   */
  @computed('args.userSettings.callRateThreshold')
  get sampleFilter() {
    const
    callRateThreshold = this.args.userSettings.callRateThreshold,
    fn = ! callRateThreshold ? undefined : (block, sampleName) => {
      const
      sampleCount = block[callRateSymbol][sampleName],
      /** OK (filter in) if callRate is undefined because of lack of counts. */
      callRate = sampleCount && (sampleCount.calls + sampleCount.misses) ?
        sampleCount.calls / (sampleCount.calls + sampleCount.misses) :
        undefined,
      ok = ! callRate || (callRate >= callRateThreshold);
      return ok;
    };
    return fn;
  }

  /** @return undefined if haplotypeFiltersCount is 0, otherwise
   * a sort comparator function with signature (sampleName1, sampleName2),
   * which returns +ve if column of sampleName2 should be shown to the right of sampleName1.
   * Related : columnNamesCmp().
   */
  @computed('haplotypeFiltersCount', 'featureFiltersCount')
  get sampleNamesCmp() {
    const
    selectFeaturesByLDBlock = this.args.userSettings.selectFeaturesByLDBlock,
    filtersCount = selectFeaturesByLDBlock ? this.haplotypeFiltersCount : this.featureFiltersCount,
    fn = ! filtersCount ? undefined : (...sampleNames) => {
      const
      matchRates = sampleNames.map((sampleName) => {
        const
        block = this.sampleName2Block[sampleName],
        m = block?.[sampleMatchesSymbol][sampleName],
        ratio = ! m || ! (m.matches + m.mismatches) ? 0 : 
          m.matches / (m.matches + m.mismatches);
        return ratio;
      }),
      cmp = matchRates[1] - matchRates[0];
      return cmp;
    };
    return fn;
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
      const userSettings = this.args.userSettings;
      let
      referenceBlock = this.axisBrush?.get('block'),
      /** parallel to .gtDatasetIds.
       * expect : block.referenceBlock.id === referenceBlock.id
       * Based on : .brushedOrViewedVCFBlocksVisible()
       */
      visibleBlocks = this.gtBlocks;
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
      dLog(fnName, visibleBlocks.mapBy('id'));
      if (visibleBlocks.length) {
        const
        // this.gtDatasets is equivalent to visibleBlocks.mapBy('datasetId.content'),
        gtDatasetIds = this.gtDatasetIds,
        featuresArrays = visibleBlocks
        /* featureFilterPre() is expected to filter out most features,
         * so apply it before rowLimit; */
          .map((b) => this.featureFilterPre(b, b.featuresInBrush))
          .filter((features) => features.length)
          .map((features) => features.slice(0, this.rowLimit));

        this.collateBlockHaplotypeFeatures(featuresArrays);
        this.collateBlockSamplesCallRate(featuresArrays);

        if (featuresArrays.length) {
          const options = {userSettings};
          if (this.urlOptions.gtMergeRows) {
            /** {rows, sampleNames}; */
            const
            sampleGenotypes = 
              vcfFeatures2MatrixViewRows(
                this.requestFormat, featuresArrays, this.featureFilter.bind(this), this.sampleFilter,
                options);
            /** Insert datasetIds to this.columnNames.
             * Add features to : this.displayDataRows.
             */
            const nonVCF = this.nonVCFFeaturesWithinBrushData;
            const displayDataRows = sampleGenotypes.rows;
            /** Annotate rows with features from nonVCF.features which overlap them.
             * nonVCFFeaturesWithinBrushData() could return []{datasetId, features : [] },
             * and that datasetId could be passed to annotateRowsFromFeatures() with its features.
             * or :
             * For the purposes of annotateRowsFromFeatures() and
             * featuresValuesFields(), the result nonVCF.features could be
             * 1 array of features per block, as with featuresArrays above.
             *
             * Earlier functionality instead displayed start and end position of
             * all of nonVCF.features, using rowsAddFeature(), until 54baad61.
             */
            annotateRowsFromFeatures(displayDataRows, nonVCF.features, this.selectedFeaturesValuesFields);
            const currentFeaturesValuesFields = featuresValuesFields(nonVCF.features);
            const
            datasetIds = nonVCF.features.mapBy('blockId.datasetId.id').uniq(),
            extraDatasetColumns = datasetIds
              .map((datasetId) => this.selectedFeaturesValuesFields[datasetId])
              .filter(x => x)
              .flat(),

            /** non- Genotype/VCF datasetColumns; they are passed separately to
             * gtDatasetColumns as they may require different presentation. */
            datasetColumns = nonVCF.columnNames,

            /* merge new values in - remember selections for datasets which are currently not visible. */
            // if (this.currentFeaturesValuesFields) Object.assign(this.currentFeaturesValuesFields, currentFeaturesValuesFields);

            /* Position value is returned by matrix-view : rowHeaders().
             * for gtMergeRows the Position column is hidden.
             * .sampleNames contains : [ 'Ref', 'Alt', 'tSNP', 'MAF' ]; 'tSNP' is mapped to 'LD Block'
             */
            columnNames = gtDatasetIds
              .concat(nonVCF.columnNames)
              .concat(['Position', 'Name'])
              .concat(extraDatasetColumns)
              .concat(sampleGenotypes.sampleNames);

            /** These are passed to matrix-view, so set them at one time. */
            setProperties(this, {
              displayData : null,
              displayDataRows,
              gtDatasetColumns : gtDatasetIds,
              datasetColumns,
              extraDatasetColumns,
              currentFeaturesValuesFields,
              columnNames,
            });

          } else {
            let sampleNames;
            if (userSettings.filterBySelectedSamples) {
              /** instead of this.selectedSamples (i.e. of lookupDatasetId), show
               * selected samples of all .brushedVCFBlocks.
               */
              const selectedSamplesOfBrushed = this.blocksSelectedSamples(visibleBlocks);
              if (selectedSamplesOfBrushed.length) {
                sampleNames = selectedSamplesOfBrushed;
              }
            }
            if (! sampleNames) {
              /** filter out tSNP and MAF because they are already covered, in
               * vcfFeatures2MatrixView() : mafColumn, haplotypeColourColumn
               */
              sampleNames = this.featuresArraysToSampleNames(featuresArrays)
                .filter(sampleName => ! ['tSNP', 'MAF'].includes(sampleName));
            }

            const
            features = featuresArrays.flat(),
            sampleGenotypes =  {createdFeatures : features, sampleNames},
            displayData = vcfFeatures2MatrixView
            (this.requestFormat, sampleGenotypes, this.featureFilter.bind(this), this.sampleFilter,
             this.sampleNamesCmp, options);
            setProperties(this, {
              displayData,
              displayDataRows : null,
              columnNames : null,
              gtDatasetColumns : gtDatasetIds,
              datasetColumns : null,
              extraDatasetColumns : null,
            });
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
    /** callRateThreshold -> sampleFilter, passed to vcfFeatures2MatrixView{,Rows{,Result}} -> sampleIsFilteredOut{,Blocks} */
    'args.userSettings.callRateThreshold',
    'datasetPositionFilterChangeCount',
  )
  get selectedSampleEffect () {
    const fnName = 'selectedSampleEffect';
    const viewedVisible = this.blockService.viewedVisible;
    dLog(fnName, viewedVisible.length);
    // remove all because sampleNames / columns may have changed.
    if (this.displayData?.length) {
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

  //----------------------------------------------------------------------------

  /** Construct a map per block from sample names to call rate.
   * Call rate is defined as the genotype calls divided by the total number of
   * Features / SNPs in the brushed interval.
   * Genotype calls are e.g. 0, 1, 2; misses are './.'
   * @param featuresArrays  array of arrays of features, 1 array per block
   */
  collateBlockSamplesCallRate(featuresArrays) {
    const fnName = 'collateBlockSamplesCallRate';
    const callKey = ['misses', 'calls'];
    featuresArrays
      .forEach(
        (features) => {
          const
          blockp = features?.[0].get('blockId'),
          /** blockp may be a proxy; want the actual Block, for reference via Symbol */
          block = blockp && contentOf(blockp),
          map = block[callRateSymbol] || (block[callRateSymbol] = {});
          features
          .reduce(
            (map, feature) => {
              // could do map=, but the 3 levels have the same value for map.
              Object.entries(feature.values).reduce((map, [key, value], columnIndex) => {
                if (! valueNameIsNotSample(key)) {
                  /* could skip samples which are filtered out; would have to
                  * return that info from vcfFeatures2MatrixView{,RowsResult}() */
                  /** equivalent : this.columnNames[columnIndex] when gtMergeRows */
                  const
                  sampleName = key,
                  call = value !== './.',
                  sampleCount = map[key] || (map[key] = {calls:0, misses:0});
                  sampleCount[callKey[+call]]++;
                }
                return map;
              }, map);

              return map;
            },
            map);
          dLog(fnName, map, block.brushName);
        });
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
    userSettings = this.args.userSettings,
    matchRef = userSettings.haplotypeFilterRef,
    matchKey = matchRef ? 'ref' : 'alt',
    matchNumber = matchRef ? '0' : '2',
    /** to match homozygous could use .startsWith(); that will also match 1/2 of heterozygous.
     * Will check on (value === '1') : should it match depending on matchRef ?
     * @param value sample/individual value at feature / SNP
     * @param matchValue  ref/alt value at feature / SNP (depends on matchRef)
     */
    matchFn = (value, matchValue) => (value === matchNumber) || (value === '1') || value.includes(matchValue),

    ablocks = this.brushedOrViewedVCFBlocks;
    const selectFeaturesByLDBlock = this.args.userSettings.selectFeaturesByLDBlock;

    ablocks.forEach((abBlock) => {
      let blockMatches = {};
      const
      block = abBlock.block;
      if (selectFeaturesByLDBlock) {
        const
      selected = block[haplotypeFiltersSymbol],
      matchesR = selected.reduce((matches, tSNP) => {
        const features = block[haplotypeFeaturesSymbol][tSNP];
        featuresCountMatches(features, matches);
        return matches;
      }, {});
        blockMatches = matchesR;
      } else {
        const
        features = block[featureFiltersSymbol];
        if (features) {
          featuresCountMatches(features, blockMatches);
        }
      }

      function featuresCountMatches(features, matches) {
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
      }

      block[sampleMatchesSymbol] = blockMatches;
      if (showHideSampleFn && this.args.userSettings.haplotypeFiltersEnable) {
        /* 
         * block *
         *   sample*
         *     show/hide according to count
         */
        Object.entries(blockMatches).forEach(([sampleName, counts]) => {
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

  @action
  copyTableToClipboard() {
    const
    fnName = 'copyTableToClipboard',
    tableText = this.tableApi.dataClipboard();
    dLog(fnName, tableText);
    clipboard_writeText(tableText);
  }


  //----------------------------------------------------------------------------

  @computed('vcfGenotypeSamplesSelected', 'lookupDatasetId', 'lookupScope')
  get headerTextP() {
    const
    fnName = 'headerText',
    {samples, samplesOK} = this.samplesOK(false),
    domainInteger = [0, 1],
    vcfDatasetId = this.lookupDatasetId,
    scope = this.lookupScope;
    let textP;
    /** After a brush, this CP is re-evaluated, although the dependencies
     * compare === with the previous values.  Could memo-ize the value based on
     * dependency values.
     *
     * Related : with autoLookup may need to cache headerText per
     * lookupDatasetId; depends on whether result vcfExportText combines
     * brushedOrViewedVCFBlocksVisible into a single VCF.
     */
    if (samplesOK && scope && vcfDatasetId) {
      const
      requestFormat = this.requestFormat,
      userSettings = this.args.userSettings,
      requestSamplesFiltered = userSettings.requestSamplesFiltered,
      /** If filtered, then samples is a subset of All. */
      requestSamplesAll = userSettings.requestSamplesAll && ! requestSamplesFiltered,
      requestOptions = {requestFormat, requestSamplesAll, headerOnly : true};
      /** these params are not applicable when headerOnly : samples, domainInteger, rowLimit. */
      textP = vcfGenotypeLookup(
        this.auth, this.apiServerSelectedOrPrimary, samples, domainInteger,
        requestOptions, vcfDatasetId, scope, this.rowLimit)
        .then(
        (text) => {
          const
          isGerminate = resultIsGerminate(text);
          this.headerText = isGerminate ? text.join('\t') : text;
          if (trace) {
            dLog(fnName, text);
          }
          return this.headerText;
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

  /** Can use this to set width of textarea class="vcfGenotypeText".
   * Currently using 100% instead - this may be useful when result does not need 100%
   */
  @action
  vcfGenotypeTextWidthStyle() {
    const
    fnName = 'vcfGenotypeTextSetWidth',
    text = this.vcfGenotypeText,
    /** last line may be truncated so to measure length of 2nd last line */
    lastChar = text.length-1,
    lastNewline = text.lastIndexOf('\n', lastChar - 1),
    lastRowWidth = lastNewline - text.lastIndexOf('\n', lastNewline - 1),
    style = lastRowWidth ? 'width:' + lastRowWidth + 'em' : '';
    console.log(fnName, arguments, lastRowWidth, style);
    return style;
  }

  // ---------------------------------------------------------------------------

  @action
  userMessage(text) {
    alert(text);
  }

  //----------------------------------------------------------------------------



  /** comments as in manage-explorer.js; copied from manage-{explorer,view} */
  @tracked
  activeId = 'tab-view-Datasets';

  /** invoked from hbs via {{compute (action this.tabName2Id tabTypeName ) }}
   * @param tabName text displayed on the tab for user identification of the contents.
   * @return string suitable for naming a html tab, based on tabName.
   */
  @action
  tabName2Id(tabName) {
    let
    id = tab_view_prefix + text2EltId(tabName);
    if (trace)
      dLog('tabName2Id', id, tabName);
    return id;
  }

  /** Receive user tab selection changes, for controls dialog.
   * @param id  tab name
   */
  @action
  onChangeTab(id, previous) {
    const fnName = 'onChangeTab';
    dLog(fnName, this, id, previous, arguments);

    this.activeId = id;
  }

  //----------------------------------------------------------------------------

  /** activeIdDatasets, tabName2IdDatasets() are analogous to and based on 
   * activeId, tabName2Id() above.
   */
  @tracked
  activeIdDatasets = null;
  @tracked
  activeDatasetId = null;

  /** invoked from hbs via {{compute (action this.tabName2Id tabTypeName ) }}
   * @param tabName text displayed on the tab for user identification of the contents.
   * @return string suitable for naming a html tab, based on tabName.
   */
  @action
  tabName2IdDatasets(tabName) {
    let
    id = tab_view_prefix_Datasets + text2EltId(tabName);
    if (trace)
      dLog('tabName2IdDatasets', id, tabName);
    return id;
  }

  //----------------------------------------------------------------------------


  /** Receive user selection of VCF / genotype dataset via tab selection change
   * of Datasets Samples tabs.
   * @param datasetId
   */
  @action
  selectDataset(datasetId) {
    const fnName = 'selectDataset';
    dLog(fnName, this, datasetId, arguments);

    const
      gtDatasetIds = this.gtDatasetTabs,
      i = gtDatasetIds.findIndex(tabId => tabId === datasetId);
      if (i < 0) {
        dLog(fnName, i, datasetId, gtDatasetIds);
      } else {
        dLog(fnName, i, gtDatasetIds[i], datasetId);
        // sets .axisBrushBlockIndex
        this.mut_axisBrushBlockIndex(i);
      }
    this.setSelectedDataset(datasetId);
  }
  setSelectedDataset(datasetId) {
    this.activeDatasetId = datasetId;
    this.activeIdDatasets = this.tabName2IdDatasets(datasetId);
  }


  //----------------------------------------------------------------------------

  /** Called by matrix-view afterScrollVertically()
   * @param features of first and last visible rows after vertical scroll by user.
   */
  @action
  tablePositionChanged(features) {
    const fnName = 'tablePositionChanged';
    dLog(fnName, features);
    // The caller may pass empty features[] to indicate the table is empty.
    features = features.filter(f => f);
    if (features?.length) {
      const
      values = features.mapBy('value').flat(),
      valueExtent = d3.extent(values),
      axes = features.mapBy('blockId.axis1d'),
      /** Features could be of multiple axes; can pass all features and collate
       * extents for each axis separately.  */
      axis1d = axes[0];
      axis1d.set('tablePosition', valueExtent);
      /* related : this.brushedOrViewedVCFAxes // axis-1d [] */
    } else {
      const axes = this.brushedOrViewedVCFAxes;
      if (axes.length === 1) {
        const axis1d = axes[0];
        axis1d.set('tablePosition', null);
      }
    }
  }

  // ---------------------------------------------------------------------------

  @computed
  get germinate () {
    let germinate;
  try {
    germinate = new Germinate();
    console.log('germinate', germinate);
    // germinate.serverinfo(); // germplasm(); // callsets();
  } catch (error) {
    console.log('vcfGenotypeLookup', 'Germinate', error);
  }
    return germinate;
  }

  //----------------------------------------------------------------------------

}
