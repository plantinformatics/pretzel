import Component from '@glimmer/component';
import { computed, action, set } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { A as Ember_A } from '@ember/array';

import { intervalSize } from '../../utils/interval-calcs';
import { overlapInterval } from '../../utils/draw/zoomPanCalcs';
import { addFeaturesJson, vcfFeatures2MatrixView } from '../../utils/data/vcf-feature';

// -----------------------------------------------------------------------------

const dLog = console.debug;

const maxRequestInterval = 1e6;

// -----------------------------------------------------------------------------


/**
 * @param block selected data block
 */
export default class PanelManageGenotypeComponent extends Component {
  @service() controls;
  @service() auth;
  /** used for axisBrush.brushedAxes to instantiate axis-brush s. */
  @service('data/flows-collate') flowsService;
  @service('data/block') blockService;
  @service('data/selected') selected;

  @alias('controls.apiServerSelectedOrPrimary') apiServerSelectedOrPrimary;

  // ---------------------------------------------------------------------------

  @tracked
  vcfGenotypeText = '';

  @tracked
  vcfGenotypeSamplesText = '';

  // @tracked
  @alias('args.userSettings.vcfGenotypeSamplesSelected')
  vcfGenotypeSamplesSelected;

  displayData = Ember_A();

  /** in .args.userSettings : */
  /** true means replace the previous result Features added to the block. */
  // replaceResults = undefined;

  @tracked
  axisBrushBlockIndex = undefined;

  // ---------------------------------------------------------------------------

