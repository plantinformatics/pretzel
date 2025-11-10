// {{!-- check : selectSampleFilter activeSampleFilter tabName2IdDatasets selectedCount activeIdDatasets --}}

import Component from '@glimmer/component';
import EmberObject, { computed, action, get as Ember_get, set as Ember_set, setProperties, defineProperty } from '@ember/object';
import { alias, reads } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { later } from '@ember/runloop';
import { A as Ember_A } from '@ember/array';

import { task } from 'ember-concurrency';

import config from 'pretzel-frontend/config/environment';

// see comment in vcfGenotypeLookupDataset()
import { allSettled } from 'rsvp';

import { uniq, uniqWith, intersection } from 'lodash/array';

import createIntervalTree from 'interval-tree-1d';

import NamesFilters from '../../utils/data/names-filters';
import { toPromiseProxy, toArrayPromiseProxy, addObjectArrays, arrayClear } from '../../utils/ember-devel';
import { thenOrNow, contentOf, pollCondition, promiseThrottle } from '../../utils/common/promises';
import { responseTextParseHtml } from '../../utils/domElements';
import { fileDownloadBlob, fileDownloadAsCSV, text2Gzip } from '../../utils/dom/file-download';
import { clipboard_writeText } from '../../utils/common/html';
import { arrayChoose, arraySortNestedComparator } from  '../../utils/common/arrays';
import { intervalSize } from '../../utils/interval-calcs';
import { inRange, overlapInterval } from '../../utils/draw/zoomPanCalcs';
import { featuresIntervalsForTree } from '../../utils/data/features';
// let vcfGenotypeBrapi = window["vcf-genotype-brapi"];
import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
console.log('vcfGenotypeBrapi', vcfGenotypeBrapi, window["@plantinformatics/vcf-genotype-brapi@npm:pretzel.A8b"]);
const /*import */{
  setFrameworkFunctions,
  datasetId2Class,
  gtValueIsNumeric,
  addGerminateOptions,
  vcfGenotypeLookup,
  addFeaturesJson,
  resultIsGerminate,
  addFeaturesGerminate,
  resultIsBrapi,
  addFeaturesBrapi,
} = vcfGenotypeBrapi.vcfFeature; /*from 'vcf-genotype-brapi'; */

const /*import */{
  getPassportData,
} = vcfGenotypeBrapi.genolinkPassport; /*from 'vcf-genotype-brapi'; */
/* Importing this directly instead of via the module package during development
 * enables incremental builds, for a rapid development cycle. */
// import { getPassportData } from '../../utils/genolink-passport';
/* Pass chunk into getPassportData() to bypass module packaging issue when
 * building genolink-passport.js in this repo via symbolic link.
 */
//import { chunk } from 'lodash/array'; // .js';

import {
  refAlt,
  valueNameIsNotSample,
  sampleNameIsAGG,

  normalizeMaf,
  sampleIsFilteredOut,
  columnName2SampleName,
  passportValueCompare,
  augmented2SampleName,
  vcfFeatures2MatrixView, vcfFeatures2MatrixViewRows,
  valueIsMissing,
  rowsAddFeature,
  annotateRowsFromFeatures,
  featuresValuesFields,
  featureSampleNames,
  featuresSampleMAF,
  featureMafFilter,
  featureCallRateFilter,
  featuresFilterNalleles,
  objectSymbolNameArray,
} from '../../utils/data/vcf-feature';
import {
  referenceSamplesSymbol,
  referenceSampleMatchesSymbol,
  Counts,
  Measure,
  distancesTo1d,
  MatchRefSample,
  tsneOrder,
} from '../../utils/data/genotype-order';

import { stringCountString, toTitleCase } from '../../utils/string';

import { text2EltId } from '../../utils/explorer-tabId';

import { Germinate } from '../../utils/data/germinate';


/* global $ */
/* global d3 */

// -----------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;
/** Enable trace of comparison / sorting of sample columns, via selected genotypic pattern. */
const trace_sort = 0;

const featureSymbol = Symbol.for('feature');


/** Attribute of a block, used for filtering or sorting samples.
 * 1 of 3 types of filter : (tied to : sampleFilterTabs, sampleFilterKeys) :
 *
 * * 'variantInterval'
 * 'Variant Interval' Features which are selected for filtering.
 * block[sampleFiltersSymbol].variantInterval -> [] of 'Variant Interval' Feature
 * i.e. which have variantInterval in .blockId.datasetId.tags.
 *
 * * 'feature'
 * Feature SNP Positions which are selected for filtering.
 * block[sampleFiltersSymbol].feature -> [] of Feature (or Position)
 *
 * * 'LD Block' / 'haplotype'
 * tSNP values which are selected for filtering.
 * block[sampleFiltersSymbol].haplotype -> [] of tSNP
 */
const sampleFiltersSymbol = Symbol.for('sampleFilters');
/** array of Features / SNPs in a tagged SNP set, i.e. equal tSNP value.
 * features = block[haplotypeFeaturesSymbol][tSNP]
 */
const haplotypeFeaturesSymbol = Symbol.for('haplotypeFeatures');
/** Counts for filtering by LD Block (Haplotype) values
 * block[sampleMatchesSymbol] : Measure, (previously distance, {matches: 0, mismatches : 0})
 * also used in sampleIsFilteredOut{,Blocks}()
 */
const sampleMatchesSymbol = Symbol.for('sampleMatches');
const featurePositionsSymbol = Symbol.for('featurePositions');
/** Counts for calculating Call Rate of a sample.
 * sampleCount = block[callRateSymbol][sampleName] : {calls:0, misses:0}  */
const callRateSymbol = Symbol.for('callRate');
/** Indicate whether Alt or Ref value should be matched at this Feature / SNP.
 * feature[matchRefSymbol] true/false.  */
const matchRefSymbol = Symbol.for('matchRef');
/** Cache of Passport data for the sampleName, i.e. dataset.samplesPassport.genotypeID[sampleName]
 * This attribute is assigned to a String sampleName. 
 */
const passportSymbol = Symbol.for('passport');

/** dataset[enableFeatureFiltersSymbol] true/false enables feature filters for this dataset
 */
const enableFeatureFiltersSymbol = Symbol.for('enableFeatureFilters');

const tab_view_prefix = "tab-view-";
const tab_view_prefix_Datasets = "tab-view-Datasets-";

class SampleFiltersCount extends EmberObject {
  @tracked
  haplotype = null;
  @tracked
  feature = null;
  @tracked
  variantInterval = null;
};
/** copied from matrix-view.js to enable build-time code deletion;  see comment there. */
const sampleFilterTypeNameModal = false;

//--------------------------------------

/** Display dummy column headings when the table is empty.
 */
const emptyTableColumns = [
  'Chr',
  'Position',
  'Name',
  'Ref',
  'Alt',
];

//------------------------------------------------------------------------------
// copied from genotype-samples.js, this will be imported from environment
/** Base URL for HTTP GET request to open Genolink with the result of a search
 * for genotypeIds included in the URL.
 */
const genolinkBaseUrl = "https://genolink.plantinformatics.io";

/** Passport data fields initially displayed in passport-table.
 * The user is able to configure this via <Panel::SelectPassportFields >
 * This is a subset of passportFieldNames (genolink-passport.js).
 */
const passportFields = [
  "genotypeID",
  "region",
  "subRegion",
  "accessionName",
  "accessionNumber",
  "aliases",
  "countryOfOrigin.name",
  "crop.name",
];


//------------------------------------------------------------------------------

/**
 * @return true if feature.values contains only non-sample values, as listed in
 * valueNameIsNotSample().
 */
function featureHasSamplesLoaded(feature) {
  const
  valuesKeys = Object.keys(feature.values),
  noSampleValues = valuesKeys.filter(valueNameIsNotSample).length === valuesKeys.length;
  return ! noSampleValues;
}

// -----------------------------------------------------------------------------


/**
 * @param selectBlock action
 * @param selectedBlock selected data block
 * @param selectedFeatures  replaced by .selectedService
 * @param updatedSelectedFeatures 'updateSelectedFeatures'
 * @param userSettings  userSettings.genotype
 * user-selected values are preserved in args.userSettings
 * (related : services/data/selected.js)
 * Fields are implicitly @tracked because userSettings is in args.
 *
 *------------------------------------------------------------------------------
 * Within userSettings (object) :
 *
 * Array of sample names selected by the user, for distance reference at
 * selected variantIntervals / SNPs / LD Blocks.
 * . selectedColumnNames
 *
 * Arrays of sample names selected by the user, per dataset. indexed by VCF datasetId
 * .vcfGenotypeSamplesSelected = {} (aliased as vcfGenotypeSamplesSelectedAll)
 *
 * .samplesIntersection default : false
 * .requestFormat : string : 'Numerical' (default), 'CATG'
 * .replaceResults default: false

 * .showResultText default: false
 * .showColourThemeModal default: false
 * Enables display of components/panel/colour-theme-selector
 *
 * .compressVCF default : true
 * .showConfigureLookup default: false
 * .showSampleFilters default : false

 * .filterBySelectedSamples default : true
 * true means filter the data within scope (brush or zoomed domain) by samples
 * selected in corresponding dataset tab of block
 * Requests are narrowed to selected samples when ! requestSamplesAll,
 * i.e. requestSamplesSelected.
 *
 * .mafUpper default : true
 * .mafThreshold default 0
 *
 * .snpPolymorphismFilter default : false
 * true means filter out monomorphic SNPs
 *
 * .callRateThreshold default 0
 * .featureCallRateThreshold default 0
 * .minAlleles default ''
 * .maxAlleles default ''
 * .typeSNP default false
 *
 * .samplesLimit default 100
 * .samplesLimitEnable default true
 * .sampleFilterTypeName default 'variantInterval'
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
 * .filterSamplesByHaplotype  boolean, default : false
 *   Show samples selected by SNP filters
 * .matchHet  boolean, default : true
 *   Match for samples which have a heterozygous genotype value at a selected SNP.
 * .showHaplotypes  boolean, default : false
 *   Show unique haplotypes of the selected SMPs, and their samples
 * .showHaplotypesSamples  boolean, default : false
 *   For each haplotype, show samples which have that haplotype.
 * .sortByHaplotypeValue  boolean, default : true
 *   Sort the haplotypes by their value, otherwise by their sample count.
 * .includeHetMissingHaplotypes  boolean, default : false
 *   Show haplotypes which contain heterozygous values and missing data.
 *   If false, show only haplotypes with all homozygous genotype values.
 *
 * .passportFields	array of Passport data field names
 *   Selected by the user; the sample column headers are augmented with each
 *   sample's values for these fields.
 *   This is currently [ {id, name}, ... ], where id == name.
 * .sortByPassportFields  boolean, default : false
 *   Sort the Genotype Table columns by the selected Passport field values : .passportFields
 * .showSelectPassportFields  show select-passport-fields for extra rows in table column headings
 *
 * .passportTable  settings for passportFields for passport-table for filtering samples in genotype-samples
 * { passportFields : {Array<string fieldName>}, showSelectPassportFields : boolean, default false }
 *
 * @see userSettingsDefaults()
 *------------------------------------------------------------------------------
 */
export default class PanelManageGenotypeComponent extends Component {
  @service() controls;
  @service() auth;
  @service('data/axis-brush') axisBrushService;

  @service('data/block') blockService;
  @service('data/vcf-genotype') sampleCache;
  @service('data/haplotype') haplotypeService;
  @service('query-params') queryParamsService;
  @service('data/selected') selectedService;
  @service('data/transient') transient;



  @alias('controls.apiServerSelectedOrPrimary') apiServerSelectedOrPrimary;

  @alias('queryParamsService.urlOptions') urlOptions;

  @alias('haplotypeService.haplotypeColourScale') haplotypeColourScale;
  @alias('haplotypeService.variantIntervalColourScale') variantIntervalColourScale;

  @alias('controls.userSettings.localStorage') localStorage;
  @alias('localStorage.dataLicenceAgreements') dataLicenceAgreements;


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

  /** Counter of results from datasetsGetPassportData(). */
  @tracked
  passportDataCount = 0;

  // @alias('lookupBlockSamples.names')
  @computed('lookupDatasetId', 'receivedNamesCount')
  get vcfGenotypeSamplesText() {
    return this.sampleCache.sampleNames[this.lookupDatasetId];
  }
  set vcfGenotypeSamplesText(names) {
    this.sampleCache.sampleNames[this.lookupDatasetId] = names;
  }

  /** For a VCF dataset, sampleNames are received via bcftools request, and does
   * not change, so it is cached per dataset, by this function.
   * @param block is this.lookupBlock, and indicates the dataset which the
   * sampleNames should be stored for.
   * The dataset's name is this.lookupDatasetId, which is not necessarily unique
   * when using multiple servers - see datasetsForName().
   * dataset.sampleNames is used in services/data/paths-progressive.js : vcfGenotypeLookup()
   */
  datasetStoreSampleNames(block, sampleNames) {
    const
    dataset = contentOf(block.get('datasetId'));
    dataset.sampleNames = sampleNames;
  }

  @alias('args.userSettings.vcfGenotypeSamplesSelected')
  vcfGenotypeSamplesSelectedAll;

  /** aliased as selectedSamples() */
  // @computed('lookupBlockSamples.selected')
  @computed('lookupDatasetId', 'receivedNamesCount')
  get vcfGenotypeSamplesSelected() {
    if (! this.lookupDatasetId) {
      dLog('get vcfGenotypeSamplesSelected', this.lookupDatasetId);
    }
    let selected = this.vcfGenotypeSamplesSelectedAll?.[this.lookupDatasetId];
    return selected;
  }
  set vcfGenotypeSamplesSelected(selected) {
    if (! this.lookupDatasetId) {
      dLog('set vcfGenotypeSamplesSelected', this.lookupDatasetId);
    }
    (this.vcfGenotypeSamplesSelectedAll || this.args.userSettings.vcfGenotypeSamplesSelected)[this.lookupDatasetId] = selected;
  }

  @tracked
  displayData = Ember_A();
  /** data for matrix-view displayDataRows,
   * [feature position][sample name]{name, value, Symbol feature }
   */
  @tracked
  displayDataRows = null;

