import Component from '@glimmer/component';
import { computed, action, set } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { A as Ember_A } from '@ember/array';

import { intervalSize } from '../../utils/interval-calcs';
import { overlapInterval } from '../../utils/draw/zoomPanCalcs';
import {
  refAlt,
  vcfGenotypeLookup,
  addFeaturesJson, vcfFeatures2MatrixView, vcfFeatures2MatrixViewRows,
  featureSampleNames,
 } from '../../utils/data/vcf-feature';
import { stringCountString } from '../../utils/string';

// -----------------------------------------------------------------------------

const dLog = console.debug;

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
 * .vcfGenotypeSamplesSelected = {}
 *
 * .requestFormat 'Numerical' (default), 'CATG'
 * .replaceResults default: false
 * .showResultText default: false
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

  @tracked
  vcfGenotypeText = '';

  @tracked
  receivedNamesCount = 0;

  @alias('lookupBlockSamples.names')
  vcfGenotypeSamplesText;

  @alias('args.userSettings.vcfGenotypeSamplesSelected')
  vcfGenotypeSamplesSelectedAll;

  @computed('lookupBlockSamples.selected')
  get vcfGenotypeSamplesSelected() {
    let selected = this.lookupBlockSamples.selected;
    /** content-editable value=this.vcfGenotypeSamplesSelected requires a defined value to bind to. */
    if (selected === undefined) {
      selected = "";
      this.vcfGenotypeSamplesSelectedAll[this.lookupDatasetId] = selected;
    }
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

    if (userSettings.replaceResults === undefined) {
      userSettings.replaceResults = false;
    }

    if (userSettings.showResultText === undefined) {
      userSettings.showResultText = false;
    }
  }

  // ---------------------------------------------------------------------------

  @action
  mut_axisBrushBlockIndex(value) {
    dLog('axisBrushBlockIndex', value, arguments, this);
    this.axisBrushBlockIndex = value;
    /** save user setting for next component instance. */
    this.args.userSettings.lookupBlock = this.lookupBlock;
  }

  // ---------------------------------------------------------------------------

  /** Maximum interval for VCF lookup request.
   * This initial default value is coordinated with hbs : <input ... value=1 ... intervalLimitInput >
   */
  @tracked
  intervalLimit = 1;

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

  // ---------------------------------------------------------------------------

  /** @return the [axisBrush, vcfBlock] selected via gui pull-down
   */
  @computed('brushedVCFBlocks', 'axisBrushBlockIndex')
  get axisBrushBlock() {
    const
    fnName = 'axisBrushBlock',
    axisBrushes = this.brushedVCFBlocks;
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
    return abb && abb[0];
  }

  @computed('axisBrushBlock')
  get lookupBlock() {
    const abb = this.axisBrushBlock;
    return abb && abb[1];
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
    if (names?.length && ! selected) {
      selected = names.slice(0, 256).split('\n').slice(0, 6).join('\n');
      this.vcfGenotypeSamplesSelected = selected;
    }
    return {names, selected};
  }

  /** Return brushed VCF blocks
   *
   * @return [[axisBrush, vcfBlock], ...]
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
      ab1 = vcfBlocks.map((vb) => [ab, vb]);
      return ab1;
    })
      .flat();
    dLog(fnName, axisBrushes, blocks, this.blockService.viewed.length, this.blockService.params.mapsToView);

    if (blocks.length) {
      /** Update .axisBrushBlockIndex : find .lookupBlock in blocks[], or ensure
       * .axisBrushBlockIndex is within blocks[].
       */
      const lookupBlock = this.args.userSettings.lookupBlock;
      if (lookupBlock !== undefined) {
        this.axisBrushBlockIndex = blocks.findIndex((abb) => abb[1] === lookupBlock);
        dLog(fnName, this.axisBrushBlockIndex, blocks[this.axisBrushBlockIndex][1].id, blocks, lookupBlock.id);
      } else if ((this.axisBrushBlockIndex === undefined) || (this.axisBrushBlockIndex > blocks.length-1)) {
        /* first value is selected. if only 1 value then select onchange action will not be called.  */
        this.axisBrushBlockIndex = 0;
      }
    }
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
    const
    fnName = 'vcfGenotypeSamples',
    scope = this.lookupScope,
    vcfDatasetId = this.lookupDatasetId;
    if (scope && vcfDatasetId)
    {
      let
      preArgs = 'query -l';

      this.lookupMessage = null;

      let textP = this.auth.vcfGenotypeSamples(
        this.apiServerSelectedOrPrimary, vcfDatasetId, scope,
        {} );
      textP.then(
        (text) => {
          dLog(fnName, text);
          this.sampleCache.sampleNames[vcfDatasetId] = text?.text;
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

  /** Lookup the genotype for the selected samples in the interval of the brushed block.
   */
  vcfGenotypeLookup() {
    const
    fnName = 'vcfGenotypeLookup',
    /** this.axisBrush.block is currently the reference; lookup the data block. */
    // store = this.axisBrush?.get('block.store'),
    store = this.apiServerSelectedOrPrimary?.store,
    samplesRaw = this.vcfGenotypeSamplesSelected,
    /** result is 1 string of names, separated by 1 newline.  */
    samples = samplesRaw?.trimStart().trimEnd()
      .replaceAll('\r\n', '\n')
      .replaceAll(/[ \t\r]/g, '\n'),
    domainInteger = this.vcfGenotypeLookupDomain,
    vcfDatasetId = this.lookupDatasetId;
    if (samples?.length && domainInteger && vcfDatasetId) {
      this.lookupMessage = null;
      let
      scope = this.lookupScope,
      textP = vcfGenotypeLookup(this.auth, this.apiServerSelectedOrPrimary, samples, domainInteger,  this.requestFormat, vcfDatasetId, scope, this.rowLimit);
      textP.then(
        (text) => {
          // displays vcfGenotypeText in textarea, which triggers this.vcfGenotypeTextSetWidth();
          this.vcfGenotypeText = text;

          /** .lookupDatasetId is derived from .lookupBlock so .lookupBlock must be defined here. */
          let blockV = this.lookupBlock;
          dLog(fnName, text.length, text && text.slice(0,200), blockV.get('id'));
          if (text && blockV) {
            const added = addFeaturesJson(
              blockV, this.requestFormat, this.args.userSettings.replaceResults,
              this.args.selectedFeatures, text);

            if (added.createdFeatures && added.sampleNames) {
              const displayData = vcfFeatures2MatrixView(this.requestFormat, added);
              this.displayData.addObjects(displayData);
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
      blocks = this.brushedVCFBlocks.map((abb) => abb[1]);
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
        if (featuresArrays.length) {
          if (this.urlOptions.gtMergeRows) {
            /** {rows, sampleNames}; */
            let sampleGenotypes = 
                vcfFeatures2MatrixViewRows(this.requestFormat, featuresArrays);
            this.displayDataRows = sampleGenotypes.rows;
            this.columnNames = ['Block', 'Name'].concat(sampleGenotypes.sampleNames);
          } else {
            /** Omit Ref & Alt from sampleNames because vcfFeatures2MatrixView() prepends refAltColumns. */
            function omitRefAlt(sampleName) {
              return ! refAlt.includes(sampleName) && sampleName;
            }
            const
            sampleNamesSet = featuresArrays
              .reduce(
                (sampleNamesSet, features) => features
                  .reduce(
                    (sampleNamesSet, feature) =>
                      featureSampleNames(sampleNamesSet, feature, omitRefAlt),
                    sampleNamesSet),
                new Set()),
            sampleNames = Array.from(sampleNamesSet.keys()),
            features = featuresArrays.flat(),
            sampleGenotypes =  {createdFeatures : features, sampleNames},
            displayData = vcfFeatures2MatrixView(this.requestFormat, sampleGenotypes);
            this.displayData = displayData;
          }
        }
      }
    }
  }

  @computed(
    'axisBrush.brushedDomain',

    /* Currently all samples results received are displayed; probably will add
     * checkboxes in samples dialog in place of content-editable
     * vcfGenotypeSamplesSelected, then it would make sense to narrow the
     * display to just the samples the user currently selected, and then this
     * dependancy should be enabled :
     *   'vcfGenotypeSamplesSelected',
     */

    'blockService.viewedVisible',
    'requestFormat', 'rowLimit'
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