  constructor() {
    super(...arguments);


    if (this.args.userSettings.vcfGenotypeSamplesSelected === undefined) {
      this.args.userSettings.vcfGenotypeSamplesSelected =
        'ExomeCapture-DAS5-003024\nExomeCapture-DAS5-003047';
    }

    this.requestFormat =
      this.args.userSettings.requestFormat || 'Numerical';

    if (this.args.userSettings.replaceResults === undefined) {
      this.args.userSettings.replaceResults = true;
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

  /** called when this component is inserted (as with didInsertElement).
   * This can evolve to CPs once the requirements are established.
   */
  @computed // ('selected.sampleNames.length')
  get initialDisplayEffect() {
    let sampleNames = this.selected.get('sampleNames');
    if (sampleNames?.length) {
      set(this, 'args.userSettings.vcfGenotypeSamplesSelected', sampleNames.join('\n'));
      if (this.axisBrushBlock) {
        this.showBlockIntervalSamplesGenotype();
      }
    }
  }

  // ---------------------------------------------------------------------------

  /** 
   *    requestFormat : string : 'CATG', 'Numerical'
   */

  /** The user can choose the format of information to request from bcftools,
   * which is associated with a corresponding Renderer. */
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
    let abb = axisBrushes && (this.axisBrushBlockIndex !== undefined) &&
      axisBrushes[this.axisBrushBlockIndex];
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
   * May later pass dataset .meta.vcfFilename
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

  /** Return brushed VCF blocks
   * @return [[axisBrush, vcfBlock], ...]
   * axisBrush will be repeated when there are multiple vcfBlocks on the axis of that axisBrush.
   */
  @computed('flowsService.axisBrush.brushedAxes')
  get brushedVCFBlocks() {
    const
    fnName = 'brushedVCFBlocks',
    axisBrushes = this.flowsService.axisBrush.brushedAxes,
    blocks = axisBrushes.map((ab) => {
      let
      axis1d = ab.block.get('axis1d'),
      vcfBlocks = axis1d.brushedBlocks.filter((b) => b.get('datasetId').content.hasTag('VCF')),
      ab1 = vcfBlocks.map((vb) => [ab, vb]);
      return ab1;
    })
      .flat();
    dLog(fnName, axisBrushes, blocks);
    if (blocks.length) {
      if (this.args.userSettings.lookupBlock !== undefined) {
        this.axisBrushBlockIndex = blocks.findIndex((abb) => abb[1] === this.args.userSettings.lookupBlock);
        dLog(fnName, this.axisBrushBlockIndex, blocks[this.axisBrushBlockIndex][1].id, blocks, this.args.userSettings.lookupBlock.id);
      } else if ((this.axisBrushBlockIndex === undefined) || (this.axisBrushBlockIndex > blocks.length-1)) {
        /* first value is selected. if only 1 value then select onchange action will not be called.  */
        this.axisBrushBlockIndex = 0;
      }
    }
    return blocks;
  }

  // ---------------------------------------------------------------------------


  /** mapview : selectedDataset is the reference (parent) of the selected axis.
   */
  @computed('dataset')
  get referenceDataset () {
    let dataset = this.args.dataset;
    return dataset;
  }

  @computed('referenceDataset')
  get datasetName () {
    let
    name = this.referenceDataset?.id;
    dLog('datasetName', name);
    return name;
  }


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

  @computed('axisBrush.brushedDomain')
  get vcfGenotypeLookupDomain () {
    /** copied from sequenceLookupDomain() axis-brush.js
     * could be factored to a library - probably 2 1-line functions - not compelling.
     */
    let
    domain = this.axisBrush?.brushedDomain,
    domainInteger = domain && 
      (intervalSize(domain) <= maxRequestInterval) &&
      domain.map((d) => d.toFixed(0));
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
      preArgs = 'query -l',
      parent = this.datasetName;

      let textP = this.auth.vcfGenotypeSamples(
        this.apiServerSelectedOrPrimary, vcfDatasetId, scope,
        {} );
      textP.then(
        (text) => {
          dLog(fnName, text);
          this.vcfGenotypeSamplesText =  text?.text;
        });
    }
  }

  // ---------------------------------------------------------------------------

  /** Lookup the genotype for the selected samples in the interval of the brushed block.
   */
  vcfGenotypeLookup() {
    const
    fnName = 'vcfGenotypeLookup',
    /** this.args.dataset, this.axisBrush.block are currently the reference; lookup the data block. */
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
      let
      scope = this.lookupScope,
      region = scope + ':' + domainInteger.join('-'),
      preArgs = {region, samples, requestFormat : this.requestFormat},
      parent = this.datasetName;

      /** Currently passing datasetId as param 'parent', until requirements evolve.
       * The VCF dataset directories are just a single level in $vcfDir;
       * it may be desirable to interpose a parent level, e.g. 
       * vcf/
       *   Triticum_aestivum_IWGSC_RefSeq_v1.0/
       *     Triticum_aestivum_IWGSC_RefSeq_v1.0_vcf_data
       * It's not necessary because datasetId is unique.
       * (also the directory name could be e.g.  dataset._meta.vcfFilename instead of the default datasetId).
       */
      let textP = this.auth.vcfGenotypeLookup(
        this.apiServerSelectedOrPrimary, vcfDatasetId, scope, preArgs,
        {} );
      textP.then(
        (textObj) => {
          const text = textObj.text;
          this.vcfGenotypeText = text;
          /** .lookupDatasetId is derived from .lookupBlock so .lookupBlock must be defined here. */
          let blockV = this.lookupBlock;
          dLog(fnName, text.length, text && text.slice(0,200), blockV.get('id'));
          if (text && blockV) {
            const added = addFeaturesJson(
              blockV, this.requestFormat, this.args.userSettings.replaceResults,
              this.args.selectedFeatures, text);
            if (added.createdFeatures && added.sampleNames) {
              const displayData = vcfFeatures2MatrixView(blockV, this.requestFormat, added);
              this.displayData.addObjects(displayData);
              /* Retain sampleNames for continuity when user is switching between tabs. */
              this.selected.set('sampleNames', added.sampleNames);
            }
          }
        });
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
  showSamplesWithinBrush() {
    const fnName = 'showSamplesWithinBrush';
    if (! this.axisBrush || ! this.lookupBlock) {
      // perhaps clear table
    } else {
      const
      referenceBlock = this.axisBrush?.get('block'),
      /** expect : block.referenceBlock === referenceBlock
       */
      block = this.lookupBlock,
      /** also done in vcfGenotypeLookup(), .trimStart().trimEnd() could be a CP;
       * this results in an array. */
      samplesText = this.vcfGenotypeSamplesSelected?.trimStart().trimEnd(),
      sampleNames = samplesText?.split(/[\n \t\r]/)
      .filter((s) => s !== '');
      dLog(fnName, block?.get('id'), sampleNames, this.selected.get('sampleNames'));
      if (block && sampleNames.length) {
        const
        createdFeatures = block.get('features').toArray(),
        interval = this.axisBrush.brushedDomain,
        // based on similar in featureInRange().
        valueInInterval = this.controls.get('view.valueInInterval'),
        /** filter by axisBrush.brushedDomain */
        features = createdFeatures.filter((f) => valueInInterval(f.value, interval));

        if (features?.length) {
          let sampleGenotypes = {createdFeatures : features, sampleNames};
          const displayData = vcfFeatures2MatrixView(block, this.requestFormat, sampleGenotypes);
          this.displayData.addObjects(displayData);
        }
      }
    }
  }

  @computed('axisBrush.brushedDomain', 'vcfGenotypeSamplesSelected')
  get selectedSampleEffect () {
    // remove all because sampleNames / columns may have changed.
    if (this.displayData.length) {
      this.displayData.removeAt(0, this.displayData.length);
    }
    this.showSamplesWithinBrush();
  }


  // ---------------------------------------------------------------------------

}