  /** derived from brushedVCFBlocks .featuresInBrushOrZoom  .values. sampleNames 
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
  tableApi = {
    dataClipboard : null,
    // @tracked
    topLeftDialog : null,
  };


  //----------------------------------------------------------------------------

  // @action  // called via (action to pass target.value)
  nameFilterChanged(value) {
    this.namesFilters.nameFilterChanged(value);
  }

  // ---------------------------------------------------------------------------

  /** register or de-register this component.
   * @param handle this (component) or null
   */
  registerByName(handle) {
    const fnName = 'registerByName';
    /** check : registered value === null xor handle === null. */
    const
    registered = this.controls.registrationsByName['component:panel/manage-genotype'],
    ok = ((handle === null) ? (registered === this) : ! registered) &&
      ((registered === null) !== (handle === null));
    dLog(fnName, handle, ok);
    Ember_set(this.controls.registrationsByName, 'component:panel/manage-genotype', handle);
    // this.controls.registrationsByName.updateCount++;
  }

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    this.userSettingsDefaults();
    /* if (trace) { */
      dLog('manage-genotype', 'constructor', 'this', this, 'args', Object.entries(this.args));
    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.manageGenotype = this;
    }
    this.registerByName(this);
    // used for display of brushedVCFFeaturesCount in nav tab
    Ember_set(this, 'args.summaryData.proxy', this);


    this.namesFilters = new NamesFilters();
    Object.entries(this.sampleFilterTypes).forEach(
      ([name, value]) => value.name = name );
  }
  /** Provide default values for args.userSettings; used in constructor().
   */
  userSettingsDefaults() {
    const userSettings = this.args.userSettings;

    if (userSettings.selectedColumnNames === undefined) {
      userSettings.selectedColumnNames = [];
    }

    if (userSettings.vcfGenotypeSamplesSelected === undefined) {
      userSettings.vcfGenotypeSamplesSelected = {};
    }

    //--------------------------------------------------------------------------
    if (userSettings.selectedDatasetId) {
      const selectedSamples = userSettings.vcfGenotypeSamplesSelected[userSettings.selectedDatasetId];
      if (selectedSamples || (this.selectedSamplesText === undefined)) {
        later(() => this.selectedSamplesText = selectedSamples ? selectedSamples.join('\n') : '');
      }
    }
    //--------------------------------------------------------------------------

    if (userSettings.samplesIntersection === undefined) {
      userSettings.samplesIntersection = false;
    }

    // possible values listed in comment before requestFormat
    if (userSettings.requestFormat === undefined) {
      userSettings.requestFormat = 'Numerical'; // alternate : CATG
    }


    /* most of the following flags are (mut) in checkboxes in .hbs, which
     * may require that they have a defined initial value.
     */

    if (userSettings.replaceResults === undefined) {
      userSettings.replaceResults = false;
    }

    if (userSettings.showResultText === undefined) {
      userSettings.showResultText = false;
    }
    if (userSettings.showColourThemeModal === undefined) {
      userSettings.showColourThemeModal = false;
    }
    if (userSettings.compressVCF === undefined) {
      userSettings.compressVCF = true;
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

    if (userSettings.snpPolymorphismFilter === undefined) {
      userSettings.snpPolymorphismFilter = false;
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
    if (userSettings.featureCallRateThreshold === undefined) {
      userSettings.featureCallRateThreshold = 0;
    }
    if (userSettings.minAlleles === undefined) {
      userSettings.minAlleles = '';
    }
    if (userSettings.maxAlleles === undefined) {
      userSettings.maxAlleles = '';
    }
    if (userSettings.typeSNP === undefined) {
      userSettings.typeSNP = false;
    }

    if (userSettings.samplesLimit === undefined) {
      userSettings.samplesLimit = 100;
    }
    if (userSettings.samplesLimitEnable === undefined) {
      userSettings.samplesLimitEnable = true;
    }

    if (userSettings.sampleFilterTypeName === undefined) {
      /** See sampleFilterTypes.
       * equivalent : this.urlOptions.advanced ? 'variantInterval' : 'feature' */
      const firstTab = Object.keys(this.sampleFilterTypes)[0];
      userSettings.sampleFilterTypeName = firstTab;
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

    if (userSettings.filterSamplesByHaplotype === undefined) {
      userSettings.filterSamplesByHaplotype = false;
    }

    if (userSettings.matchHet === undefined) {
      userSettings.matchHet = true;
    }

    if (userSettings.showHaplotypes === undefined) {
      userSettings.showHaplotypes = false;
    }
    if (userSettings.showHaplotypesSamples === undefined) {
      userSettings.showHaplotypesSamples = false;
    }
    if (userSettings.sortByHaplotypeValue === undefined) {
      userSettings.sortByHaplotypeValue = true;
    }
    if (userSettings.includeHetMissingHaplotypes === undefined) {
      userSettings.includeHetMissingHaplotypes = true;
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

    if (userSettings.passportFields === undefined) {
      userSettings.passportFields = [];
    }
    if (userSettings.sortByPassportFields === undefined) {
      userSettings.sortByPassportFields = false;
    }

    if (userSettings.passportTable === undefined) {
      userSettings.passportTable = {
        passportFields, showSelectPassportFields : false,
        /** User text inputs for column search / filter of passport-table,
         * commented in ember-multi2-table.js; briefly :
         * selectedFieldValues is the category / pull-down <select> options
         * fieldSearchString is the non-category search strings,
         * which is implemented by fieldNamesFilters.
         */
        selectedFieldValues : {},
        fieldSearchString : {},
        fieldNamesFilters : {},
      };
    }


    if (this.urlOptions.gtMergeRows === undefined) {
      this.urlOptions.gtMergeRows = true;
    }


  }

  //----------------------------------------------------------------------------

  @action
  onWillDestroy() {
    this.registerByName(null);
    /** When the user views a tab other than Genotype Table, i.e. Dataset,
     * Features Table or Paths Table, this component is destroyed.
     * .rowCount can't be ascertained then, so display ''.
     */
    Ember_set(this, 'args.summaryData.rowCount', '');
    Ember_set(this, 'args.summaryData.proxy', null);
  }


  //----------------------------------------------------------------------------

  @alias('args.userSettings.selectedColumnNames.length') referenceSamplesCount;

  //----------------------------------------------------------------------------

  /** Provide a wrapper around this.args.userSettings.requestSamplesAll for the
   * input checkbox, which has inverse sense.
   */
  get requestSamplesSelected() {
    return ! this.args.userSettings.requestSamplesAll;
  }
  set requestSamplesSelected(value) {
    this.args.userSettings.requestSamplesAll = ! value;
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
   * Units are Mb.
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
   * This initial default value is coordinated with hbs : <input ... value=300 ... rowLimitInput >
   */
  @tracked
  rowLimit = 300;

  /** Messages displayed in the GUI to inform the user that the request scope
   * was truncated by .rowLimit, .samplesLimit respectively.
   */
  @tracked
  rowLimitMessage = null;
  @tracked
  samplesLimitMessage = null;

  @action
  rowLimitInput(event) {
    /** default is 300 : value=300 in hbs
     * event.target.value is a string; convert to a number.
     */
    let value = +event.target.value;
    dLog('rowLimitInput', value, event.target.value);
    this.rowLimit = value;
  }

  /** Count of requested features, samples. Used in areaLimitMessage. */
  @tracked
  requestLength = { features : 0, samples : 0};

  @computed('requestLength.features', 'requestLength.samples')
  get areaLimitMessage() {
    const
    fnName = 'areaLimitMessage',
    requestArea = this.requestLength.features * this.requestLength.samples,
    message = (requestArea < 5e4) ? null : ' Genotype values requested : ' + requestArea + '.';
    dLog(fnName, message);
    return message;
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
  mafThresholdMax = 0.5;

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

  /**
   * @param inputType "text" or "range"
   */
  @action
  featureCallRateThresholdChanged(value, inputType) {
    /* if (trace) { */
    dLog('featureCallRateThresholdChanged', value, inputType);
    Ember_set(this, 'args.userSettings.featureCallRateThreshold', value);
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

  /** Return the sampleFilters for block and filterTypeName.
   * for filterTypeName === 'haplotype' i.e. 'LD Block' / tSNP :
   * User may select tSNP values which are then used to filter samples,
   * in combination with a flag which selects match with Ref or non-Ref values :
   * columns of samples with the expected value are displayed.
   * @param filterTypeName sample filter type name; one of : 'haplotype', 'variantInterval', 'feature'
   * @return [] of tSNP
   */
  blockSampleFilters(block, filterTypeName) {
    return objectSymbolNameArray(block, sampleFiltersSymbol, filterTypeName);
  }

  @computed('args.userSettings.sampleFilterTypeName')
  get selectedFilters() {
    // not used yet.
    // also take account of added : sampleFilterTypeNameModal and .sampleFiltersCountNonEmpty
    const
    filterTypeName = this.args.userSettings.sampleFilterTypeName,
    cpName = 'blocks' + toTitleCase(filterTypeName) + 'Filters',
    filters = this[cpName];
    return filters;
  }

  @action
  haplotypeToggle(feature, haplotype) {
    const
    fnName = 'haplotypeToggle',
    block = feature.get('blockId'),
    filterTypeName = 'haplotype',
    filters = this.blockSampleFilters(block, filterTypeName);
    this.arrayToggleObject(filters, haplotype);
    this.ensureSamplesThenRender(filterTypeName);
  }
  /** filtered/sorted display depends on .samples, which depends on
   * this.vcfGenotypeSamplesText, so request all sampleNames if not received.
   */
  ensureSamplesThenRender(filterTypeName) {
    const fnName = 'ensureSamplesThenRender';
    let textP = ! this.vcfGenotypeSamplesText && this.vcfGenotypeSamples();
    thenOrNow(textP, () => {
      if (textP) {
        dLog(fnName);
      }
      // Refresh display.
      this.sampleFiltersSet(filterTypeName);
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

  /** Clear selected filters of the type indicated by current tab.
   * filterTypeName : default to args.userSettings.sampleFilterTypeName
   */
  @action
  sampleFiltersClear(buttonTarget) {
    const fnName = 'sampleFiltersClear';
    const filterTypeName = this.args.userSettings.sampleFilterTypeName;
    dLog(fnName, filterTypeName);
    const
    abBlocks = this.brushedOrViewedVCFBlocks;
    abBlocks.forEach((abBlock, i) => {
      const
      block = abBlock.block,
      sampleFilters = block[sampleFiltersSymbol];
      if (sampleFilters) {
        const
        selected = sampleFilters[filterTypeName],
        blocksTypeFilters = 'blocks' + toTitleCase(filterTypeName) + 'Filters';
        /** selected is equal to one of :
         * this.blocksFeatureFilters[i].sampleFilters.feature
         * this.blocksHaplotypeFilters[i].sampleFilters.haplotype
         */
        if (selected !== this[blocksTypeFilters][i].sampleFilters[filterTypeName]) {
          dLog(fnName, abBlock, this[blocksTypeFilters][i], selected);
        }
        if (selected?.length) {
          selected.removeAt(0, selected.length);
        }
      }

      const referenceSamples = block[referenceSamplesSymbol];
      if (referenceSamples) {
        arrayClear(referenceSamples);
      }
      block[referenceSampleMatchesSymbol] = {};
    });
    arrayClear(this.args.userSettings.selectedColumnNames);

    // Refresh display.
    this.sampleFiltersSet(filterTypeName);
    // done in hbs via action pipe
    // this.haplotypeFiltersApply();
  }

  @action
  haplotypeFiltersApply() {
    if (this.matrixView && ! this.matrixView.isDestroying) {
      this.matrixView.filterSamplesBySelectedHaplotypes();
      later(() => this.matrixView.table.render(), 2000);
    }
  }

  //----------------------------------------------------------------------------
  /** Retain or reset selected SNPs when another dataset is added in Genotype Table.
   * retain and reset are alternatives, and are implemented by gtBlockViewEffect
   * and sampleFiltersCopyEffect respectively.
   */

  /** Retain previous value of .gtBlocks seen by gtBlockViewEffect to detect added blocks */
  gtBlocksPrevious = null;
  /** Side Effect : clear sampleFilters if a new VCF Genotype block is viewed.
   */
  @computed('gtBlocks')
  get gtBlockViewEffect() {
    const
    fnName = 'gtBlockViewEffect',
    blocks = this.gtBlocks,
    gtBlocksPrevious = this.gtBlocksPrevious,
    newBlocks = gtBlocksPrevious ? blocks.filter(block => ! gtBlocksPrevious.includes(block)) : blocks,
    added = newBlocks.length;
    this.gtBlocksPrevious = blocks;
    if (added) {
      dLog(fnName, newBlocks.mapBy('brushName'), blocks.mapBy('brushName'), gtBlocksPrevious?.mapBy('brushName'));
      /* The Clear button calls sampleFiltersClear() and haplotypeFiltersApply()
       * sampleFiltersClear() clears the filters for .sampleFilterTypeName, so
       * set that and call Clear again.
       */
      this.sampleFiltersClear();
      this.setSelectedSampleFilter('feature', /*i*/undefined);
      this.sampleFiltersClear();
      this.haplotypeFiltersApply();
    }
  }
  /** Side Effect : merge sampleFilters of other blocks on the same chromosome
   * (referenceBlock) if a new block is viewed.  */
  // maybe : , 'userSettings.resultCounts.blocks', gtBlocks.@each.block.selectedSNPCount.feature sampleFiltersCountSelected (sampleFiltersCount)
  @computed('gtBlocks')
  get sampleFiltersCopyEffect() {
    /** allow time for brushed features to be loaded.
     * Later, we can update after additional features are loaded, and also
     * sampleFiltersCopyType() is intended to map the selected features to the
     * added block when called again subsequently.
     */
    later(() => ! this.isDestroying && this.sampleFiltersCopy(), 3000);
  }
  /** If a new VCF block is viewed, and it does not have [sampleFiltersSymbol]
   * copy this from another block.
   * Copy each of the attributes, whose keys are sampleFilterKeys.
   */
  sampleFiltersCopy() {
    const fnName = 'sampleFiltersCopy';
    this.sampleFilterKeys.forEach(sampleFilterTypeName => this.sampleFiltersMergeType(sampleFilterTypeName));
    dLog(fnName, this.sampleFiltersCheck(), 'FilteredSamples');

    // update selectedSampleEffect
    const refreshDisplay = () => {
      ! this.isDestroying && this.selectedSampleRefreshDisplay(/*sampleFilterTypeName*/undefined);
    };
    later(() => {
      refreshDisplay();
     // Repeat - will work out the requirements display to be refreshed.
      later(() => {
        refreshDisplay();
      }, 1000);
    });
  }
  /** If a new VCF block is viewed, and it does not have [sampleFiltersSymbol]
   * copy this from another block.
   *
   * This has been tested on the case where there is 1 block displayed with
   * selected SNPs on the same referenceBlock as a block which is added / viewed.
   * This handles what may be the most useful and common case, and suits a user
   * story which is being documented, but will have to be
   * re-thought in other contexts, e.g. if there are 2 blocks with
   * [sampleFiltersSymbol] (currently chooses the first one), or if the selected
   * SNPs are not in this block.
   */
  sampleFiltersCopyType(sampleFilterTypeName) {
    const fnName = 'sampleFiltersCopyType';
    {
      const
      blocks = this.gtBlocks,
      filters = Object.groupBy(blocks, block => {
        const
        sampleFilters = block[sampleFiltersSymbol],
        sampleFilter = sampleFilters?.[sampleFilterTypeName],
        /** for sampleFilterTypeName 'feature' check if a feature is in this block.
         * If the features' blocks !== block, then we want to do, below:
         *   map from copyThis features to block.features ...
         */
        ok = sampleFilter?.length &&
          ((sampleFilterTypeName !== 'feature') ||
           sampleFilter.find(feature => contentOf(feature.get('blockId')) === block));
        return !!ok;
      }),
      newBlocks = filters['false'],
      haveFilters = filters['true'];
      if (haveFilters && newBlocks) {
        newBlocks.forEach(block => {
          const
          /** Only match SNPs on the same reference block.
           * There could be multiple haveFilters on the same .referenceBlock;
           * just using the first. */
          copyThis = haveFilters?.find(b => b.referenceBlock === block.referenceBlock),
          copyThisFilter = copyThis?.[sampleFiltersSymbol];
          if (copyThisFilter) {
            const
            copy =
              Object.entries(copyThisFilter).reduce((O, [k,v]) => {O[k] = v.slice(0); return O;}, {});
            dLog(fnName, 'copyThisFilter', copyThisFilter, copyThis.brushName, copy);

            /** map from copyThis features to block.features, matching SNP position, i.e. .value_0 */
            copy.feature?.forEach((f, i) => {
              const f2 = block.get('features').findBy('value_0', f.value_0);
              dLog(fnName, i, f, f2);
              if (f2) {
                f2[matchRefSymbol] = f[matchRefSymbol];
                copy.feature[i] = f2;
              }
              /* else could remove copy.features[i], or search again later after
               * more features are loaded.  Could use API to request those features. */
            });
            block[sampleFiltersSymbol] = copy;
          } // if (copyThisFilter)
          dLog(fnName, block);
        });
      }
    }
  }
  /** Merge instead of Copy
   *
   * This is alternative to sampleFiltersCopyType(), which is only suitable once
   * when a block is first viewed; otherwise it may overwrite
   * block[sampleFiltersSymbol].
   *
   * This is a different approach, which uses the reference block as the central
   * reference connecting vcf blocks, enabling selected SNPs to be translated
   * between blocks.
   * Sample column sorting is based on the selected SNP being a feature, whereas
   * if they were stored on the reference block they would be just positions +
   * genotype values.
   */
  sampleFiltersMergeType(sampleFilterTypeName) {
    /**
     * collate feature filters up to brush reference block
     * then copy them down to vcf blocks
     */
    const fnName = 'sampleFiltersMergeType';

    const
    blocks = this.gtBlocks;
    /** collate feature filters up to brush reference block */
    blocks.forEach(block => {
      const
      sampleFilters = this.blockSampleFilters(block, sampleFilterTypeName),
      referenceBlock = block.referenceBlock,
      sampleFiltersRef = this.blockSampleFilters(referenceBlock, sampleFilterTypeName);
      sampleFilters.forEach(feature => {
        /** If feature.value_0 is not in sampleFiltersRef then add it.
         * .value_0 === .value[0]
         */
        if (! sampleFiltersRef.findBy('value_0', feature.value_0)) {
          /** referenceBlock does not have features, so refer to the feature of
           * the block in which the feature was selected. */
          sampleFiltersRef.addObject(feature);
        }
      });
    });

    /** then copy them down to vcf blocks */
    blocks.forEach(block => {
      const
      sampleFilters = this.blockSampleFilters(block, sampleFilterTypeName),
      referenceBlock = block.referenceBlock,
      sampleFiltersRef = this.blockSampleFilters(referenceBlock, sampleFilterTypeName);

      sampleFiltersRef.forEach(feature => {
        /** If feature.value_0 is not in sampleFilters but it is in the
         * positions of block, then add it.
         * positionIsInBlock() uses block[featurePositionsSymbol] which is
         * undefined until some features are loaded for block.
         */
        if (! sampleFilters.findBy('value_0', feature.value_0) &&
            block[featurePositionsSymbol] &&
            this.positionIsInBlock(block, feature)) {
          /** referenceBlock does not have features, so refer to the feature of
           * the block which matches the position of the selected feature. */
          const blockFeature = block.features.findBy('value_0', feature.value_0);
          dLog(fnName, 'copy', blockFeature.value_0, 'to', sampleFilters, block.brushName, blockFeature[matchRefSymbol], feature[matchRefSymbol], 'FilteredSamples');
          if (blockFeature[matchRefSymbol] === undefined) {
            blockFeature[matchRefSymbol] = feature[matchRefSymbol];
          } else if (blockFeature[matchRefSymbol] !== feature[matchRefSymbol]) {
            dLog(fnName, 'copy', blockFeature.value_0, blockFeature[matchRefSymbol], '!==', feature[matchRefSymbol], 'FilteredSamples');
          }
          sampleFilters.addObject(blockFeature);
        }
      });
    });
  }
  /** Refresh display to show result of sampleFiltersCopy().
   */
  selectedSampleRefreshDisplay(sampleFilterTypeName) {
    if (! sampleFilterTypeName) {
      sampleFilterTypeName = this.args.userSettings.sampleFilterTypeName;
    }
    // There is probably some redundancy here which can be reduced.
    this.sampleFiltersSet(sampleFilterTypeName);
    this.datasetPositionFilterChangeCount++;
    this.haplotypeFiltersApply();
    /* referenceSamples are separate from sampleFilters - could have a
     * separate dependency/count for sampleFilters. */
    this.referenceSamplesCount++;
  }

  /** Use Ember_set() to signal update of tracked properties and trigger re-render. */
  sampleFiltersSet(filterTypeName) {
    dLog('sampleFiltersSet');
    let filterCount = 0;
    const
    abBlocks = this.blocksSampleFilters(filterTypeName);
    abBlocks.forEach((abBlock) => {
      const
      block = abBlock.block,
      filters = abBlock.sampleFilters[filterTypeName];
      // Value unchanged - notify update.
      Ember_set(abBlock, 'sampleFilters.' + filterTypeName, filters);
      filterCount += filters.length;
    });
    Ember_set(this, 'sampleFiltersCount.' + filterTypeName, filterCount);
  }
  /** Counts of the 3 types of Sample Filters.
   * index is sample filter type name, defined in sampleFilterKeys.
   * sampleFiltersCount[index] is the number of selected tSNPs or features
   */
  @tracked
  sampleFiltersCount = {}; // new SampleFiltersCount();

  @alias('sampleFiltersCount.haplotype') haplotypeFiltersCount;
  @alias('sampleFiltersCount.feature') featureFiltersCount;

  @computed('sampleFiltersCount.{haplotype,feature,variantInterval}')
  get sampleFiltersCountNonEmpty() {
    const
    filterTypeName = ['variantInterval', 'haplotype', 'feature'].find(
      name => this.sampleFiltersCount[name]);
    return filterTypeName;
  }
  /** @return the type name of the currently selected 'Sample Filters' tab.
   * or the currently selected filters (Variant Intervals / LD Blocks / Features).
   */
  @computed(
    'sampleFiltersCountNonEmpty',
    'args.userSettings.sampleFilterTypeName',
  )
  get sampleFilterTypeName() {
    const
    filterTypeName = sampleFilterTypeNameModal ?
      this.args.userSettings.sampleFilterTypeName :
      this.sampleFiltersCountNonEmpty || 'variantInterval';
    return filterTypeName;
  }
  /** @return the count of filters for the currently selected 'Sample Filters' tab
   * or the currently selected filters (Variant Intervals / LD Blocks / Features).
   */
  @computed('sampleFilterTypeName')
  get sampleFiltersCountSelected() {
    const
    filterTypeName = this.sampleFilterTypeName,
    filtersCount = this.sampleFiltersCount[filterTypeName];
    return filtersCount;
  }

  //----------------------------------------------------------------------------

  /** Map haplotype / tSNP to a colour
   * @param tSNP  string represention of a number
   */
  @action
  haplotypeColour(tSNP) {
    const colour = this.haplotypeColourScale(tSNP);
    return colour;
  }
  /** Map variantInterval to a colour
   * @param variantInterval  feature in a dataset which has tag 'variantInterval'
   */
  @action
  variantIntervalColour(variantInterval) {
    const
    /** string represention of a [start, end] interval.
     * Possibly .name will be a useful identier; [start, end] is relatively unique and significant.
     */
    text = variantInterval.value.join('-'),
    colour = this.variantIntervalColourScale(text);
    return colour;
  }

  //----------------------------------------------------------------------------
  /** copied, with haplotype -> feature : blockHaplotypeFilters(),
   * haplotypeToggle(), haplotypeFiltersClear(), haplotypeFiltersApply(),
   * haplotypeFiltersSet().
   * Now replaced by : blockSampleFilters(, 'feature'),
   * sampleFiltersClear(, 'feature'),
   * sampleFiltersSet(, 'feature').
   *
   * The requirements are in prototype phase; after settling possibly there
   * will be enough commonality to factor some of this.
   * The filter may be an array of features or positions; currently features and
   * they are stored as block[featureFiltersSymbol] (copying the use of
   * block[haplotypeFiltersSymbol]), but if they are positions then they don't
   * need to be per-block - can be per axis-brush.
   */


  /** User has clicked Alt or Ref of a SNP - toggle the selection of that
   * SNP+genotype for sample sorting and filtering.
   *
   * Called from afterOnCellMouseDown() -> handleCellClick() ->
   *   featureToggleRC() in matrix-view.js
   */
  @action
  featureToggle(feature, columnName) {
    const
    fnName = 'featureToggle',
    /** probably want to apply filter at SNP position to other VCF blocks in the
     * table (abBlocks = this.brushedOrViewedVCFBlocks); match features in those
     * blocks with the same feature.value.0
     */
    block = feature.get('blockId'),
    filterTypeName = 'feature',
    filters = this.blockSampleFilters(block, filterTypeName),
    matchRef = feature[matchRefSymbol],
    // use == because columnName is currently String.
    matchRefNew = columnName == 'Ref';
    /** Toggle feature when the current key Ref/Alt is clicked again.
     * If a different key is clicked for a feature, just change the key.
     */
    if ((matchRef === undefined) || (matchRef === matchRefNew)) {
      this.arrayToggleObject(filters, feature);
    }
    if (matchRef !== matchRefNew) {
      feature[matchRefSymbol] = matchRefNew;
    }

    // this.blockSetup(block.content);
    block.set('selectedSNPCount.' + filterTypeName, filters.length);
    this.ensureSamplesThenRender(filterTypeName);
  }


  /* haplotypeFiltersApply() -> filterSamplesBySelectedHaplotypes() -> filterSamples()
   * also applies featureFilters, so there is no need for a separate
   * @action featureFiltersApply() 
   */

  //----------------------------------------------------------------------------

  /** User has clicked on a cell which is part of the representation of a Variant Interval.
   * @param feature row feature - SNP;  the samples of this feature will be sorted.
   * @param variantIntervalFeature feature which defines the Variant Interval, which in
   * turn defines the Variant Set of SNPs to compare values against the selected
   * Realised Haplotype/s.
   */
  @action
  variantIntervalToggle(feature, variantIntervalFeature) {
    const
    fnName = 'variantIntervalToggle',
    block = feature.get('blockId'), // or variantIntervalFeature ?
    filterTypeName = 'variantInterval',
    filters = this.blockSampleFilters(block, filterTypeName);
    dLog(fnName, feature, variantIntervalFeature, filters);
    this.arrayToggleObject(filters, variantIntervalFeature);
    this.ensureSamplesThenRender(filterTypeName);
  }

  // ---------------------------------------------------------------------------

  @alias('args.userSettings.requestFormat') requestFormat;
  /** The user can choose the format of information to request from bcftools,
   * which is associated with a corresponding Renderer.
   * @param requestFormat : string : 'CATG', 'Numerical'
   */
  requestFormatChanged(value) {
    dLog('requestFormatChanged', value);
    Ember_set(this, 'args.userSettings.requestFormat', value);
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
    blocksF = this.blocksSampleFilters('haplotype');
    return blocksF;
  }
  /** Collate sample filters across axisBrushes[].block
   * @return [ {block, [filterTypeName] : sample filters of block for filterTypeName }, ... ]
   * - parallel to axisBrushes.
   */
  blocksSampleFilters(filterTypeName) {
    const
    fnName = 'blocksSampleFilters',
    axisBrushes = this.brushedOrViewedVCFBlocks,  // maybe : Visible
    /* .sampleFilters.[filterTypeName]. replaces .haplotypeFilters and .featureFilters
     * - only 1 filterTypeName is used at a time */
    blocksF = axisBrushes.map(
      (ab) => ({
        block : ab.block,
        sampleFilters : {
          [filterTypeName] : this.blockSampleFilters(ab.block, filterTypeName)}}));
    dLog(fnName, filterTypeName, axisBrushes, blocksF);
    return blocksF;
  }
  /** Surface the details of the selected SNPs, to check result of
   * sampleFiltersCopyType().
   * This is similar to blocksSampleFilters(), but has a different use.
   */
  sampleFiltersCheck() {
    const
    blocks = this.gtBlocks,
    sampleFilters = blocks.map(block => {
      const
      sf = block[sampleFiltersSymbol],
      features = this.blockSampleFilters(block, 'feature'),      
      featuresDesc = features.map(feature => [
        feature.get('blockId.brushName'),
        feature.value_0,
        feature[matchRefSymbol],
      ]);
      return featuresDesc;
    });
    return sampleFilters;
  }
  /** @return array of blocks and the features selected on them for filtering samples.
   */
  @computed('brushedOrViewedVCFBlocks')
  get blocksFeatureFilters() {
    const
    blocksF = this.blocksSampleFilters('feature');
    return blocksF;
  }
  /** @return array of blocks and the variantIntervals selected on them for filtering samples.
   */
  @computed('brushedOrViewedVCFBlocks')
  get blocksVariantIntervalFilters() {
    const
    blocksF = this.blocksSampleFilters('variantInterval');
    return blocksF;
  }
  /** Blocks of selected Variant Intervals  */
  @computed(
    'brushedOrViewedVCFBlocks',
    // .viewed[] for the variantInterval (non-VCF) blocks
    'blockService.viewed.length',
    'sampleFiltersCount.variantInterval')
  get blocksVariantInterval() {
    const
    blocksF = this.blocksSampleFilters('variantInterval')
      .mapBy('sampleFilters.variantInterval')
      .flat(),
    /** if VI from multiple blocks of a dataset are selected this will not
     * uniq() the dataset name.
     * feature .blockId is (currently) a Proxy, and each feature of 1 block has a unique Proxy.
     */
    blocks = blocksF.mapBy('blockId')
      .mapBy('content')
      .uniq();
      // .mapBy('datasetId.name');
    return blocks;
  }


  @computed('brushedOrViewedVCFBlocks')
  get brushedOrViewedScope () {
    const fnName = 'brushedOrViewedScope';
    const scope = this.lookupScope || this.brushedOrViewedVCFBlocks.mapBy('scope').uniq();
    dLog(fnName, scope);
    return scope;
  }

  /** Narrow .brushedOrViewedVCFBlocks to those blocks which are visible.
   * Update : also filter by .brushedDomain, because brushedOrViewedVCFBlocks()
   * expects blocks to have .brushedDomain; this also enables users to control
   * which blocks are displayed in the genotype table by brushing or clearing
   * the brush; if instead they would like to see genotypes of blocks which are
   * not brushed, then this filter on .brushedDomain can be moved to
   * vcfGenotypeLookupAllDatasets().
   */
  @computed('brushedOrViewedVCFBlocks')
  get brushedOrViewedVCFBlocksVisible () {
    const
    fnName = 'brushedOrViewedVCFBlocksVisible',
    blocks = this.brushedOrViewedVCFBlocks
      .map(abb => abb.block),
    visibleBlocks = blocks
      .filterBy('visible')
      .filterBy('brushedDomain');
    dLog(fnName, visibleBlocks, blocks);
    return visibleBlocks;
  }

  @alias('brushedOrViewedVCFBlocksVisible') gtBlocks;

  /** genotype datasets on the brushed / viewed axes
   * The result datasets are unique, i.e. a dataset will be appear once in the
   * result although it may contain multiple blocks which are brushed or viewed.
   */
  @computed('brushedOrViewedVCFBlocks')
  get gtDatasets () {
    const
    fnName = 'gtDatasets',
    /** brushedOrViewedVCFBlocksVisible.mapBy('datasetId') are Proxy,
     * which is true of both its sources : .viewedVCFBlocks and .brushedVCFBlocks.
     * so use .content
     */
    gtDatasets = this.brushedOrViewedVCFBlocksVisible.mapBy('datasetId.content')
      .uniq();
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

  get gtDatasetIdsToFilter() {
    const
    fnName = 'gtDatasetIdsToFilter',
    datasetIds = this.gtDatasets
      .filter(dataset => dataset[enableFeatureFiltersSymbol])
      .mapBy('id');
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
        /** The above sets @active of the <nav.item > i.e. <li>, but the class
         * active is not added, perhaps because it has already rendered.  So use
         * datasetTabActiveClass() for the initial render; after that the user
         * clicks on the tab which sets active class OK. There is hopefully a
         * more elegant way to do this.
         */
        this.datasetTabActiveClass();
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

  /** @return the {axisBrush, vcfBlock} selected via the GUI,
   * dataset tabs (originally a pull-down).
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
  // @computed('axisBrushBlock')
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
  @computed('lookupBlock', 'args.userSettings.selectedDataset')
  get lookupDatasetId() {
    const b = this.lookupBlock;
    const datasetId = this.args.userSettings.selectedDataset?.id || b?.get('datasetId.id');
    return datasetId;
  }
  /** Scope of lookupBlock, which used to identify the (reference) chromosome in
   * request to genotype database, e.g. bcftools
   */
  @computed('lookupBlock')
  get lookupScope() {
    const b = this.lookupBlock;
    /** Using .name instead of .scope : .scope is the Pretzel scope and is used
     * to align datasets on axes (i. match dataset block and parent block);
     * originally the Pretzel convention was 1A but that has shifted to Chr1A to
     * align with other databases; external databases such as blast ndb, VCF
     * files and Dawn may have a different chromosome name, typically VCF files
     * use 'chr' as the prefix; this is recorded in block .name.
     */
    return b?.get('name');
  }

  @tracked filterErrorText = null;
  /** @return an array of samples which are common to the viewed datasets
   * @desc
   * related : vcfGenotypeSamples
   */
  get sampleNamesIntersection() {
    const
    fnName = 'sampleNamesIntersection',
    /** Could ensure samples are loaded for each of the viewed VCF datasets
     * using .vcfGenotypeSamplesAllDatasets().
     */
    datasetSamples =
      Object.values(this.sampleCache.sampleNames)
      .map(value => this.samplesFromText(value));
    let commonSamples;

    const filterText = this.sampleNameFilter;
    if (filterText) {
      let regexp;
      function matchSample(sample) {
        return sample.match(regexp)?.[0];
      }
      this.filterErrorText = null;
      try {
        regexp = new RegExp(filterText, 'i');
      } catch (error) {
        dLog(fnName, filterText, error.toString());
        this.filterErrorText = error.toString();
        return [];
      }
      const
      matched = datasetSamples.map(samples => samples.map(matchSample)),
      matchedFiltered = matched?.map(matches => matches.filter(match => match)),
      commonMatches = intersection.apply(undefined, matchedFiltered),
      commonMatchesSet = new Set(commonMatches),
      commonSamplesAll = datasetSamples.map(
        datasetSamples_i => datasetSamples_i.map((sample, i) => 
          commonMatchesSet.has(matchSample(sample)) ? sample : null)
          .filter(sample => sample));
      commonSamples = intersection.apply(undefined, commonSamplesAll);
      dLog(fnName, commonSamples);
    } else {
      commonSamples = intersection.apply(undefined, datasetSamples);
    }
    return commonSamples;
  }
  /** Get the selected sample names for lookupBlock / lookupDatasetId.
   * Not used, instead vcfGenotypeSamplesSelectedAll() is used directly instead
   * in vcfGenotypeSamplesSelected().
   * @return for .lookupDatasetId selected by user, the sampleNames array
   * received, and the .selectedSamples the user has selected from those.
   */
  @computed('lookupDatasetId', 'receivedNamesCount')
  get lookupBlockSamples() {
    /** related : datasetStoreSampleNames() */
    const names = this.sampleCache.sampleNames[this.lookupDatasetId];
    let selected = this.vcfGenotypeSamplesSelectedAll[this.lookupDatasetId];
    /* If sampleNames are cached for lookupDatasetId and none are selected, copy
     * (initial) samples to selected. */
    if (false && names?.length && ! selected) {
      selected = names.slice(0, 256).split('\n').slice(0, 6).join('\n');
      this.vcfGenotypeSamplesSelected = selected;
    }
    return {names, selected};
  }

  /** If the current brushed domain does not include selected SNPs, return null,
   * otherwise lookup the cached samples filtered for those SNPs.
   * If that value is not cached the result is `undefined`.
   */
  blockFilteredSamplesGet(vcfBlock) {
    const
    fnName = 'blockFilteredSamplesGet',
    selectedSNPs = this.selectedSNPsInBrushedDomain(vcfBlock);
    let sampleNames;
    if (selectedSNPs?.length) {
      const
      filterDescription = this.selectedSNPsToKeyWithSortAndMap(selectedSNPs),
      cacheFiltered = this.sampleCache.filteredByGenotype,
      blockFiltered = cacheFiltered[vcfBlock.id];
      sampleNames = blockFiltered?.[filterDescription];
      dLog(fnName, vcfBlock.name, sampleNames?.length, filterDescription, selectedSNPs, vcfBlock.brushName, 'FilteredSamples');
    } else {
      sampleNames = null;
    }
    return sampleNames;
  }

  /** If there are selected SNPs defined in the brushed domains on multiple
   * brushed blocks of this dataset, intersect the filtered samples of each
   * block.
   * If there are no such selected SNPs, default to the full list of
   * samples of this dataset.
   * @return array of sample names
   */
  datasetFilteredSamplesGet(datasetId) {
    const
    blocks = this.brushedVCFBlocks.filter(ab => ab.block.get('datasetId.id') == datasetId),
    /** For any blocks which are filtered by selected SNPs, intersect them
     * ! intersection indicates the dataset samples should not be reduced.
     */
    sampleNamesSet = blocks.reduce((intersection, aBlock, i) => {
      /** samples is undefined if the result is not yet received. */
      const samples = this.blockFilteredSamplesGet(aBlock.block);
      if (i === 0) {
        // if samples === undefined perhaps []
        if (samples) {
          intersection = new Set(samples);
        }
      } else if (samples) {
        const set = new Set(samples);
        intersection = intersection ? intersection.intersection(set) : set;
      }
      return intersection;
    }, undefined),

    /** If ! sampleNamesSet, default to all samples of datasetId.
     * empty Set -> return []
     */
    sampleNames = sampleNamesSet ? Array.from(sampleNamesSet) : 
      this.sampleCache.sampleNames[datasetId]?.trim().split('\n');
    return sampleNames;
  }

  /** @return sample names in .vcfGenotypeSamplesText
   */
  samplesFromText(text) {
    const
    samples = text?.split('\n')
    ;//.map((name) => ({name, selected : false}));
    // text ends with \n, which creates '' at the end of the array, so pop that.
    if ((samples?.length && (samples[samples.length-1]) === '')) {
      dLog('samples', samples.length && samples.slice(samples.length-2, samples.length));
      samples.pop();
    }

    return samples;
  }
  /** If userSettings.samplesIntersection return .sampleNamesIntersection, otherwise 
   * the samples of lookupDatasetId, filtered if .filterSamplesByHaplotype
   * @return Array. The result is defined.
   */
  @computed(
    'vcfGenotypeSamplesText',
    'args.userSettings.samplesIntersection',
    'sampleNameFilter',
    /** These 5 dependencies relate to filterSamplesByHaplotype;
     * possibly split this out as a separate CP samplesFilteredByHaplotype */
    'args.userSettings.filterSamplesByHaplotype',
    'args.userSettings.matchHet',
    'snpsInBrushedDomain.length',
    /** update when new results in sampleCache.filteredByGenotype */
    'sampleCache.filteredByGenotypeCount',
    'lookupBlock',
    'receivedNamesCount',
  )
  get samples() {
    const
    /** Return [] if the value is undefined :
     * - datasetFilteredSamplesGet() may return undefined
     * - .vcfGenotypeSamplesText may be undefined, in which case
     * samplesFromText(.vcfGenotypeSamplesText) returns undefined
     */
    samples = this.args.userSettings.samplesIntersection ?
      this.sampleNamesIntersection :
      (this.args.userSettings.filterSamplesByHaplotype ? this.datasetFilteredSamplesGet(this.lookupDatasetId) :
       this.samplesFromText(this.vcfGenotypeSamplesText)) || [];
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
    selectedSamples = $(event.target).val();
    this.selectSampleArray(selectedSamples, true);
  }
  /**
   * @param selectSampleArray array of text sample names
   * @param add true for add, false for remove
   */
  selectSampleArray(selectedSamples, add) {
    const functionName = add ? 'addObjects' : 'removeObjects';
    if (! this.selectedSamples) {
      this.selectedSamples = selectedSamples;
    } else {
      this.selectedSamples[functionName](selectedSamples);
    }
    if (! this.selectedSamplesText) {
      if (selectedSamples.length) {
        this.selectedSamplesText = selectedSamples.join('\n');
      }
    } else if (selectedSamples.length) {
      const
      /** previous selected samples, possibly edited by user.
       * Can use the same parsing as sampleNameListInput().  */
      editedSamples = this.sampleNameListInputParse(this.selectedSamplesText);

      // Using .addObjects removes duplicates, which string concatenation wouldn't do.
      // .addObjects and .removeObjects match strings by == (not ===).
      this.selectedSamplesText = editedSamples[functionName](selectedSamples).join('\n');
    }
  }

  /**
   * @return undefined if .samples is undefined
   */
  @computed('samples', 'namesFilters.nameFilterArray')
  get filteredSamples() {
    // filtering is already applied in sampleNamesIntersection()
    if (this.args.userSettings.samplesIntersection) {
      return this.samples;
    }
    const
    fnName = 'filteredSamples',
    nameFilterArray = this.namesFilters.nameFilterArray,
    filteredSamples = this.samples?.filter(
      sampleName => this.namesFilters.matchFilters(
        sampleName, nameFilterArray,
        /*this.caseInsensitive*/ true,
        /*this.searchFilterAll*/ true));
    return filteredSamples;
  }

  /* related user actions :
   *  change filter : doesn't change selectedSamples{,Text}
   *  user select -> append to selectedSamples ( -> selectedSamplesText)
   *  paste -> (selectedSamplesText and) selectedSamples
   */
  @alias('args.userSettings.selectedSamplesText') selectedSamplesText;

  /** parse the contents of the textarea
   * This partially overlaps with namesTrim() (utils/string.js),
   * which doesn't split into an array, but does remove additional cases of whitespace.
   * @param value text contents of <Textarea>
   * @return sample names array
   */
  sampleNameListInputParse(value) {
    const
    fnName = 'sampleNameListInputParse',
    /** empty lines are invalid sample names, so trim \n and white-space lines */
    selected = value
      .trimEnd(/\n/)
      .split(/\n *\t*/g)
      .uniq()
      .filter((name) => !!name);
    dLog(fnName, value.length, value.slice(-50), selected.length);
    return selected;
  }
  /** parse the contents of the textarea -> selectedSamples
   */
  @action
  sampleNameListInput(value) {
    const
    selected = this.sampleNameListInputParse(value);
    this.selectedSamples = selected;
  }
  /** Number of newlines in .selectedSamplesText when sampleNameListInputKey()
   * was last called.
   */
  selectedSamplesTextLines = null;
  /** Called by {{ on 'input' }} (equivalent to oninput=) - any user edit key.
   * Set this.selectedSamplesText to value.
   * If edit is substantial, e.g. changes # lines, then sampleNameListInput().
   */
  @action
  sampleNameListInputKey(value) {
    const fnName = 'sampleNameListInputKey';
    this.selectedSamplesText = value;
    const
    /** When Backspace or Delete removes the content of a line but not the
     * newline, it would be good to update, i.e. exclude blank lines from the
     * count. */
    lines = stringCountString(value, '\n');
    dLog(fnName, value.length, lines, this.selectedSamplesTextLines);
    /* After Ctrl-A Backspace, lines is 0, and often .selectedSamplesTextLines
     * is already 0, so compare .selectedSamples.length also.
     */
    if ((lines != this.selectedSamplesTextLines) || (lines != this.selectedSamples.length) ) {
      this.selectedSamplesTextLines = lines;
      this.sampleNameListInput(value);
    }
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
  @computed('axisBrushService.brushedAxes', 'blockService.viewed.[]')
  get brushedVCFBlocks() {
    const
    fnName = 'brushedVCFBlocks',
    axisBrushes = this.axisBrushService.brushedAxes,
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
  /** @return number of loaded features in brushes of viewed VCF blocks.
   * @desc
   * This is displayed by mapview in Genotypes nav tab badge.
   */
  @computed(
    'brushedVCFBlocks', 'auth.apiStats.vcfGenotypeLookup',
    /* This dependency watches only 5 brushes; if more are required an
     * alternative is a count of vcfGenotypeLookup results received */
    'brushedVCFBlocks.{0,1,2,3,4}.block.features.length')
  get brushedVCFFeaturesCount() {
    const
    count = this.brushedVCFBlocks.mapBy('block.featuresInBrushOrZoom')
      .mapBy('length')
      .reduce((sum, length) => sum += length, 0);

    /* If this Computed Property was constantly exposed / evaluated, it could be
     * used to set args.summaryData.rowCount, instead of being accessed via
     * summaryData.proxy, e.g. via
    later(() => Ember_set(this, 'args.summaryData.rowCount', count));
    */
    return count;
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
        let axisBrushBlockIndex = blocks.findIndex((abb) => abb.block === lookupBlock);
        /** .axisBrushBlockIndex may be -1, when data block is un-viewed while brushed.
         * In this case, if there is another viewed block on the same axis, choose that,
         * else if there are viewed blocks, choose the first one, because
         * .axisBrushBlockIndex === -1 leads to .lookupBlock undefined, which
         * gets undefined block in vcfGenotypeSamples().
         */
        if (axisBrushBlockIndex === -1) {
          axisBrushBlockIndex = blocks.findIndex((abb) => abb.block.referenceBlock === lookupBlock.referenceBlock);
          /** This likely indicates that lookupBlock and its referenceBlock are
           * now un-viewed, so choose one of blocks[].  */
          if (axisBrushBlockIndex === -1) {
            /** name and isViewed */
            function nv(b) { return [b?.isViewed, b?.brushName]; }
            const
            a = [
              fnName, axisBrushBlockIndex, 
              nv(lookupBlock),
              nv(lookupBlock.referenceBlock),
              blocks.mapBy('block').map(nv),
              blocks.mapBy('block.referenceBlock').map(nv)].flat();
            console.debug.apply(undefined, a);
            axisBrushBlockIndex = 0;
          }
        } else if (blocks.length) {
          axisBrushBlockIndex = 0;
        }
        this.axisBrushBlockIndex = axisBrushBlockIndex;
        if (this.axisBrushBlockIndex === undefined) {
          this.args.userSettings.lookupBlock = undefined;
        }
        dLog(fnName, this.axisBrushBlockIndex, blocks[this.axisBrushBlockIndex]?.block.id, blocks, lookupBlock.id);
      } else if ((this.axisBrushBlockIndex === undefined) || (this.axisBrushBlockIndex > blocks.length-1)) {
        /* first value is selected. if only 1 value then select onchange action will not be called.  */
        this.axisBrushBlockIndex = 0;
      }
    }
  }
  /** Return viewed (loaded) VCF blocks
   * Also include a block from genotype-search .selectedDatasetId
   * if that does not already have a viewed block.
   *
   * @return [{axisBrush, vcfBlock}, ...]
   */
  @computed('blockService.viewed.[]', 'args.userSettings.selectedDataset')
  get viewedVCFBlocks() {
    const
    fnName = 'viewedVCFBlocks',
    vcfBlocks = this.blockService.viewed.filter(
      (b) => b.get('isVCF')),
    block2Abb = (block) => ({
      axisBrush : EmberObject.create({block : block.referenceBlock}), block});
    let blocks = vcfBlocks.map(block2Abb);
    const selectedDataset = this.args.userSettings.selectedDataset;
    /** Possibly add a block of selectedDataset to blocks[].
     * Not sure if this is going to be required; currently working OK without it.
     */
    if (false && selectedDataset) {
      const dBlock = selectedDataset.get('aBlock');
      if (dBlock) {
        /** Check if a block in blocks[] is in selectedDataset. viewedVCFBlocks
         * is used to request samples, and for genotype-search .selectedDataset
         * need only be represented in blocks[] once.
         */
        const alreadyPresent = blocks.find(b => b.block.datasetId === dBlock.datasetId);
        if (! alreadyPresent) {
          const dBlockA = [dBlock].map(block2Abb);
          dLog(fnName, dBlock, dBlockA);        
          blocks = blocks.concat(dBlockA);
        }
      }
    }
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
      colour = axis1d ? axis1d.blockColourValue(block) : 'black';
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
   * Result is [{id : datasetId, colour }, ... ]
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
    /** filter out undefined block.axis1d which may occur during block view / unview. */
    axes = vcfBlocks.mapBy('axis1d').filter(a1 => a1).uniq();
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
   * [] if .featureColumnDialogDataset is undefined - dialog is not enabled
   */
  @computed('currentFeaturesValuesFields', 'selectedFeaturesValuesFieldsForDataset.[]')
  get forSelectFeaturesValuesFields() {
    const
    fnName = 'forSelectFeaturesValuesFields',
    datasetId = this.featureColumnDialogDataset,
    current = this.currentFeaturesValuesFields[datasetId],
    selected = this.selectedFeaturesValuesFields[datasetId];
    let unselectedArray = [];
    if (selected) {
      const
      /** Copy current and subtract selected from it, remainder is available for
       * selection */
      unselected = selected.reduce((set, field) => {
        set.delete(field);
        return set;
      }, new Set(current));
      unselectedArray = Array.from(unselected);
    }
    return unselectedArray;
  }  

  /** Set the .selectedFeaturesValuesFields for .featureColumnDialogDataset
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

  //----------------------------------------------------------------------------

  /** Set the enableFeatureFiltersSymbol for gtDatasets from the datasetIds
   * selected by the user.
   */
  @action
  selectDatasetId(event) {
    // Based on @see selectedFieldName().
    const
    fnName = 'selectDatasetId',
    selectedDatasetIds = $(event.target).val(),
    datasets = this.gtDatasets;
    datasets.forEach(
      dataset => dataset[enableFeatureFiltersSymbol] =
        selectedDatasetIds.includes(dataset.get('id')));
    dLog(fnName, selectedDatasetIds,
         datasets.map(dataset => dataset[enableFeatureFiltersSymbol]));
  }

  // ---------------------------------------------------------------------------

  /** dataset parent name of the selected block for lookup.
   * related : mapview : selectedDataset is the reference (parent) of the selected axis.
   */
  @alias('lookupBlock.datasetId.parentName') referenceDatasetName;

  // ---------------------------------------------------------------------------

  get brushedDomain() {
    const
    axisBrush = this.axisBrush,
    /** viewedVCFBlocks() returns a axisBrush with just block.  It is used when
     * .brushedVCFBlocks is [], i.e. axisBrushService.brushedAxes is [], seen
     * when axis reference block (axisBrush.block) is from secondary server,
     * likely ensureAxisBrush(block) is not effectively setting r.block,
     * i.e. axisBrush.block can be null because axisBrush is in the default
     * store, and the reference block is not.
     */
    brushedDomain = axisBrush && (axisBrush.brushedDomain || axisBrush.block?.brushedDomain) ||
      this.axisBrushBlock?.block?.brushedDomain;
    return brushedDomain;
  }
  // Note comment in selectedSampleEffect() re. dependency axisBrush.brushedDomain 
  /** .brushedDomain is not rounded, but could be because base positions are integral.
   * This result is rounded.
   */
  @computed('axisBrush.brushedDomain')
  get brushedDomainLength () {
    let domain = this.brushedDomain;
    if (domain) {
      domain = Math.abs(domain[1] - domain[0]).toFixed();
    }
    return domain;
  }

  @computed('axisBrush.brushedDomain')
  get brushedDomainRounded () {
    /** copied from axis-brush.js */
    let domain = this.brushedDomain;
    if (domain) {
      domain = domain.map((d) => d.toFixed(2));
    }
    return domain;
  }

  /** 
   * dependencies :
   *  brushedDomain : .{0,1} is not required because array is replaced when it changes value.
   *  brushCount : added because .axisBrush may not be updating.
   */
  @computed('axisBrush.brushedDomain', 'axisBrushService.brushCount', 'intervalLimit')
  get vcfGenotypeLookupDomain () {
    /** copied from sequenceLookupDomain() axis-brush.js
     * could be factored to a library - probably 2 1-line functions - not compelling.
     */
    let
    domain = this.brushedDomain,
    domainInteger = domain && 
      (intervalSize(domain) <= this.intervalLimit * 1e6) &&
      domain.map((d) => +d.toFixed(0));
    return domainInteger;
  }

  /** @return array of features in .blocksFeatureFilters which are in .brushedDomain
   */
  selectedSNPsInBrushedDomain(vcfBlock) {
    if (! vcfBlock.brushedDomain) {
      return [];
    }
    let features;
    /** if vcfBlock has no features loaded yet (e.g. zoomed out), then copy the
     * selected SNPs from its referenceBlock.
     */
    if (! vcfBlock[featurePositionsSymbol]) {
      const
      referenceBlock = vcfBlock.referenceBlock,
      sampleFilterTypeName = 'feature',
      sampleFiltersRef = this.blockSampleFilters(referenceBlock, sampleFilterTypeName);
      features = sampleFiltersRef;
    } else {
      features = this.blocksFeatureFilters.findBy('block', vcfBlock)?.sampleFilters.feature;
    }
    features = features
      .filter(f => inRange(f.value_0, vcfBlock.brushedDomain));
    return features;
  }

  /** Construct a text key from the result of this.selectedSNPsInBrushedDomain(vcfBlock)
   *
   * Related : in vcfGenotypeSamplesDataset() : filterByHaplotype has already
   * been through the same sort and map, so selectedSNPsToKey() is used for
   * filterDescription.
   */
  selectedSNPsToKeyWithSortAndMap(selectedSNPs) {
    const
    features = selectedSNPs
      // sort enables filterDescription to be cache key
      .sortBy('value_0')
      .map(f => ({position : f.value_0,  matchRef : f[Symbol.for('matchRef')]})),
    matchHet = this.args.userSettings.matchHet,
    filterDescription = this.selectedSNPsToKey(features, matchHet);
    return filterDescription;
  }
  /** Construct a text key from the result of this.selectedSNPsInBrushedDomain(vcfBlock)
   * @param selected SNPs features sorted by position and mapped as {position, matchRef}
   * @param matchHet @userSettings.matchHet indicates to match samples with a
   * single copy of Alt at the SNP position (i.e. 0.1 or 1.0, where . matches / or |)
   * @return filterDescription
   *
   * This is used to access the blockFiltered cache as blockFiltered[filterDescription]
   * when :
   * - writing to cache in vcfGenotypeSamplesDataset().
   * - reading cache in blockFilteredSamplesGet().
   */
  selectedSNPsToKey(features, matchHet) {
    const
    featuresDescription = features.map(
      h => '' + h.position + ':' + (h.matchRef ? 'Ref' : 'Alt')).join(' '),
    filterDescription = 'matchHet:' + matchHet + ' ' + featuresDescription;
    return filterDescription;
  }

  @computed('lookupBlock.brushedDomain', 'featureFiltersCount')
  get snpsInBrushedDomain() {
    const features = this.selectedSNPsInBrushedDomain(this.lookupBlock);
    return features;
  }

  /** Get samples for dataset for this chromosome / VCF Block, filtered by
   * selected SNPs + genotype values, i.e. haplotypes.
   */
  genotypeSamplesFilteredByHaplotypes(vcfBlock) {
    const
    fnName = 'genotypeSamplesFilteredByHaplotypes',
    filterByHaplotype = ! this.args.userSettings.filterSamplesByHaplotype ? undefined :
      this.selectedSNPsInBrushedDomain(vcfBlock);
    dLog(fnName, vcfBlock.name, filterByHaplotype, 'FilteredSamples');
    if (filterByHaplotype?.length && ! this.blockFilteredSamplesGet(vcfBlock)) {
      later(() => this.vcfGenotypeSamplesDataset(vcfBlock));
    } else if (this.args.userSettings.filterSamplesByHaplotype) {
      // trigger update of samples(); the unfiltered samples are already in cache
      this.sampleCache.incrementProperty('filteredByGenotypeCount');
    }
    return filterByHaplotype;
  }

  // ---------------------------------------------------------------------------

  /** Request the list of samples of vcfBlock.
   * @return undefined if scope or vcfDatasetId are not defined,
   * or a promise yielding received text
   * @param vcfBlock
   */
  vcfGenotypeSamplesDataset(vcfBlock) {
    /** implemented by common/models/block.js : Block.vcfGenotypeSamples().  */
    const
    fnName = 'vcfGenotypeSamplesDataset',
    vcfDataset = contentOf(vcfBlock?.get('datasetId')),
    vcfDatasetId = vcfBlock?.get('datasetId.id'),
    vcfDatasetIdAPI = vcfBlock?.get('datasetId.genotypeId'),
    /** Same comment as in .lookupScope */
    scope = vcfBlock.get('name'),
    /** original discussions mentioned allowMissing; that might be a flag or
     * number; it can be added to filterByHaplotype */
    matchHet = this.args.userSettings.matchHet,
    /** Of the 3 ways to select SNPs for sample sorting / filtering :
     *  - .blocksHaplotypeFilters sampleFilters.haplotype
     *  - .blocksVariantIntervalFilters sampleFilters.variantInterval
     *  - .blocksFeatureFilters .sampleFilters .feature []
     * the latter is the current focus and is handled here.
     * The other 2 also select SNPs so those features can be utilised here.
     */
    filterByHaplotype = ! this.args.userSettings.filterSamplesByHaplotype ? undefined :
      {features : this.selectedSNPsInBrushedDomain(vcfBlock)
       // This matches selectedSNPsToKeyWithSortAndMap().
       // sort enables filterDescription to be cache key
       .sortBy('value_0')
       .map(f => ({position : f.value_0,  matchRef : f[Symbol.for('matchRef')]})),
       matchHet
      },
    filterDescription = filterByHaplotype ?
      this.selectedSNPsToKey(filterByHaplotype.features, matchHet) : '',
    requestDescription = "Fetching accessions for " + vcfBlock.brushName + ' ' + filterDescription;
    dLog(fnName, filterDescription, vcfBlock.brushName, 'FilteredSamples');
    /** There may be multiple concurrent samples requests, so this could be an
     * array, but the requirement is simply to show to the user when there is a
     * samples request in process, as the request may take seconds.
     */
    later(() => Ember_set(this, 'samplesRequestDescription', requestDescription));


    let textP;
    if (scope && vcfDatasetIdAPI)   {
      this.lookupMessage = null;

      textP = this.auth.genotypeSamples(
        vcfBlock, vcfDatasetIdAPI, scope, filterByHaplotype,
        {} );
      textP.then(
        (text) => {
          later(() => Ember_set(this, 'samplesRequestDescription', ''));
          let t = text?.text ?? text;
          /** Germinate result may be received by frontend or server. */
          const isGerminate = resultIsGerminate(t);
          /** trace 5 samples or 60 chars of text */
          dLog(fnName, t?.length ?? Object.keys(text), t?.slice(0, isGerminate ? 5 : 60));
          if (vcfDataset.hasTag('BrAPI')) {
            vcfDataset.samples = t;
            t = t.mapBy('sampleName');
            // instead use : sampleNames = t;
            this.datasetStoreSampleNames(vcfBlock, t);
          }
          let sampleNamesText, sampleNames;
          if (isGerminate) {
            /* result from Germinate is currently an array of string sample names. */
            sampleNamesText = t.join('\n');
            sampleNames = t;
          } else {
            sampleNamesText = t;
            /** trim off trailing newline; other non-sample column info could be
             * removed; it is not a concern for the mapping. */
            sampleNames = (t === '') ? [] : t.trim().split('\n');
          }

          if ((sampleNames?.length > 1e4) &&
              ! this.sampleNameFilter &&
              ((config.environment === 'development') || this.urlOptions.advanced) && 
              navigator.userAgent.includes(' Firefox/')) {
            /** Firefox is currently slow in displaying 30k sample names, so in
             * development limit the length of .filteredSamples, displayed in
             * genotype-samples.hbs <select>
             */
            /* Tried : set up an initial filter.
             * This doesn't apply the filter promptly enough
            this.sampleNameFilter = '111';
            this.nameFilterChanged(this.sampleNameFilter);
            * So instead slice the array.
            */
            sampleNames = sampleNames.slice(0, 2e3);
            sampleNamesText = sampleNames.join('\n');
            dLog(fnName, 'limit sampleNames to', sampleNames.length);
          }

          if (! filterByHaplotype) {
            this.sampleCache.sampleNames[vcfDatasetId] = sampleNamesText;
            this.datasetStoreSampleNames(vcfBlock, sampleNames);
          } else {
            /** If filterSelectedSamples, this case filters the selected samples
             * (.selectedSamples and .selectedSamplesText) to exclude samples
             * not in the query result sampleNames.  This seems to make sense
             * and be ergononomic, but it probably depends on use case - perhaps
             * users will want to hang on to selected samples which are filtered
             * out but are of interest for them.  Not filtering here would
             * enable them to collate the union of a series of queries.
             */
            if (this.selectedSamplesText && this.urlOptions.filterSelectedSamples) {
              this.selectedSamples = this.selectedSamplesText
                .split('\n')
                .filter(sample => sampleNames.includes(sample));
              this.selectedSamplesText = this.selectedSamples
                .join('\n');
            }
            /** The list of available samples is filtered.  */
            const
            cacheFiltered = this.sampleCache.filteredByGenotype,
            blockFiltered = cacheFiltered[vcfBlock.id] || (cacheFiltered[vcfBlock.id] = {});
            blockFiltered[filterDescription] = sampleNames;
            // vcfBlock.filteredSamples = sampleNames;
            // may need to a count to signal dataset update
            this.sampleCache.incrementProperty('filteredByGenotypeCount');
          }
          const
          /** There is an assumption that samples of a VCF dataset are the same
           * for each chromosome.  It is possible to have a distinct .vcf.gz
           * file per chromosome, so they could have distinct sets of sample
           * names, but that seems currently out of scope.
           * If another block of the dataset is viewed, mapSamplesToBlock()
           * should be called for it also; blockSetup() could set up a block CP.
           * Perhaps better to map sampleNames to datasets, and use a function
           * to lookup the viewed blocks of a dataset.
           * Also will move the mapping to a service, e.g. sampleName2Block to
           * services/data/block.
           */
          viewedBlocksOfDataset =
            this.viewedVCFBlocks
            .filter(B => B.block.get('datasetId.id') === vcfDatasetId);
          viewedBlocksOfDataset.forEach(vb =>
            this.mapSamplesToBlock(sampleNames, vb.block));

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

  /** Request the list of samples of the vcf of the brushed block.
   * @return undefined if scope or vcfDatasetId are not defined,
   * or a promise yielding received text
   */
  vcfGenotypeSamples() {
    /** implemented by common/models/block.js : Block.vcfGenotypeSamples().  */
    const
    fnName = 'vcfGenotypeSamples',
    vcfBlock = this.lookupBlock,
    dataset = contentOf(vcfBlock.get('datasetId')),
    textPFn = () => this.vcfGenotypeSamplesDataset(vcfBlock),
    /** The addition of .filterSamplesByHaplotype means result can change,
     * so throttle is not applicable. */
    delaySecs = this.args.userSettings.filterSamplesByHaplotype ? 5 : 2 * 60,
    textP = promiseThrottle(dataset, Symbol.for('samplesP'), delaySecs * 1000, textPFn);
    /* vcfGenotypeSamplesDataset() initialises .vcfGenotypeSamplesSelected in
     * this case; could move to here. */

    return textP;
  }

  /** Request vcfGenotypeSamples for vcf blocks for which
   * vcfGenotypeSamplesText() is not defined,
   * or for which filteredSamples are required and not yet defined.
   */
  vcfGenotypeSamplesAllDatasets() {
    // i.e. gtBlocks
    this.brushedOrViewedVCFBlocksVisible
      .filter(vcfBlock => {
        let filteredSamples;
        const
        vcfDatasetId = vcfBlock?.get('datasetId.id'),
        datasetSamples = (vcfDatasetId && ! this.sampleCache.sampleNames[vcfDatasetId]),
        samples =
          requestSamples = this.args.userSettings.filterSamplesByHaplotype ?
          /* .blockFilteredSamplesGet(vcfBlock) is effectively : this.sampleCache.filteredByGenotype[vcfBlock.id][selected SNPs + genotype values]
           * i.e. the cache key includes the current (user-defined) haplotype
           *
           * If the result is null (there are no selected SNPs in brushed
           * domain) use datasetSamples.  Otherwise the result will be undefined
           * if it is not cached.
           */
        (((filteredSamples = this.blockFilteredSamplesGet(vcfBlock)) === null) ? datasetSamples : filteredSamples) :
          datasetSamples,
        requestSamples = ! samples;
        return requestSamples;
      })
      .forEach(vcfBlock =>
        // returns promise
        this.vcfGenotypeSamplesDataset(vcfBlock));
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

    /** if Common (userSettings.samplesIntersection) and the intersection is
     * empty, will use All+samplesLimit so get samples.
     */
    if ((requestSamplesAll &&
         (requestSamplesFiltered || samplesLimitEnable)) ||
        userSettings.samplesIntersection
       ) {
      dLog('ensureSamples', Object.keys(this.sampleCache.sampleNames));
      this.vcfGenotypeSamplesAllDatasets();
    }
  }

  /** When a dataset tab in the control dialog is displayed, request samples for
   * the dataset if not already done.  
   */
  @computed('lookupDatasetId', 'args.userSettings.filterSamplesByHaplotype')
  get ensureSamplesForDatasetTabEffect() {
    const fnName = 'ensureSamplesForDatasetTabEffect';
    /** Originally vcfGenotypeSamples() was manually triggered by user click;
     * this function is added to improve the ergonomics of the user workflow,
     * i.e. in the dataset tab the user will often want to select from the
     * available samples, so pre-emptively request the samples to reduce button
     * clicks.
     * related : .ensureSamples();
     */
    if (! this.vcfGenotypeSamplesText || this.args.userSettings.filterSamplesByHaplotype) {
      dLog(fnName, new Date().toISOString(), this.lookupBlock?.brushName);
      this.vcfGenotypeSamples();
    }

  }

  //----------------------------------------------------------------------------

  /** block[sampleNamesSymbol] is a map from sampleName to block */
  /** sampleName2Block maps from sampleName to an array of blocks which have
   * features with that sampleName.
   */
  sampleName2Block = {}
  /** Record a mapping from sampleNames to the block which they are within.
   * @param sampleNames []
   * @param block the lookupBlock use in API request which returned the sampleNames
   */
  mapSamplesToBlock(sampleNames, block) {
    sampleNames.forEach((sampleName) => {
      const
      blocks = this.sampleName2Block[sampleName] ||
        (this.sampleName2Block[sampleName] = []);
      blocks.addObject(block);
    });
  }

  /** Map from sampleName to the viewed VCF blocks which contain that sampleName.
   * @return blocks array
   * Result may be [].
   */
  sampleName2Blocks(sampleName) {
    let blocks;
    blocks = this.viewedVCFBlocks.filter(ab =>
      ab.block.get('datasetId.sampleNamesSet')?.has(sampleName))
      .mapBy('block');

    if (! blocks.length && this.sampleName2Block) {
      /** if a block is unviewed it will still be listed in sampleName2Block[].
       */
      blocks = this.sampleName2Block[sampleName];
      if (blocks) {
        blocks = blocks
          .filter(block => block.isViewed);
      }
    }
    /* blocks will be undefined if the sample has not yet been requested,
     * in this case use the brushed/viewed blocks, filtered via datasetId.sampleNames.
     * result may be [].
     */
    if (! blocks) {
      blocks = this.brushedOrViewedVCFBlocksVisible
        .filter(block => {
          const names = block.get('datasetId.sampleNames');
          return names && names.includes(sampleName);
        });
    }
    return blocks;
  }

  //----------------------------------------------------------------------------

  /** For display in dataset tab, show how many selected SNPs affect blocks of .lookupDatasetId
   * - these are the SNPs which will be used by haplotypesSamples() ->
   *  genotypePatternsSamples(), which also uses
   *  selectedSNPsInBrushedDomain(vcfBlock).
   *
   * @return the array of SNPS / features (.length is displayed, the feature
   * details could be displayed in a hover)
   *
   * Related : snpsInBrushedDomain().
   */
  @computed('lookupDatasetId', 'block.brushedDomain', 'featureFiltersCount')
  get featureFiltersCountOfDatasetInBrushedDomain() {
    const
    fnName = 'featureFiltersCountOfDatasetInBrushedDomain',
    // copied from haplotypesSamples().
    aBlocks = this.brushedVCFBlocks.filter(
      ab => ab.block.datasetId.id == this.lookupDatasetId),
    features = aBlocks.reduce((accum, aBlock) =>
      accum.concat(this.selectedSNPsInBrushedDomain(aBlock.block)), []);
    return features;
  }

  /** When the user changes selected SNPs, request unique haplotypes and their samples.
   * @return promise yielding {text } of the API result
   * or throwing null if e.g. there are no SNPs selected.
   */
  @computed('lookupBlock.brushedDomain', 'featureFiltersCount')
  get haplotypesSamples() {
    const
    fnName = 'haplotypesSamples',
    aBlocks = this.brushedVCFBlocks.filter(
      ab => ab.block.datasetId.id == this.lookupDatasetId),
    promises = aBlocks.map(aBlock => {
      const
      vcfBlock = aBlock.block,
      blockGtView = vcfBlock[Symbol.for('block-gt-view')],
      promise = blockGtView && ! blockGtView.isDestroying ?
        blockGtView.genotypePatternsSamples :
        Promise.reject(vcfBlock.brushName + '! blockGtView');
      if (! blockGtView) {
        console.log(fnName, vcfBlock.brushName, '! blockGtView');
      } else if (blockGtView.isDestroying) {
        console.log(fnName, vcfBlock.brushName, 'blockGtView.isDestroying');
        vcfBlock[Symbol.for('block-gt-view')] = null;
      }
      return promise;
    }),
    promise = Promise.all(promises);
    promise.then(result => {
      dLog(fnName, result);
    });

    return promise;
  }



  //----------------------------------------------------------------------------


  /** This is called for brushed VCF blocks.
   * Add a Computed Property genotypeSamplesFilteredByHaplotypes to the block,
   * and assign an attribute selectedSNPCount: {}.
   */
  @action
  blockSetup(vcfBlock) {
    const fnName = 'blockSetup';
    if (! vcfBlock.hasOwnProperty('genotypeSamplesFilteredByHaplotypes')) {
      dLog(fnName, vcfBlock.brushName);
      const
      /** This can also depend on the other 2 filterTypeName-s : variantInterval, haplotype. */
      cp = computed(
        'selectedSNPCount.feature',
        'controls.userSettings.genotype.filterSamplesByHaplotype',
        'controls.userSettings.genotype.matchHet',
        () => this.genotypeSamplesFilteredByHaplotypes(vcfBlock));
      defineProperty(vcfBlock, 'genotypeSamplesFilteredByHaplotypes', cp);

      /** Counts of selected SNPs. indexed by filterTypeName, i.e. contents are
       * {variantInterval, haplotype, feature} */
      vcfBlock.set('selectedSNPCount', {});
    }

  }

  //----------------------------------------------------------------------------

  showError(fnName, error) {
    let message;
    /** As in components/form/base.js : handleError(), see comment there;
     * see also checkError().
     */
    if (! error.responseJSON && error.responseText) {
      message = responseTextParseHtml(error.responseText);
    } else {
      message = error.responseJSON?.error?.message ?? error;
      dLog(fnName, message, error.status, error.statusText);
      if (message?.split) {
        const match = message?.split('Error: Unable to run bcftools');
        if (match.length > 1) {
          message = match[0];
        }
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
    fnName = 'samplesOK',
    userSettings = this.args.userSettings,
    requestSamplesAll = userSettings.requestSamplesAll,
    requestSamplesFiltered = userSettings.requestSamplesFiltered,
    samplesLimit = userSettings.samplesLimit;
    /** If requestSamplesAll and no filter or limit, then result samples is not required, undefined. */
    let ok = requestSamplesAll && ! requestSamplesFiltered && ! limitSamples;
    /** if requestSamplesFiltered or requestSamplesFiltered then determine samplesRaw. */
    if (! ok) {
      if (requestSamplesAll) {
        if (userSettings.samplesIntersection) {
          // .samples in this case is .sampleNamesIntersection
          samplesRaw = this.samples;
        } else if (datasetId) {
          // All sample names received for datasetId.
          // As in vcfGenotypeSamples(). related : lookupBlockSamples(), vcfGenotypeSamplesText().
          // Related : datasetStoreSampleNames().
          samplesRaw = this.sampleCache.sampleNames[datasetId]
            ?.trim().split('\n');
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

    Ember_set(this, 'requestLength.samples', samplesRaw?.length ?? 0);
    if (limitSamples && (samplesRaw?.length > samplesLimit)) {
      samplesRaw = samplesRaw.slice(0, samplesLimit);
      this.samplesLimitMessage = " Samples limited to " + samplesLimit + '.';
    } else {
      this.samplesLimitMessage = null;
    }
    dLog(fnName, 'samplesLimitMessage', this.samplesLimitMessage,
      limitSamples, samplesRaw?.length, samplesLimit);

    /* Handle samplesLimit===0; that may not have a use since the features are
     * already requested without samples. */
    ok ||= (samplesRaw?.length || (limitSamples && !samplesLimit));
    /** result is 1 string of names, separated by 1 newline.  */
    samples = samplesRaw?.join('\n');

    return {samples, samplesOK : ok};
  }

  /** Disable vcfGenotypeLookup button when samples are required and not
   * selected, or previous button action is in process.
   * @return disabled if ! All && no samples selected, or All && Common && no samples to select
   * Also disabled if vcfGenotypeLookup button action is in process.
   *
   * The return value is a text value identifying which condition was not
   * satisfied, for display in the GUI as hover text tooltip when the 'VCF
   * Lookup' button is disabled by this function.
   */
  get vcfGenotypeLookupButtonDisabled() {
    const
    userSettings = this.args.userSettings,
    disabled = 
      (! this.vcfGenotypeLookupDomain && 'Select a region of the axis') ||
      (((! userSettings.requestSamplesAll) && (! this.vcfGenotypeSamplesSelected?.length)) && 'Select Samples') ||
      ((userSettings.requestSamplesAll && userSettings.samplesIntersection && ! this.samples?.length) && 'There are no samples in common') ||
      (this.vcfGenotypeLookupTask.isRunning && 'Lookup is in progress');
    return disabled;
  }

  /** if vcfGenotypeLookupTask is not running, perform it. */
  vcfGenotypeLookup() {
    if (! this.vcfGenotypeLookupTask.isRunning) {
      this.vcfGenotypeLookupTaskInstance = this.vcfGenotypeLookupTask.perform();
    }
  }
  /** Call vcfGenotypeLookupP() in a task - yield the result.
   */
  vcfGenotypeLookupTask = task({ drop: true }, async () => {
    console.log('vcfGenotypeLookupTask');
    let block = await this.vcfGenotypeLookupP();

    return block;
  });
  /** Lookup the genotype for the selected samples in the interval of, depending on autoLookup : 
   * . all visible brushed VCF blocks, or 
   * . the brushed block selected by the currently viewed Datasets tab.
   */
  vcfGenotypeLookupP() {
    const
    fnName = 'vcfGenotypeLookup';
    let promise;
    /** Germinate data is in Nucleotide format (CATG) and Alt / Ref is not
     * currently received from Germinate data / interface, so cannot determine
     * Numerical format (number of copies of Alt).  So request and display CATG.
     */
    if (this.lookupBlock?.hasTag('Germinate')) {
      Ember_set(this, 'args.userSettings.requestFormat', 'CATG');
    }
    if (this.args.userSettings.autoLookup) {
      promise = Promise.all(this.vcfGenotypeLookupAllDatasets());
      const selectFields = this.args.userSettings.passportFields;
      if (selectFields.length) {
        promise = promise.then(() => this.datasetsGetPassportData(selectFields));
      }
    } else {
      promise = this.vcfGenotypeLookupSelected();
      // could also : this.datasetGetPassportData(this.lookupBlock?.get('datasetId.content'), ...)
    }
    return promise;
  }

  //----------------------------------------------------------------------------

  /** Lookup the genotype for the selected samples in the interval of the brushed block,
   * selected by the currently viewed Datasets tab.
   * @return a promise, signalling completion, with response or failure, of the request
   */
  vcfGenotypeLookupSelected() {
    let promise;
    const
    fnName = 'vcfGenotypeLookupSelected',
    /** this.axisBrush.block is currently the reference; lookup the data block. */
    userSettings = this.args.userSettings,
    samplesLimitEnable = userSettings.samplesLimitEnable,
    {samples, samplesOK} = this.samplesOK(samplesLimitEnable),
    domainInteger = this.vcfGenotypeLookupDomain,
    vcfDatasetId = this.lookupBlock?.get('datasetId.genotypeId');
    /* Possibly filter out .lookupBlock if .datasetId positionFilter === false,
     * as is done in vcfGenotypeLookupAllDatasets().
     */
    if (samplesOK && domainInteger && vcfDatasetId) { // && scope
      this.lookupMessage = null;
      let
      scope = this.lookupScope;
      /** .lookupDatasetId is derived from .lookupBlock so .lookupBlock must be defined here. */
      let blockV = this.lookupBlock;
      const intersection = this.intersectionParamsSimple(vcfDatasetId);

      promise = this.vcfGenotypeLookupDataset(blockV, vcfDatasetId, intersection, scope, domainInteger, samples, samplesLimitEnable);
    }
    return promise;
  }
  /** Request VCF genotype for brushed datasets which are visible
   * @return an array of promises, signalling completion, with response or failure, of the requests
   */
  vcfGenotypeLookupAllDatasets() {
    let promises;
    // related : notes in showSamplesWithinBrush() re. isZoomedOut(), .rowLimit.
    const
    visibleBlocks = this.brushedOrViewedVCFBlocksVisible,
    blocks =
      visibleBlocks
    /** filter out blocks which are `minus` in the positionFilter - if requested
     * the result should be empty.
     * See table in vcfGenotypeLookupDataset().
     */
      .filter(block => {
        const dataset = block.get('datasetId.content');
        return dataset.positionFilter !== false;
      });
    let flags;
    const
    choose = this.positionFiltersChoose(visibleBlocks, blocks);
    if (choose) {
      const {requiredBlock, notSelf, k} = choose;
      /** Requirement : request calls data for SNPs at which requiredBlock and k
       * other blocks have data.
       * Design : from visibleBlocks - requiredBlock, choose groups of k
       */
      const
      flags = '' + (k+1), /*-n*/
      /** (visibleBlocks - requiredBlock) C k */
      groups = arrayChoose(notSelf, k),
      groupsP = groups.map(group => {
        /** group combined with requiredBlock */
        const selfAnd = group.concat([requiredBlock]);
        return this.vcfGenotypeLookupGroup(selfAnd, flags);
      });
      promises = groupsP.flat();
    } else {
      promises = this.vcfGenotypeLookupGroup(blocks, /*flags*/undefined);
    }
    return promises;
  }
  /** Request genotype calls for blocks.
   * @param blocks
   * @param flags for intersection, bcftools isec.
   * Defined if choose, otherwise intersectionParamsSimple() is used.
   * @return an array of promises, signalling completion, with response or failure, of the requests
   */
  vcfGenotypeLookupGroup(blocks, flags) {
    const
    promises = blocks
      .map((blockV, i) => {
        const
        vcfDatasetId = blockV.get('datasetId.id'),
        vcfDatasetIdAPI = blockV.get('datasetId.genotypeId'),
        /** use .name instead of .scope, because some VCF files use 'chr' prefix
         * on chromosome name e.g. chr1A, and .name reflects that;
         * as in lookupScope().
         */
        scope = blockV.name,
        userSettings = this.args.userSettings,
        samplesLimitEnable = userSettings.samplesLimitEnable,
        {samples, samplesOK} = this.samplesOK(samplesLimitEnable, vcfDatasetId),
        /** related : .vcfGenotypeLookupDomain */
        domain = blockV.get('brushedDomain'),
        /** as in vcfGenotypeLookupDomain() and brushedDomainRounded() */
        domainInteger = domain.map((d) => d.toFixed(0));
        let promise;
        /* samplesOK() returns .samples '' if none are selected; passing
         * vcfGenotypeLookupDataset( samples==='' ) will get all samples, which
         * may be valid, but for now skip this dataset if ! .length.
         */
        if (this.args.userSettings.requestSamplesAll || samples.length) {
          const
          intersection = flags ?
            {datasetIds : blocks.mapBy('datasetId.genotypeId'), flags} :
          this.intersectionParamsSimple(vcfDatasetId);

          promise = this.vcfGenotypeLookupDataset(
            blockV, vcfDatasetIdAPI, intersection,
            scope, domainInteger, samples, samplesLimitEnable);
        }
        return promise;
      });
    return promises.filter(p => p);
  }
  /** Send API request for VCF genotype of the given vcfDatasetId.
   * If scope is defined it indicates which scope / chromosome of vcfDatasetId,
   * should be searched; otherwise search all scopes of the dataset.
   * blockV.scope === scope.
   * @param blockV  brushed / Viewed visible VCF / Genotype Block
   *   (from .lookupBlock or .brushedOrViewedVCFBlocksVisible)
   * blockV is undefined and not used if scope is not defined.
   * @param vcfDatasetId one of the VCF genotype datasets on the brushed axis
   * This is the API id, i.e. .genotypeId, not dataset .id
   * i.e. this is blockV.datasetId.genotypeId
   * [genotype-search] : scope is not defined and vcfDatasetId is dataset.
   * @param intersection return calls for SNPs which have positions in these datasets.
   * {datasetIds, flags} or undefined.  
   *   .datasetIds includes this one (vcfDatasetId).
   *   .flags : for bcftools isec, without the -n.
   * @param scope of the brushed axis
   * @param domainInteger brushed domain on the axis / parent
   * domainInteger is not applicable if scope is undefined, so this parameter is
   * used in that case to carry {datasetVcfFiles, snpNames} from genotype-search.
   * @param samples selected samples to request
   * @param samplesLimitEnable  .args.userSettings.samplesLimitEnable
   *
   * @return promise signalling response or failure.
   * promise yields : scope ? text of response : array of text responses, 1 per chromosome matching snpNames.
   */
  vcfGenotypeLookupDataset(blockV, vcfDatasetId, intersection, scope, domainInteger, samples, samplesLimitEnable) {
    const fnName = 'vcfGenotypeLookupDataset';
    let dataset;
    // equivalent : (typeof dataset !== 'string' && dataset.constructor.modelName === 'dataset')
    if (! scope) {
      dataset = vcfDatasetId;
      vcfDatasetId = dataset.id;
    }
    let resultP;
    /*if (scope)*/ {
      const
      userSettings = this.args.userSettings,
      requestFormat = this.requestFormat,
      requestSamplesFiltered = userSettings.requestSamplesFiltered,
      /** If filtered or column-limited, then samples is a subset of All. */
      requestSamplesAll = userSettings.requestSamplesAll && ! requestSamplesFiltered && ! samplesLimitEnable,
      snpPolymorphismFilter = userSettings.snpPolymorphismFilter,
      mafThreshold = userSettings.mafThreshold,
      mafUpper = userSettings.mafUpper,
      featureCallRateThreshold = userSettings.featureCallRateThreshold,
      /** related : genotypeSNPFilters() */
      requestOptions = {
        requestFormat, requestSamplesAll, snpPolymorphismFilter,
        mafThreshold, mafUpper, featureCallRateThreshold,
      },
      x=0;

      if (intersection) {
        requestOptions.isecDatasetIds = intersection.datasetIds;
        requestOptions.isecFlags = '-n' + intersection.flags;
      }
      if (userSettings.minAlleles !== '') {
        requestOptions.minAlleles = userSettings.minAlleles;
      }
      if (userSettings.maxAlleles !== '') {
        requestOptions.maxAlleles = userSettings.maxAlleles;
      }
      if (userSettings.typeSNP) {
        requestOptions.typeSNP = userSettings.typeSNP;
      }

      if (blockV) {
        addGerminateOptions(requestOptions, blockV);
      }

      const requestP = () => {
        const textP = vcfGenotypeLookup(
          this.auth, samples, domainInteger, requestOptions,
          vcfDatasetId, scope, this.rowLimit);
        // re-initialise file-anchor with the new @data
        /* file-anchor param data should be a defined array ; its init() does this.get("data").reduce. */
        this.vcfExportText = [];
        textP.then(
          this.vcfGenotypeReceiveResult.bind(this, scope ? blockV : dataset, requestFormat, userSettings))
          .catch(this.showError.bind(this, fnName));
        return textP;
      };

      if (scope) {
        const textP = requestP();
        resultP = textP;
      } else {
        const searchScope = domainInteger;
        /** perhaps reduceInSeries(array, elt2PromiseFn, starting_promise */
        const textsP = searchScope.datasetVcfFiles.map(fileName =>
          {requestOptions.datasetVcfFile = fileName; return requestP(); });
        /** Currently in this context Promise is RSVP, which doesn't have Promise.allSettled().
         * Update : Promise now has .allSettled, at least in current Firefox.
         * The ternary expression is used here because (Promise.allSettled || allSettled)(textsP) gets :
         *   Uncaught TypeError: Receiver of Promise.allSettled call is not a non-null object
         * where Receiver is the 'this' argument.
         */
        resultP = Promise.allSettled ? Promise.allSettled(textsP) : allSettled(textsP);
      }
    }
    return resultP;
  }
  /** Construct isec params for a lookup of vcfDatasetId, if required.
   * If datasets other than this one (vcfDatasetId) have defined positionFilter,
   * result datasetIds is those datasets, and this one (vcfDatasetId).
   * Result .flags is '1' for vcfDatasetId and datasets with .positionFilter true,
   * and '0' for those with .positionFilter false.
   *
   * This is simple intersection : the positionFilter for each dataset is
   * independent, i.e. just true/false/undefined.  This was implemented first.
   * In the more complex case, implemented via arrayChoose(), one dataset is
   * required, with groups of k other datasets.
   *
   * @return intersection { datasetIds, flags }
   */
  intersectionParamsSimple(vcfDatasetId) {
    let intersection;
    const
    /** Datasets selected for intersection.
     * Used to indicate if any positionFilter are defined and hence isecFlags
     * and isecDatasets will be set.  If no datasets other than this one
     * (vcfDatasetId) have positionFilter, then isec is not required.
     * If any datasets have numeric positionFilter, then requiredBlock is
     * defined and this function intersectionParamsSimple() is not used -
     * instead arrayChoose() is used.
     */
    isecDatasetsNotSelf = this.gtDatasets
      .filter(dataset =>
        ('boolean' === typeof dataset.positionFilter) &&
          (dataset.genotypeId !== vcfDatasetId));
    if (isecDatasetsNotSelf.length) {
      const
      /** filter out null and undefined; include vcfDatasetId i.e. the dataset
       * which is being requested.
       * 
       * table value indicates if dataset should be included in isecDatasets.
       * |------------------------+-------------------------------+-------|
       * |                        | (dataset.genotypeId === vcfDatasetId) |
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
            (dataset.genotypeId === vcfDatasetId)),
      isecDatasetIds = isecDatasets
        .mapBy('genotypeId'),
      /** in isecDatasets[] dataset positionFilter is only nullish at this
       * point if dataset.genotypeId is vcfDatasetId - use flag true in that case. */
      flags = isecDatasets.map(dataset => dataset.positionFilter ?? true),
      allTrue = flags.findIndex(flag => !flag) === -1,
      isecFlags = allTrue ? isecDatasetIds.length :
        '~' + flags.map(flag => flag ? '1' : '0').join('');
      intersection = {
        datasetIds : isecDatasetIds,
        flags : /*'-n' +*/ isecFlags};
    }
    return intersection;
  }

  /**
   * @param blockV  dataset in the case of [genotype-search], otherwise blockV
   */
  vcfGenotypeReceiveResult(blockV, requestFormat, userSettings, text) {
    const
    fnName = 'vcfGenotypeReceiveResult',
    isGerminate = resultIsGerminate(text),
    isBrapi = resultIsBrapi(text),
    callsData = (isGerminate || isBrapi) && text;
    if (isGerminate) {
      text = callsData.map(snp => Object.entries(snp).join('\t')).join('\n');
      dLog(fnName, text.length, callsData.length);
    } else if (isBrapi) {
      /* .variantDbIds is undefined if there are no variants in range. */
      text = callsData.variantDbIds?.map((variantDbId, i) => {
        const
        chrPosId = [
          blockV.get('name'),
          variantDbId.replace(/.*_/, ''),
          variantDbId],
        cols = chrPosId.concat(callsData.dataMatrices[0].dataMatrix[i]);
        return cols.join('\t');
      }).join('\n')
        || '';
      // it looks like empty result is : { dataMatrices : [], ... }
      dLog(fnName, text.length, callsData.variantDbIds?.length, callsData.dataMatrices[0]?.dataMatrix?.length);
    }
    // displays vcfGenotypeText in textarea, which triggers this.vcfGenotypeTextSetWidth();
    this.vcfGenotypeText = text;
    blockV[Symbol.for('vcfGenotypeText')] = text;
    this.headerTextP?.then((headerText) => {
      const
      /** blockV is passed to combineHeader() instead of text, to enable it to
       * prepend blockV.name */
      combined = ! headerText ? this.vcfGenotypeText :
        this.combineHeader(headerText, [blockV])
      /** ember-csv:file-anchor.js is designed for spreadsheets, and hence
       * expects each row to be an array of cells.
       */
            .map((row) => [row]);
      // re-initialise file-anchor with the new @data
      later(() => this.vcfExportText = combined, 1000);
    });

    // [genotype-search] does not apply to addFeaturesGerminate().
    dLog(fnName, text.length, text && text.slice(0,200), blockV?.get('id'));
    /* commented out the &&blockV 'Jun  6 22:30' after undefined blockV logged in 2024Jun04. is that permitted in one of these cases isBrapi / isGerminate ? */
    if (! blockV) {
      dLog(fnName, 'blockV', blockV, isBrapi, isGerminate);
    }
    if (text /*&& blockV*/) {
      setFrameworkFunctions({Ember_get, Ember_set});
      const
      replaceResults = this.args.userSettings.replaceResults,
      nSamples = this.controls.view.pathsDensityParams.nSamples,
      germinateOptions = {nSamples},
      added = isBrapi ?
        addFeaturesBrapi(blockV, requestFormat, replaceResults, this.selectedService, callsData, germinateOptions) : isGerminate ?
        addFeaturesGerminate(blockV, requestFormat, replaceResults, this.selectedService, callsData, germinateOptions) :
        addFeaturesJson(blockV, requestFormat, replaceResults, this.selectedService, text),
      options = {requestSamplesAll : userSettings.requestSamplesAll, selectedSamples : added.sampleNames /*this.selectedSamples*/};
      featuresSampleMAF(added.createdFeatures, options);

      if (added.createdFeatures && added.sampleNames) {
        /* Update the filtered-out samples, including the received data,
         * for the selected haplotypeFilters.
         * The received data (createdFeatures) is in lookupBlock, so could
         * limit this update to lookupBlock.
         * showHideSampleFn is passed undefined - this is just updating
         * the sample status, and table display is done by
         * showSamplesWithinBrush().
         */
        this.filterSamples(/*showHideSampleFn*/undefined, /*matrixView*/undefined);

        if (added.resultBlocks) {
          /** param of blockViewAndBrush() is [block, featuresDomain] */
          Array.from(added.resultBlocks.entries()).forEach(this.blockViewAndBrush.bind(this));
          /** In this case, genotype-search is searching just 1 dataset, so
           * resultBlocks are expected to be in that dataset.
           * text is from a single VCF lookup; so although in other cases
           * dataset intersection can be used, resultBlocks are still expected
           * to be in a single dataset.
           */
        }

        const scope = blockV.get('scope');
        /* for components/panel/genotype-search.js */
        if (! scope) {
          added.createdFeatures.forEach(f => {
            this.transient.showFeature(f, true);
          });
        }

        /** displayed in genotype-search */
        const resultCounts = userSettings.resultCounts;
        if (resultCounts) {
          resultCounts.blocks++;
          resultCounts.features += added.createdFeatures.length;
          dLog(fnName, resultCounts, 'createdFeatures.length', added.createdFeatures.length);
        }

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
        /* The request was successful, so close the controls dialog.
         * Originally (until 8e2d8ff1) the dialog remained open if no features were received.
         */
        // equivalent : displayData[0].features.length
        /*if (added.createdFeatures.length)*/ {
          this.showInputDialog = false;
        }
        /** added.sampleNames is from the column names of the result,
         * which should match the requested samples (.vcfGenotypeSamplesSelected).
         */
      }
    }

  }

  /** For the dataset selected in the datasets tab, return the brushed and
   * visible blocks of the dataset.
   * This is used in vcfExportTextP() to construct the VCF Download.
   * @return [block, ...]
   */
  @computed('lookupBlock')
  get lookupDatasetBlocks() {
    const
    vcfDataset = this.lookupBlock?.get('datasetId'),
    vcfDatasetId = this.lookupBlock?.get('datasetId.genotypeId'),
    blocks = this.brushedOrViewedVCFBlocksVisible.filterBy('datasetId.id', vcfDatasetId);
    return blocks;
  }

  //----------------------------------------------------------------------------

  blockViewAndBrush([block, featuresDomain]) {
    const fnName = 'blockViewAndBrush';
    /* this works, but is already achieved by loadBlock() : viewRelatedBlocks(block)
     *  this.blockService.setViewed(block.id, true);
     */
    if (! block.isViewed) {
      this.args.loadBlock(block, true);
    }
    pollCondition(250, () => block.axis1d, () =>
      this.blockBrushDomain(block, featuresDomain));
  }
  blockBrushDomain(block, featuresDomain) {
    const fnName = 'blockBrushDomain';
    /** caller blockViewAndBrush() ensures this via pollCondition(, () => block.axis1d, ) */
    if (! block.axis1d) {
      console.warn(fnName, block.brushName);
    } else {
      const referenceBlock = block.referenceBlock;
      this.blockService.pathsPro.ensureAxisBrush(referenceBlock);
      later(() => {
        if (! block.axis1d || block.axis1d.isDestroying) {
          dLog(fnName, block.id, 'axis1d', block.axis1d);
        } else {
          this.blockSetBrushedDomain(block, featuresDomain);
        }
      }, 2000);
    }
  };

  blockSetBrushedDomain(block, featuresDomain) {
    const
    fnName = 'blockSetBrushedDomain',
    abs = this.axisBrushService,
    /** for viewing in console. abb is defined after .brushedDomain is set.
     * (services/data/axis-brush.js : brushedAxes() filters by .brushedDomain )
     * then abb === axis1d.axisBrushObj, 
     */
    abb = abs.brushesByBlock[block.referenceBlock.id],
    axis1d = block.axis,
    brushRange = featuresDomain.map(axis1d.y);
    axis1d.set('brushedRegion', brushRange);
    dLog(fnName, brushRange, featuresDomain, block.brushName, abs.brushesByBlock,
         abb === axis1d.axisBrushObj, axis1d.axisBrushObj);
    /** Use Ember.set() because .brushedDomain is used in a tracking context. */
    Ember_set(axis1d.axisBrushObj, 'brushedDomain', featuresDomain);
    this.axisBrushService.incrementProperty('brushCount');
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

  /** If the user has selected a positionFilter and given it a numeric value 'chooseK',
   * collated and return values used in implementing the filter, used in
   * featureFilterPre() and vcfGenotypeLookupAllDatasets().
   * @return {requiredBlock, notSelf, k} 
   * or undefined if the user has not selected a positionFilter and given it a
   * numeric value 'chooseK'.
   * 
   * The meaning of the filter is : Features / SNPs at which requiredBlock and k
   * other blocks have data.
   *
   * @param visibleBlocks VCF / genotype blocks displayed in the table
   * @param blocks  blocks with positionFilter.
   * This is a subset of visibleBlocks, and can be equal; it is used for
   * searching for requiredBlock, and using visibleBlocks would be equivalent.
   */
  positionFiltersChoose(visibleBlocks, blocks) {
    let choose;
    const
    fnName = 'positionFiltersChoose',
    requiredBlock = blocks.find(b => typeof b.get('datasetId.positionFilter') === 'number');
    if (requiredBlock) {
      const
      /** visibleBlocks, excluding requiredBlock */
      notSelf = visibleBlocks.filter(b => b !== requiredBlock),
      /** chooseK is input via GUI : panel/dataset-intersection-dialog : input chooseK */
      chooseK = requiredBlock.get('datasetId.positionFilter') || 1,
      k = Math.min(notSelf.length, chooseK);
      choose = {requiredBlock, notSelf, k};
      dLog(fnName, requiredBlock.brushName, notSelf.mapBy('brushName'), k, visibleBlocks.mapBy('brushName'), blocks.mapBy('brushName'));
    }
    return choose;
  }

  /** @return those blocks which have positionFilter and featurePositions
   * @desc
   * block.positionFilter is aliased to datasetId.positionFilter
   * block featurePositions is described in comment in related addFeaturePositions().
   */
  get blockIntersections() {
    const
    blocks = this.brushedOrViewedVCFBlocksVisible
      .filter(block => block[featurePositionsSymbol] && 
              ((block.positionFilter ?? null) !== null));
    return blocks;
  }

  /** If blocks ("datasets") are selected for intersection filtering,
   * filter an array of features.
   * @param block VCF/genotype block
   * @param features  from block.featuresInBrushOrZoom
   * @return features, or a filtered copy of it.
   */
  featureFilterPre(block, features) {
    const
    fnName = 'featureFilterPre',
    /** blocks which are defining the filter */
    blocks = this.blockIntersections;
    let logCount = 4;
    if (blocks.length) {
      const
      visibleBlocks = this.brushedOrViewedVCFBlocksVisible,
      /** unlike vcfGenotypeLookupAllDatasets(), .positionFilter === false is
       * not filtered out, since it may filter features out.
       */
      choose = this.positionFiltersChoose(visibleBlocks, blocks),
      filterFn = choose ? filterFnChoose : filterFnSimple;
      /** @return true if feature position is in requiredBlock, and in k (chooseK) of
       * the other blocks */
      function filterFnChoose(feature) {
        let overlaps = 0;
        if (logCount-- > 0) {
          dLog(fnName, feature.get('value.0'));
        }
        const
        ok =
          /** extract from positionIsInBlock(); can factor requiredBlock count into the loop */
          choose.requiredBlock[featurePositionsSymbol].has(feature.get('value.0')) &&
          visibleBlocks.some((block, blockIndex) => {
            // could test > k instead of excluding requiredBlock from the count.
            if ((block !== choose.requiredBlock) && this.positionIsInBlock(block, feature)) {
              overlaps++;
              if (logCount > 0) {
                dLog(fnName, overlaps, );
              }
            }
            return overlaps >= choose.k;
          });
        return ok;
      }
      function filterFnSimple(feature) {
        const
        blockOut = 
          blocks.find((block, blockIndex) => 
            this.positionIsInBlock(block, feature) !== !!block.positionFilter );
        return blockOut === undefined;
      }

      const feature0 = features[0];

      /** features are filtered out if, for any of the filtering blocks, the
       * presence / absence of feature position in block does not match the
       * block .positionFilter
       */
      features = features.filter(filterFn);
      /** If all are filtered out, the headers are not displayed, so retain 1 feature. */
      if (false && ! features.length && feature0) {
        features = [feature0];
      }
    }
    if (features && this.args.userSettings.snpPolymorphismFilter) {
      features = this.snpPolymorphismFilter(block, features);
    }
    if (features && this.args.userSettings.featureCallRateThreshold) {
      dLog('featureCallRateFilter', this.args.userSettings.featureCallRateThreshold, features.length);
      features = features.filter(this.featureCallRateFilter.bind(this));
      dLog('featureCallRateFilter', features.length);
    }
    if (features) {
      const userSettings = this.args.userSettings;
      if (userSettings.minAlleles !== '' || userSettings.maxAlleles !== '') {
        features = featuresFilterNalleles(
          features, userSettings.minAlleles, userSettings.maxAlleles);
      }
    }

    return features;
  }

  /** refer : models/block.js : addFeaturePositions()  */
  // featurePositions = blocks.map(block => block[featurePositionsSymbol]);
  positionIsInBlock(block, feature) {
    return block[featurePositionsSymbol].has(feature.get('value.0'));
  }


  /** Calculate for each feature / SNP the count of values which are Alt and Ref.
   * If the SNP has only Alt or only Ref then it is monomorphic and is of
   * limited interest, so filter it out.
   */
  snpPolymorphismFilter(block, features) {
    const requestSamplesAll = this.args.userSettings.requestSamplesAll;
    features = features
      .filter(feature => {
        // related : featuresCountMatches(), filterSamples().
        const
        /** can't apply this filter if no sample genotype values have been
         * loaded for this feature. */
        haveSampleValues = featureHasSamplesLoaded(feature),
        counts = haveSampleValues &&
          Object.entries(feature.values)
          .reduce((result, [key, value]) => {
            const sampleName = key;
            if (! valueNameIsNotSample(sampleName) &&
                (requestSamplesAll || this.sampleSelectedFilter(block, sampleName))) {
              const gtValue = value; // feature.values[sampleName];
              if (gtValue !== undefined) {
                if ('012'.includes(gtValue)) {
                  result[+gtValue]++;
                } else if ('CATG'.includes(gtValue)) {
                  // count nucleotide CATG value compared against features.values.{alt,ref}
                  // count features.values.alt in gtValue
                  // const altCopies = stringCountString(gtValue, features.values.alt);
                  // result[altCopies]++;
                }
              }
            }
            return result;
          }, [0, 0, 0]),
        ok = haveSampleValues && (counts[0] && counts[2]);
        return ok;
      });
    return features;
  }

  featureFilter(feature) {
    const
    userSettings = this.args.userSettings,
    ok = featureMafFilter(feature, userSettings.mafThreshold, userSettings.mafUpper);
    return ok;
  }

  /** Optional filter by call rate of a sample within a block.
   * @return undefined if callRateThreshold is 0, otherwise a filter function with signature
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

  /** Optional filter by call rate of a Feature / SNP.
   * @return undefined if featureCallRateThreshold is 0, otherwise a filter function with signature
   * featureCallRateFilter(feature) -> boolean, false means filter out
   */
  @computed('args.userSettings.featureCallRateThreshold')
  get featureCallRateFilter() {
    /** based on .sampleFilter() - may factor if the calculation remains similar. */
    const
    callRateThreshold = this.args.userSettings.featureCallRateThreshold,
    fn = ! callRateThreshold ? undefined :
      (feature) => featureCallRateFilter(callRateThreshold, feature);
    return fn;
  }

  /** Is given sampleName selected for block ?
   * @return true if sampleName is selected in dataset of block,
   * or valueNameIsNotSample(sampleName), i.e. sampleName is ref/alt/etc.
   */
  sampleSelectedFilter(block, sampleName) {
    const
    datasetId = block.get('datasetId.id'),
    samplesSelected = this.vcfGenotypeSamplesSelectedAll[datasetId],
    // related : refAlt.includes(sampleName)
    ok = valueNameIsNotSample(sampleName) ||
      samplesSelected?.includes(sampleName);
    return ok;
  }

  /** Return a comparator for sorting column sample names by Passport data
   * fields selected by the user.
   * @return undefined if no Passport data fields are selected, or sorting by
   * Passport data fields is not enabled.
   */
  @computed(
    'args.userSettings.sortByPassportFields',
    'args.userSettings.passportFields.length')
  get sampleNamesCmpField() {
    let fn;
    const userSettings = this.args.userSettings;
    if (userSettings.sortByPassportFields && userSettings.passportFields.length) {
      fn = (...sampleNames) => {
        let cmp = 0;
        const selectFields = userSettings.passportFields; // useSelectMultiple : .mapBy('id');
        /** Find the first non-zero comparison. The result of find() is not
         * used. cmp is exported. */
        selectFields.find(fieldName => {
          const
          /** dataset.samplesPassport.genotypeID[sampleName] */
          v = sampleNames.map(sampleName => this.findPassportFields(sampleName)?.[fieldName]);
          cmp = passportValueCompare(v);
          // .find() will exit when cmp!==0
          return cmp;
        });
        return cmp;
      };
    }
    return fn;
  }
  /** Lookup the Passport field values of the given sample.
   * If sampleName is a String, it may have [passportSymbol] assigned by
   * vcfFeatures2MatrixViewRowsResult() : columnNames.
   * The fallback is to find which dataset contains the given sample, and
   * whether Passport fields of the sample have been retrieved.  This can be
   * used this where dataset is not available.
   * @param sampleName
   * @return {fieldName -> fieldValue, ... }
   */
  findPassportFields(sampleName) {
    let fieldValues = sampleName[passportSymbol];
    if (! fieldValues) {
      this.gtDatasets.find(d => (fieldValues = d.samplesPassport?.genotypeID[sampleName]));
    }
    return fieldValues;
  }
  /** Return a comparator for sorting column sample names according to
   * sampleFilters selected by the user.
   * The header comment of sampleFilterTypeName() describes sampleFilters.
   * 
   * @return undefined if sampleFiltersCount[sampleFilterTypeName] is 0, otherwise
   * a sort comparator function with signature (sampleName1, sampleName2),
   * which returns +ve if column of sampleName2 should be shown to the right of sampleName1.
   * Related : columnNamesCmp(), sampleNamesCmpField().
   */
  @computed(
    'sampleFiltersCountSelected',
    'matchesSummary',
  )
  get sampleNamesCmpFilter() {
    /** if there are referenceSamples, then filterSamples() will set .matchesSummary = distancesTo1d() */
    if (false && ! this.referenceSamplesCount) {
    /* clear the cached results of sampleMatchesSum() */
      this.matchesSummary = {};
    }
    const
    filtersCount = this.sampleFiltersCountSelected,
    fn = ! filtersCount ? undefined : (...sampleNames) => {
      const
      /** distance averages for the samples.  */
      matchRates = sampleNames
        .map(this.sampleMatchesSum.bind(this)),
      cmp = Measure.cmp(matchRates[0], matchRates[1]);
      return cmp;
    };
    return fn;
  }
  @computed(
    'sampleNamesCmpField',
    'sampleNamesCmpFilter',
  )
  get sampleNamesCmp() {
    let fn;
    const
    fns = [this.sampleNamesCmpField, this.sampleNamesCmpFilter].filter(x => x);
    if (fns.length) {
      fn = arraySortNestedComparator(fns);
    }
    return fn;
  }
  /** Wrap sampleNamesCmp() - handle multiple blocks, and strip off
   * the datasetId which is appended to sampleNames to form columnNames.
   * Used in showSamplesWithinBrush().
   *
   * Related : vcf-feature.js : columnNamesCmp() which also wraps
   * sampleNamesCmp(), and is defined and used within
   * vcfFeatures2MatrixViewRowsResult().
   *
   * @param sampleNamesCmp comparator function, which may combine multiple
   * comparator function, providing a nested sort.
   * See sampleNamesCmp{,Field,Filter}().
   * @param columnNames 2 columnNames to compare
   */
  columnNamesCmp(sampleNamesCmp, ...columnNames) {
    const
    // this can be done in the caller
    /* also, this does not propagate [Symbol(dataset)] to the new value
     * ([Symbol(passport)] is already omitted by augmentSampleName()).
     * It could be re-added here; using sample references in place of names is
     * another possibility.
     * Currently findPassportFields() searches .gtDatasets to get [Symbol(passport)].
     */
    sampleNames = columnNames.map(name =>
      augmented2SampleName(columnName2SampleName(name))),
    /** these non-sample columns are prioritised to the left : Alt Ref, .. */
    ns = sampleNames.map(columnName => valueNameIsNotSample(columnName)),
    /** if columnNames[0] is Alt/Ref then cmp is -1;   if ... [1] then ... +1  */
    cmp = ns[0] && ns[1] ? 0 : ns[0] ? -1 : ns[1] ? 1 :
      sampleNamesCmp.apply(undefined, sampleNames);
    return cmp;
  }


  /** result of sampleMatchesSum()
   * [sampleName] -> Measure, where Measure is :
   *   Counts
   *   Distance in 557d1c30 .. c530668d
   *   MatchesCounts {matches, mismatches} (original) in 1123e41a,3792a330 .. 557d1c30
   */
  matchesSummary = {};
  /** Map sampleName to a numeric value which can be compared with other
   * sampleNames, used by sampleNamesCmp() for sorting sampleNames.
   * Distances have been collated by featuresCountMatches() :
   * in the case of referenceSamples, each sampleName has a distance to each
   * referenceSample, these have been converted to 1d in distancesTo1d();
   * otherwise, each sampleName has a single distance, to the Alt or Ref values.
   *
   * If ! referenceSamples the distance is a count of differences relative to the
   * Alt or Ref value at the selected SNPs.
   *
   * Often samples will only be present in one block; this function averages the
   * distances of sampleName across the viewed blocks.
   */
  sampleMatchesSum(sampleName) {
    const fnName = 'sampleMatchesSum';
    let ratio = this.matchesSummary[sampleName];
    if (ratio === undefined) {
      let distanceCount = 0;
      const
      blocks = this.sampleName2Blocks(sampleName),
      /** sum of Measure (e.g. {,mis}match counts) for blocks containing sampleName.  */
      ms = blocks
        .reduce((sum, block) => {
          const
          /** m is now Measure, replacing : distance,  {matches,mismatches}. */
          m = block?.[sampleMatchesSymbol]?.[sampleName];
          if (m !== undefined) {
            distanceCount++;
            if (! sum) {
              sum = m;
            } else {
              sum = Measure.add(sum, m);
            }
          }
          return sum;
        }, null);
      /* ! distanceCount implies ms is null.
       * missing data is not sorted
       */
      ratio = Measure.average(ms, distanceCount);
      if (trace_sort) {
        dLog(fnName, sampleName, ratio, distanceCount, blocks.length);
      }
      this.matchesSummary[sampleName] = ratio;
    }
    return ratio;
  }

  //----------------------------------------------------------------------------


  /** 
   * @return a file base name for VCF Download of displayed data of this.lookupBlock.
   * The base name does not include the extension, because either
   * '.vcf.txt' or '.vcf.gz' may be used
   */
  @computed(
    'lookupDatasetId', 'lookupScope', 'vcfGenotypeLookupDomain',
    'vcfGenotypeSamplesSelected', 'requestFormat')
  get vcfExportFileName() {
    const
    scope = this.lookupScope,
    vcfDatasetId = this.lookupBlock?.get('datasetId.id'),
    domainText = this.vcfGenotypeLookupDomain ? this.vcfGenotypeLookupDomain.join('-') : '',
    samplesLength = this.vcfGenotypeSamplesSelected ? this.vcfGenotypeSamplesSelected.length : '',
    fileName = vcfDatasetId +
      '_' + scope +
      '_' + domainText +
      '_' + this.requestFormat +
      '_' + samplesLength;
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
    if (! this.gtBlocks.length) {
      this.emptyTable();
    } else if (! this.axisBrush /* || ! this.lookupBlock*/) {
      // perhaps clear table
    } else {
      const userSettings = this.args.userSettings;
      let
      // originally just 1 brushed axis, and hence 1 referenceBlock
      // referenceBlock = this.axisBrush?.get('block'),
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
        this.rowLimitMessage = null;
        const
        // this.gtDatasets is equivalent to visibleBlocks.mapBy('datasetId.content').uniq(),
        gtDatasetIds = this.gtDatasetIds,
        featuresArrays = visibleBlocks
        /* featureFilterPre() is expected to filter out most features,
         * so apply it before rowLimit; */
          .map((b) => {
            let features = b.featuresInBrushOrZoom;
            if (b.get('datasetId.enableFeatureFilters')) {
              features = this.featureFilterPre(b, features);
            }
            return features;
          })
          .filter((features) => features.length)
          .map((features) => {
            if (features.length > this.rowLimit) {
              this.rowLimitMessage = "Rows limited to " + this.rowLimit + '.';
              features = features.slice(0, this.rowLimit);
            }
            return features;
          });
        const totalLength = featuresArrays.reduce((sum, features) => sum += features.length, 0);
        Ember_set(this, 'requestLength.features', totalLength);

        this.collateBlockHaplotypeFeatures(featuresArrays);
        this.collateBlockSamplesCallRate(featuresArrays);

        if (featuresArrays.length) {
          const
          /** catenate selectedSamples of all blocks; may instead pass
           * vcfGenotypeSamplesSelectedAll in options, and featureSampleMAF()
           * can lookup via all[feature.get('blockId.datasetId.id')]
           * options.selectedSamples is used by featureSampleMAF()
           *  related : .samplesOK(true) or .sampleNames
           */
          all = Object.values(this.vcfGenotypeSamplesSelectedAll),
          selectedSamples = all.length ? [].concat.apply(all[0], all.slice(1)) : [],
          /** pass visibleBlocks for .datasetId.samplesPassport.genotypeID */
          options = {userSettings, selectedSamples, visibleBlocks};
          if (this.urlOptions.gtMergeRows) {
            /** {rows, sampleNames}; */
            let sampleFilters = [];
            if (userSettings.filterBySelectedSamples && ! userSettings.requestSamplesAll) {
              sampleFilters.push(this.sampleSelectedFilter.bind(this));
            }
            if (this.sampleFilter) {
              sampleFilters.push(this.sampleFilter);
            }

            /** Could change signature of featureFilter to block => featureFilter,
             * enabling : block => block.get('datasetId.enableFeatureFilters') ||
             * feature => featureFilter(feature)
             * and vcfFeatures2MatrixViewRowsResult() : if (! featureFilter || featureFilter(feature))
             */
            const
            sampleGenotypes = 
              vcfFeatures2MatrixViewRows(
                this.requestFormat, featuresArrays, this.featureFilter.bind(this), sampleFilters,
                this.sampleNamesCmp,
                options);
            /** Insert datasetIds to this.columnNames.
             * Add features to : this.displayDataRows.
             */
            const nonVCF = this.nonVCFFeaturesWithinBrushData;
            const referenceBlockRows = sampleGenotypes.rows;
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
            for (const [referenceBlock, displayDataRows] of referenceBlockRows.entries()) {
              annotateRowsFromFeatures(displayDataRows, nonVCF.features, this.selectedFeaturesValuesFields);
            }
            const
            /** for each referenceBlock : a sparse array indexed by Position  */
            sparseRows = Array.from(referenceBlockRows.values()),
            /** sparseArray.values() fills out the array, whereas
             * Object.values(sparseArray) does not. Similarly for .entries().
             */
            rowsArrays = sparseRows.map(a => Object.values(a)),
            /** Array.prototype.concat === [].concat */
            displayDataRows = [].concat.apply([], rowsArrays);

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

            sn = sampleGenotypes.sampleNames,
            // use == because .sampleNames are String
            altColumnIndex = sn.findIndex(s => s == 'Alt'),
            firstSampleIndex = altColumnIndex === -1 ? 0 : altColumnIndex + 1,
            /** altColumnIndex and firstSampleIndex can be replaced by keeping
             * the left/fixed columns separated earlier in the pipeline, in
             * vcfFeatures2MatrixViewRowsResult() */
            columnNamesFixed = sn.slice(0, firstSampleIndex),
            sampleNamesPreSort = sn.slice(firstSampleIndex),
            /** sampleNamesCmp() is already applied per-block (i.e. per array
             * in featuresArrays[]) in vcfFeatures2MatrixViewRowsResult().
             * columnNamesCmp(), which wraps sampleNamesCmp(), is applied across
             * all the blocks (all of featuresArrays[]) in the following, so the
             * per-block sort could be omitted.
             */
            sampleNamesPostSort = this.sampleNamesCmp ? 
              sampleNamesPreSort
              .sort(this.columnNamesCmp.bind(this, this.sampleNamesCmp)) :
              sampleNamesPreSort,
            sameString = (a, b) => a.toString() == b.toString(),
            sampleNamesPostSortUniq = uniqWith(sampleNamesPostSort, sameString),
            sampleNames = columnNamesFixed.concat(sampleNamesPostSortUniq),

            /* Position value is returned by matrix-view : rowHeaders().
             * for gtMergeRows the Position column is hidden.
             * .sampleNames contains : [ 'Ref', 'Alt', 'tSNP', 'MAF' ]; 'tSNP' is mapped to 'LD Block'
             * \t<datasetId> is appended to 'MAF' and 'LD Block'.
             */
            columnNames = ['Chr']
              .concat(gtDatasetIds)
              .concat(nonVCF.columnNames)
              .concat(['Position', 'Name'])
              .concat(extraDatasetColumns)
              .concat(sampleNames);

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
            /* The count of all SNPs in brushed datasets will be displayed in
             * the nav tab badge, instead of the row count, which is what this
             * provides :
             later(() => Ember_set(this, 'args.summaryData.rowCount', displayDataRows.length));
            */

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
            /* See earlier comment re. summaryData.rowCount
             * later(() => Ember_set(this, 'args.summaryData.rowCount', displayData.length));
             */
          }
        } else {  // ! featuresArrays.length
          setProperties(this, {
            columnNames : emptyTableColumns,
            gtDatasetColumns : [],  // used by e.g. positionFilterClass().
          });
        }
      }
    }
  }
  /** Set the data content of the table to empty. */
  emptyTable() {
    const gtMergeRows = this.urlOptions.gtMergeRows;
    setProperties(this, {
      displayData : gtMergeRows ? null : [],
      displayDataRows : gtMergeRows ? [] : null,
      'args.summaryData.rowCount' : 0,
      gtDatasetColumns : [],
      datasetColumns : [],
      extraDatasetColumns : [],
      currentFeaturesValuesFields : [],
      columnNames : emptyTableColumns,
    });

  }

  /** @return the length of the data array displayed in the table
   */
  get dataRowsLength() {
    const length = this.displayData?.length || this.displayDataRows?.length;
    return length;
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
    /** using axisBrush.brushedDomain as dependency works, but not
     * .brushedDomain, which is normally equivalent.
     * As noted in vcfGenotypeLookupDomain(), .{0,1} is not required and
     * .brushCount is effective.
    'brushedDomain.{0,1}',
     */
    'axisBrush.brushedDomain',
    'axisBrushService.brushCount',

    // update : 0d6c0dd9 implements table column filtering by .selectedSamples.
    /* In vcfFeatures2MatrixViewRows() / gtMergeRows currently all samples
     * results received are displayed; vcfFeatures2MatrixView() filters by the
     * given added.sampleNames.   Added <select> for samples
     * in samples dialog in place of content-editable
     * vcfGenotypeSamplesSelected, then it would make sense to narrow the
     * display to just the samples the user currently selected, and then this
     * dependency should be enabled :
     */
    'vcfGenotypeSamplesSelected.[]',
    /** This is equivalent in effect to vcfGenotypeSamplesSelected.[];
     * performance is possibly similar.
     * 'selectedCount',
     */

    'blockService.viewedVisible',
    'requestFormat', 'rowLimit',
    'args.userSettings.filterBySelectedSamples',
    /** showSamplesWithinBrush() uses gtMergeRows */
    'urlOptions.gtMergeRows',
    /** featureFilterPre() -> snpPolymorphismFilter() */
    'args.userSettings.snpPolymorphismFilter',
    /** showSamplesWithinBrush() -> featureFilter() uses .mafUpper, .mafThreshold */
    'args.userSettings.mafUpper',
    'args.userSettings.mafThreshold',
    /** callRateThreshold -> sampleFilter, passed to vcfFeatures2MatrixView{,Rows{,Result}} -> sampleIsFilteredOut{,Blocks} */
    'args.userSettings.callRateThreshold',
    'args.userSettings.featureCallRateThreshold',
    'datasetPositionFilterChangeCount',
    'sampleCache.datasetEnableFeatureFiltersCount',

    'args.userSettings.haplotypeFiltersEnable',
    'args.userSettings.sampleFilterTypeName',
    'args.userSettings.haplotypeFilterRef',
    'sampleFiltersCountSelected',
    'referenceSamplesCount',
    'sampleNamesCmp',
    'passportDataCount',
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
   * Each Feature array is expected to be of a single block;
   * the map is recorded in block[haplotypeFeaturesSymbol].
   * @param featuresArrays  array of arrays of features, 1 array per block
   */
  collateBlockHaplotypeFeatures(featuresArrays) {
    featuresArrays
      .forEach(
        (features) => {
          const
          blockp = features?.[0].get('blockId'),
          /** blockp may be a proxy; want the actual Block, for reference via Symbol */
          block = blockp && contentOf(blockp);
          if (block) {
            const
            map = block[haplotypeFeaturesSymbol] || (block[haplotypeFeaturesSymbol] = {});
            features.reduce(
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
        }
      );
  }

  //----------------------------------------------------------------------------

  /** Collate variant sets for the selected variantIntervals, i.e.
   * features within the intervals.
   * variantInterval feature + viewed VCF datasets -> variantSet SNPs
   * @return [variantInterval name] -> [feature, ...]
   * Overlapping features of all VCF / genotype blocks are included in the 1 array
   * for each variantInterval.
   */
  @computed('brushedOrViewedVCFBlocksVisible', 'sampleFiltersCountSelected')
  get variantSets() {
    // dependency could be : 'sampleFiltersCount.variantInterval'
    /** selected variantInterval -> interval tree,
     * -> find intervals and append
     */
    // based on annotateRowsFromFeatures()
    const
    viBlockFeatures = this.blocksVariantIntervalFilters
      .mapBy('sampleFilters.variantInterval'),
    viFeatures = addObjectArrays([], viBlockFeatures),
    intervals = featuresIntervalsForTree(viFeatures),
    intervalTree = createIntervalTree(intervals),
    gtDatasetColumns = this.gtDatasetColumns,
    sets = {};

    if (this.displayDataRows) Object.entries(this.displayDataRows).forEach(
      ([location, row]) => {
        /** Find all intervals containing query point */
        intervalTree.queryPoint(location, function(interval) {
          const
          /** this is the variantInterval feature - want the row feature. */
          viFeature = interval[featureSymbol],
          /** filter out undefined, which is from blocks without features overlapping this row. */
          rowFeatures = gtDatasetColumns
            .map(datasetId => row[datasetId]?.[featureSymbol])
            .filter(f => f),
          intervalName = interval.join('_'),
          variantSet = sets[intervalName] || (sets[intervalName] = []);
          /* rowFeatures will not be on other rows, so .addObjects() is not required for uniqueness */
          variantSet.pushObjects(rowFeatures);
        });
      });
    return sets;
  }

  //----------------------------------------------------------------------------

  /** Construct a map per block from sample names to call rate.
   * Call rate is defined as the genotype calls divided by the total number of
   * Features / SNPs in the brushed interval.
   * Genotype calls are e.g. 0, 1, 2; misses are './.'
   *
   * Also collate SNP / Feature call rate of the loaded sample calls of each feature.
   * This could be done by vcfGenotypeReceiveResult() as for featuresSampleMAF().
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
          features.reduce(
            (map, feature) => {
              const featureSamplesCount = {calls:0, misses:0};
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
                  featureSamplesCount[callKey[+call]]++;
                }
                return map;
              }, map);
              feature[callRateSymbol] = featureSamplesCount;

              return map;
            },
            map);
          dLog(fnName, map, block.brushName);
        });
  }

  /** for brushedOrViewedVCFBlocks, apply any sampleFilters which the blocks have.
   * Used for all 3 types of Sample Filters :
   * sampleFilterTabs = ['Variant Intervals', 'LD Blocks', 'Features'];
   *
   * Originally written for tSNP 'LD Blocks'; later the term 'haplotypes' was
   * changed to 'LD Blocks' in the GUI and in some variable & function names.
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
  filterSamples(showHideSampleFn, matrixView) {
    const fnName = 'filterSamples';

    /** match a (sample genotype call) value against the Ref/Alt value of the
     * feature / SNP.  a rough factorisation; currently there is just 1 flag
     * haplotypeFilterRef for all selected 'LD Blocks', and hence one instance
     * of MatchRef, but these requirements are likely to evolve.  */
    class MatchRef {
      constructor(matchRef) {
        this.matchRef = matchRef;
        this.matchKey = matchRef ? 'ref' : 'alt';
        this.matchNumber = matchRef ? '0' : '2';
      }
      /** to match homozygous could use .startsWith(); that will also match 1/2 of heterozygous.
       * Will check on (value === '1') : should it match depending on matchRef ?
       * @param value sample/individual value at feature / SNP
       * This function is not called if valueIsMissing(value).
       * @param matchValue  ref/alt value at feature / SNP (depends on matchRef)
       */
      matchFn(value, matchValue) { return (value === this.matchNumber) || (value === '1') || value.includes(matchValue); }
      /**
       * Param comments of matchFn() apply here also.
       * @return undefined if value is invalid
       * missing data, i.e. './.', is counted in .missing if using Counts
       */
      distanceFn(value, matchValue) {
        const fnName = 'distanceFn';
        /** number of copies of Alt / Ref, for matchRef true / false. */
        let distance, missing = 0;
        const numeric = gtValueIsNumeric(value);
        if (value === './.') {
          missing += 2;
          distance = this.matchRef ? 0 : 2;
        } else {
          switch (value.length) {
          case 3 :
            if (numeric) { matchValue = this.matchRef ? '1' : '0'; }
            distance = 2 - stringCountString(value, matchValue);
            break;
          case 1:
            if (numeric) {
              distance = this.matchRef ? +value : 2 - value;
            } else {
              distance = value === this.matchNumber;
            }
            break;
          default : dLog(fnName, 'invalid genotype value', value);
            break;
          }
        }
        if (Measure === Counts) {
          const counts = Measure.create();
          // similar to Counts.count(), except that increments by only 1.
          if (missing) {
            counts.missing = missing;
          } else {
            counts.notMissing = 2;
            counts.distance = distance;
            counts.differences = distance ? 1 : 0;
          }
          distance = counts;
        }

        return distance;
      }
    }

    const
    userSettings = this.args.userSettings,
    matchRefFn = feature => [new MatchRef(userSettings.haplotypeFilterRef)],
    ablocks = this.brushedOrViewedVCFBlocks;
    const
    filterTypeName = this.sampleFilterTypeName;

    ablocks.forEach((abBlock) => {
      let blockMatches = {};
      const
      block = abBlock.block,
      /** later may apply referenceSamples to filterTypeName other than
       * variantInterval; the 3 filterTypeNames are equivalent in that they
       * are means for the user to select features. */
      referenceSamples = block[referenceSamplesSymbol] || [],
      filterArray = this.blockSampleFilters(block, filterTypeName);
      switch (filterTypeName) {
      case 'haplotype': {
        const
        selected = filterArray,
        matchesR = selected.reduce((matches, tSNP) => {
          const features = block[haplotypeFeaturesSymbol][tSNP];
          featuresCountMatches(features, matches, matchRefFn);
          return matches;
        }, {});
        blockMatches = matchesR;
      }
        break;
      case 'variantInterval' : {
        const
        sets = this.variantSets,  //  - getVariantSets() or get variantSets()
        features = addObjectArrays([], Object.values(sets));
        // -	filter variant set by referenceSamples : filter out SNP feature if no variation in feature.values. [referenceSamples]

        let matchRefFn2;
        if (referenceSamples.length	/*this.referenceSamplesCount*/) {
          matchRefFn2 = feature => referenceSamples.map(
            sampleName => new MatchRefSample(sampleName));
            // or feature.values[sampleName]);
          // features are the elements of variantSet
        } else {
          matchRefFn2 = matchRefFn;
        }

        featuresCountMatches(features, blockMatches, matchRefFn2);
      }
        break;
      case 'feature' : {
        const
        features = filterArray;
        if (features) {
          featuresCountMatches(features, blockMatches, /*matchRef*/null);
        }
      }
        break;
      }

      /**
       * @param matches[sampleName] is now Measure, replacing : distance, {matches,mismatches}.
       * @param matchRefFn undefined or function returning [MatchRef, ...].
       * if not defined then construct it for each feature from feature[matchRefSymbol].
       */
      function featuresCountMatches(features, matches, matchRefFn) {
        features.forEach((feature) => {
          const
          matchRefs = matchRefFn ? matchRefFn(feature) : [new MatchRef(feature[matchRefSymbol])];
          matchRefs.forEach((matchRef, i) => {
            const matchValue = feature.values[matchRef.matchKey];
            Object.entries(feature.values).forEach(([key, value]) => {
              if (! valueNameIsNotSample(key) /*&& matchValue*/ /*&& ! valueIsMissing(value)*/) {
                const sampleName = key;
                const distance = matchRef.distanceFn(value, matchValue);
                if (distance !== undefined) {
                  const
                  referenceSampleName = matchRef.matchKey,
                  /** use [referenceSampleName] if referenceSamples.length,
                   * e.g. matches[referenceSampleName][sampleName] */
                  matchesR = referenceSamples.length ?
                    matches[referenceSampleName] || (matches[referenceSampleName] = {}) :
                    matches;
                  matchesR[sampleName] = Measure.add(matchesR[sampleName], distance);
                }
              }
            });
          });
        });
      }

      /** this does not clear the other value, e.g. when the only
       * referenceSample is de-selected, block[referenceSampleMatchesSymbol]
       * is not cleared.
       */
      block[referenceSamples.length ? referenceSampleMatchesSymbol : sampleMatchesSymbol] = blockMatches;
      if (showHideSampleFn && this.args.userSettings.haplotypeFiltersEnable) {
        /* 
         * block *
         *   sample*
         *     show/hide according to count
         * counts is now Measure, replacing : distance, {matches,mismatches}.
         */
        Object.entries(blockMatches).forEach(([sampleName, counts]) => {
          showHideSampleFn(sampleName, counts);
        });
      }
    });
    /** .matchesSummary was initialised by sampleNamesCmp() if ! .referenceSamplesCount, until 0cd9e673.
     * Now 'matchesSummary' is a dependency of sampleNamesCmp() so setting it here enables
     * sampleMatchesSum() to add sampleNames to it as required, e.g. when distancesTo1d() returns {}
     */
    const distanceOrder = distancesTo1d(
      ablocks.mapBy('block'),
      this.referenceSamplesCount,
      this.args.userSettings);
    Ember_set(this, 'matchesSummary', distanceOrder);

    if (matrixView) {
      // to enable trialling of action to filter after Clear : haplotypeFiltersApply() : filterSamplesBySelectedHaplotypes()
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
    isBrAPI = this.lookupBlock?.hasTag('BrAPI') ||
      (this.lookupBlock?.server?.serverType === 'BrAPI'),
    isGerminate = this.lookupBlock?.hasTag('Germinate'),
    /** not clear why passing limitSamples false for VCF (edit was 2023 'Mar  1 21:20') */
    {samples, samplesOK} = this.samplesOK(isBrAPI),
    domainInteger = [0, 1],
    dialogMode = this.args.userSettings.dialogMode,
    /** lookupBlock.datasetId.genotypeId is .lookupDatasetId if ! isGerminate */
    vcfDatasetId = dialogMode ? dialogMode.datasetId :
      this.lookupBlock?.get('datasetId.genotypeId'),
    scope = this.lookupScope,
    scopeOK = scope || (dialogMode?.component === 'genotype-search'),
    /** VCF format, \t separated. sample names are appended. */
    columnHeadersChrPosId = '#CHROM	POS	ID	';
    let textP;
    /** After a brush, this CP is re-evaluated, although the dependencies
     * compare === with the previous values.  Could memo-ize the value based on
     * dependency values.
     *
     * Related : with autoLookup may need to cache headerText per
     * lookupDatasetId; depends on whether result vcfExportText combines
     * brushedOrViewedVCFBlocksVisible into a single VCF.
     */

    if (isBrAPI) {
      const datasetId = vcfDatasetId; // === this.lookupDatasetId
      /** BrAPI (and Germinate) construct the header from the samples list. */
      let allSamples, text;
      if (this.requestSamplesSelected) {
        text = columnHeadersChrPosId + this.selectedSamples?.join('\t');
      } else if (samples) {  // maybe check ?.length
        text = columnHeadersChrPosId + samples.replaceAll('\n', '\t');
      } else if ((allSamples = (datasetId && this.sampleCache?.sampleNames?.[datasetId]))) {
        text = columnHeadersChrPosId + allSamples.replaceAll('\n', '\t');
      } else if (this.samples) {
        text = columnHeadersChrPosId + this.samples.join('\t');
      } else {
        // get samples
        textP = this.lookupBlock?.server.brapiGenotypeSamples(datasetId).then(samples =>
          columnHeadersChrPosId + samples /*.callSetDbIds*/ ?.join('\t')).then(headerText =>
            this.headerText = headerText);
      }
      if (text) {
        this.headerText = text;
        textP = Promise.resolve(text);
      }
    } else if (isGerminate) {
      /** short-cut the vcfGenotypeLookup() request below because Germinate is
       * taking ~1min for it, and there is no benefit - the header is expected to
       * be simply samples. */
      textP = Promise.resolve(samples);
    } else if (samplesOK && scopeOK && vcfDatasetId) {
      const
      requestFormat = this.requestFormat,
      userSettings = this.args.userSettings,
      requestSamplesFiltered = userSettings.requestSamplesFiltered,
      /** If filtered, then samples is a subset of All. */
      requestSamplesAll = userSettings.requestSamplesAll && ! requestSamplesFiltered,
      /** requestOptions.linkageGroupName may not be required when getting headers. */
      requestOptions = {requestFormat, requestSamplesAll, headerOnly : true};
      addGerminateOptions(requestOptions, this.lookupBlock);
      let searchScope = domainInteger;
      if (! scope) {
        const
        apiServer = this.controls.apiServerSelectedOrPrimary,
        dataset = apiServer.datasetsBlocks.findBy('id', vcfDatasetId),
        vcfFiles = dataset?.[Symbol.for('vcfFiles')];
        requestOptions.datasetVcfFile = vcfFiles?.[0];
      }
      /** these params are not applicable when headerOnly : samples, domainInteger, rowLimit. */
      textP = vcfGenotypeLookup(
        this.auth, samples, domainInteger,
        requestOptions, vcfDatasetId, scope, this.rowLimit)
        .then((text) => {
          const
          isGerminate = resultIsGerminate(text);
          /** for BrAPI, domain [0, 1] will return 0 results, and hence 0
           * callSetDbIds, so use .samples */
          this.headerText = (isBrAPI || resultIsBrapi(text)) ? columnHeadersChrPosId +
            (text.callSetDbIds?.join('\t') || samples.replaceAll('\n', '\t') || '') :
            isGerminate ? text.join('\t') : text;
          if (trace) {
            dLog(fnName, text);
          }
          return this.headerText;
        })
        .catch(this.showError.bind(this, fnName));
      textP = toPromiseProxy(textP);
    } else {
      dLog(fnName, scope, dialogMode, samplesOK, scopeOK, vcfDatasetId);
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
          blocks = this.lookupDatasetBlocks
            .filter(b => b[Symbol.for('vcfGenotypeText')]),
          combined = this.combineHeader(headerText, blocks);
          return combined;
        });
    } else {
      /** file-anchor.js requires a defined value for @data */
      combinedP = Promise.resolve([]);
    }
    combinedP = toArrayPromiseProxy(combinedP);
    return combinedP;
  }

  /** Export as a user file download a VCF file constructed from .headerTextP,
   * .vcfGenotypeText via combineHeader()
   *
   * The exported MIME Type used is 'text/csv' because 
   * 'text/tsv'is would be interpreted as Vcard, refn 
   * https://github.com/samtools/hts-specs/issues/407
   * https://developer.mozilla.org/en-US/docs/Web/HTTP/MIME_types/Common_types
   */
  vcfExportTextToFile() {
    this.vcfExportTextP.then(combined => {
      combined.push('');  // for trailing newline
      const data = combined.join('\n');
      if (this.args.userSettings.compressVCF) {
        const blobP = text2Gzip(data, 'application/gzip');
        blobP.then(blob => 
          fileDownloadBlob(this.vcfExportFileName + '.vcf.gz', blob, 'application/gzip'));
      } else {
        fileDownloadAsCSV(this.vcfExportFileName + '.vcf.txt', data, 'text/plain');
      }
    });
  }

  /** Combine the given VCF result header with the VCF result bodies.
   * @param headerText header part of a VCF lookup; the last line is the #CHROM
   * row containing the column headers.
   * @param blocks are all from the same dataset, and hence the
   * headerText and in particular selected samples are the same.
   * Each of the block vcfGenotypeTexts starts with the column header line (#[1]ID...).
   * @return array of text rows, 1 per line
   */
  combineHeader(headerText, blocks) {
    /** remove trailing \n, so that split does not create a trailing empty line.  */
    headerText = headerText.trim().split('\n');
    /** vcfGenotypeText starts with column header line (#CHROM...), so trim the
     * column header line off the end of headerText.
     */
    if (headerText[headerText.length-1].startsWith('#CHROM')) {
      headerText = headerText.slice(0, headerText.length-1);
    }
    const
    /** BrAPI headerTextP includes chrPosId[] columns, so don't call insertChromColumn().
     * Probably the current result (headerText, vcfGenotypeText) is for .lookupBlock */
    isBrAPI = this.lookupBlock?.hasTag('BrAPI'),
    tableRows = blocks.map((b, i) => {
      /** all rows of result in 1 string, with rows separated by \n  */
      const vcfGenotypeText = b[Symbol.for('vcfGenotypeText')];
      /** and prepend the chromosome column because that is not included in the request.  */
      const blockText = isBrAPI ? vcfGenotypeText : this.insertChromColumn(vcfGenotypeText, b.name, i);
      return blockText;
    }),
    combined = headerText.concat(tableRows.flat());
    return combined;
  }

  /** The vcf-genotype.js : vcfGenotypeLookup() format omits CHROM because it is
   * constant - each request is specific to a chromosome.
   * This function re-inserts the CHROM column in the conventional (left) position.
   * @param vcfGenotypeText string
   * @param chrName	text to prepend as left column of each row
   * @param blockIndex	use the header row from the first block, and trim it off from the others
   * @return array of strings, 1 per line
   */
  insertChromColumn(vcfGenotypeText, chrName, blockIndex) {
    const
    lines = vcfGenotypeText
    // ignore trailing \n which otherwise creates an empty line.
      .trim()
      .split('\n'),
    /** expect that [0] line.startsWith('#[1]')
     * trim this off for all but the first block
     */
    maybeSliced = blockIndex ? lines.slice(1) : lines,
    withChrom = maybeSliced
      .map((line, rowIndex) => {
        let result;
        if ((rowIndex === 0) && ! blockIndex)
        {
          // insert CHROM column header
          result = line
            .replace(/^#/, '#CHROM\t')
          /* Strip out the column numbers [1] etc which are shown before column
           * headers by bcftools query -H.
           * Could match [ \t], but previous line changes that initial space to \t
           * These 2 replace-s match respectively [1], and the remainder.
           */
            .replace(/^#\[1\]/, '#')
            .replaceAll(/\t\[\d+\]/g, '\t');
        } else {
          // insert chromosome / scope column value.
          result = chrName + '\t' + line;
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

  /** Identify the dataset selected by the user, of VCF / genotype dataset via
   * tab selection change of Datasets Samples tabs.
   *
   * activeIdDatasets is the DOM element id of <nav.item > <a>
   * activeIdDatasets, tabName2IdDatasets() are analogous to and based on 
   * activeId, tabName2Id() above.
   */
  @tracked
  activeIdDatasets = null;
  /** datasetId of selected dataset */
  @tracked
  activeDatasetId = null;
  /** Ember Data store record handle of selected dataset */
  @tracked
  activeDataset = null;

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
  /** In response to user selection of a dataset tab in the settings/controls : Datasets tab, set :
   * - activeDatasetId  datasetId
   * - activeIdDatasets DOM element id of <nav.item > <a>
   * - activeDataset  Ember Data store Dataset record for .activeDatasetId
   */
  setSelectedDataset(datasetId) {
    this.activeDatasetId = datasetId;
    this.activeIdDatasets = this.tabName2IdDatasets(datasetId);
    this.activeDataset = this.gtDatasets.findBy('id', this.activeDatasetId);
  }

  /** factored from selectDataset() - this would be passed to elem/tab-names
   * when that is used for datasets */
  @action
  setSelectedDatasetAction(datasetId, i) {
    if (i >= 0) {
      // sets .axisBrushBlockIndex
      this.mut_axisBrushBlockIndex(i);
    }
    this.setSelectedDataset(datasetId);
  }

  //----------------------------------------------------------------------------

  /** Add class active to the <li> parent of <a> of .activeIdDatasets
   * See comment in gtDatasetTabs().
   */
  datasetTabActiveClass() {
    const
    /** "a[href$='#tab-view-Datasets-<datasetId>']" */
    selector = "a[href$='#" + this.activeIdDatasets + "']",
    /** <a href="#tab-view-Datasets-<datasetId>" role="tab"> */
    a0 = $(selector)[0],
    /** <li class="nav-item active-detail"> */
    li = a0?.parentElement;
    li?.classList.add('active');
  }

  //----------------------------------------------------------------------------

  /** .name is added in constructor()
   * i.e. this.sampleFilterTypes[name].name === name
   */
  sampleFilterTypes = {
    /** enable these 2 if this.urlOptions.advanced
    variantInterval : {text : 'Variant Intervals'},
    haplotype :       {text : 'LD Blocks'},
    */
    feature :         {text : 'Features'},
  };
  @computed
  get sampleFilterTypesArray() {
    return Object.values(this.sampleFilterTypes);
  }
  @computed
  get sampleFilterTabNames() {
    return Object.keys(this.sampleFilterTypes);
  }
  /** Enable Variant Intervals and LD Blocks if this.urlOptions.advanced */
  sampleFilterTabs = [/*'Variant Intervals', 'LD Blocks',*/ 'Features'];
  sampleFilterKeys = [/*'variantInterval', 'haplotype',*/ 'feature'];

  /** Map from sampleFilterTabs to a filterTypeName which can be used in a variable name or
   * array index, e.g. haplotypeFiltersCount, featureFiltersCount
   * @param text  from .args.userSettings.selectFeaturesByLDBlock
   */
  filterText2Key(text) {
    const
    index = this.sampleFilterTabs.indexOf(text),
    filterTypeName = index < 0 ? undefined : this.sampleFilterKeys[index];
    return filterTypeName;
  }

  @action
  setSelectedSampleFilter(id, i) {
    Ember_set(this, 'args.userSettings.sampleFilterTypeName', id);
    this.haplotypeFiltersApply();
  }


  //----------------------------------------------------------------------------

  /** Called by matrix-view afterScrollVertically()
   * @param features of first and last visible rows after vertical scroll by user.
   */
  @action
  tablePositionChanged(features) {
    const fnName = 'tablePositionChanged';
    if (trace) {
      dLog(fnName, features);
    }
    // The caller may pass empty features[] to indicate the table is empty.
    features = features.filter(f => f);
    if (features?.length) {
      const
      values = features.mapBy('value').flat(),
      valueExtent = d3.extent(values),
      axes = features.mapBy('blockId.axis1d').filter(a1 => a1),
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

  @action
  selectedFieldsChanged(values, c, add) {
    if (! add) {
      return Promise.resolve();
    }
    const
    /** useSelectMultiple : values === passportFields;
     * access passportFields with .mapBy('id') */
    selectFields = this.args.userSettings.passportFields,
    promise = selectFields.length ?
      this.datasetsGetPassportData(selectFields) : Promise.resolve();
    return promise;
  }
  /** For each of the viewed datasets, .gtDatasets, call datasetGetPassportData().
   */
  datasetsGetPassportData(selectFields) {
    const
    promises =
    this.gtDatasets.map(dataset => {
      // related : blocksSelectedSamples(blocks)
      const sampleNames = this.vcfGenotypeSamplesSelectedAll[dataset.id];
      const
      /** datasetGetPassportData() previously yielded just the .content, so
       * preserve that signature, although the value is not used. */
      promise = sampleNames?.length ?
        this.datasetGetPassportData(
          dataset, {sampleNames, pageLength : sampleNames.length}, selectFields)
        .then(responses => responses.mapBy('content')) :
        Promise.resolve();
      return promise;
    });
    const allP = Promise.all(promises);
    /* This function is called from vcfGenotypeLookupP(), which does
     * vcfGenotypeLookupAllDatasets(); lookup causes render, but does not wait
     * for PassportData, so signal a need for showSamplesWithinBrush().
     * See related comment in updateAndClose() (select-passport-fields.js).
     */
    allP.then(() => later(() => this.passportDataCount++));

    return allP;
  }
  /** Get the Passport data values indicated by selectFields for the given
   * dataset and sampleNames.
   * @param dataset
   * @param {sampleNames, genotypeIds, accessionNumbers, _text, filter, filterCode,
   * page, pageLength}
   * genotypeIds / accessionNumbers are the name/identity fields supported by
   * the Genolink API.  Some of sampleNames may be AGG genotypeIds and hence can
   * be used as genotypeIds in lookup.
   * The above forms of ID are optional if _text is given.
   * Optional, for search : _text, filter, filterCode, page, pageLength.
   * page is not applicable when passing genotypeIds or accessionNumbers.
   * If page is not specified in the URL, result is page 0.
   * Default pageLength is 100.
   * @param selectFields  array of string Passport field names
   * @return promise which currently yields all the received data columns;
   * caller only needs genotypeIds / accessionNumbers, as the data
   * has been loaded into dataset.samplesPassport.{genotypeID,accessionNumber}.
   */
  datasetGetPassportData(
    dataset,
    {sampleNames, genotypeIds, accessionNumbers, _text, filter, filterCode,
     page, pageLength},
    selectFields) {
    const fnName = 'datasetGetPassportData';
    if (! genotypeIds?.length && sampleNames?.length) {
      genotypeIds = sampleNames.filter(sampleNameIsAGG);
    }
    if ((! genotypeIds?.length && ! accessionNumbers?.length && ! (_text ?? false) &&
         ! (filter ?? false))
        || ! selectFields.length) {
      return Promise.resolve();
    }
    const
    mg = this,
    /** array of promises, each yielding response for 1 chunk */
    chunkPs =
      getPassportData(
        {genotypeIds, accessionNumbers, selectFields, _text, filter, filterCode,
         page, pageLength },
        genolinkBaseUrl),
    promise = Promise.all(chunkPs.map(chunkP => chunkP.then(receive)));
    function receive(response) {
      {
        const data = response.content;
        dLog(fnName, dataset.id, selectFields, data);
        const
        // fillInMissingData() has already extracted .content from the response
        d = data,
        samplesPassport = dataset.samplesPassport.genotypeID;
        d.forEach((datum, i) => {
          const sampleName = datum.genotypeID;
          /* similar : Object.assign(sp, datum);
           * but datum may have an extra field : countryOfOrigin.codeNum
           * which Genolink adds, probably to support subRegion request.
           */
          selectFields.forEach(field => {
            const sp = samplesPassport[sampleName] || (samplesPassport[sampleName] = {});
            sp[field] = datum[field];
          });
        });
        return response;
      }
      later(() => mg.passportDataCount++);
    }

    return promise;
  }

  //----------------------------------------------------------------------------

}
