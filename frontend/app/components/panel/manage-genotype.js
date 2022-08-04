import Component from '@glimmer/component';
import { computed, action } from '@ember/object';
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

  @tracked
  vcfGenotypeSamplesSelected = 
    'ExomeCapture-DAS5-003024\nExomeCapture-DAS5-003047';

  displayData = Ember_A();

  /** true means replace the previous result Features added to the block. */
  replaceResults = true;

  @tracked
  axisBrushBlockIndex = undefined;

  // ---------------------------------------------------------------------------

  @action
  mut_axisBrushBlockIndex(value) {
    dLog('axisBrushBlockIndex', value, arguments, this);
    this.axisBrushBlockIndex = value;
  }

  // ---------------------------------------------------------------------------

  /** called when this component is inserted (as with didInsertElement).
   * This can evolve to CPs once the requirements are established.
   */
  @computed // ('selected.sampleNames.length')
  get initialDisplayEffect() {
    let sampleNames = this.selected.get('sampleNames');
    if (sampleNames?.length) {
      this.vcfGenotypeSamplesSelected = sampleNames.join('\n');
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
  requestFormat = 'Numerical';
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
    if (blocks.length && (this.axisBrushBlockIndex === undefined)) {
      /* first value is selected. if only 1 value then select onchange action will not be called.  */
      this.axisBrushBlockIndex = 0;
    }
    return blocks;
  }

  // ---------------------------------------------------------------------------


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
    let
    fnName = 'vcfGenotypeSamples',
    scope = this.axisBrush?.get('block.scope');
    if (scope)  // if this.dataset.hasTag('view'),  .meta.vcfFilename
    {
      let
      preArgs = 'query -l',
      parent = this.datasetName;

      let textP = this.auth.vcfGenotypeSamples(
        this.apiServerSelectedOrPrimary, parent, scope,
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
    let
    /** this.args.dataset, this.axisBrush.block are currently the reference; lookup the data block. */
    // store = this.axisBrush?.get('block.store'),
    store = this.apiServerSelectedOrPrimary?.store,
    datasetNameV = 'Triticum_aestivum_IWGSC_RefSeq_v1.0_vcf_data',
    datasetV = store.peekRecord('dataset', datasetNameV),
    samples = this.vcfGenotypeSamplesSelected,
    domainInteger = this.vcfGenotypeLookupDomain;
    samples = samples?.trimStart().trimEnd();
    if (samples?.length && domainInteger) {
      let
      scope = this.axisBrush?.get('block.scope'),
      region = 'chr' + scope + ':' + domainInteger.join('-'),
      preArgs = {region, samples, requestFormat : this.requestFormat},
      parent = this.datasetName;

      let textP = this.auth.vcfGenotypeLookup(
        this.apiServerSelectedOrPrimary, parent, preArgs,
        {} );
      textP.then(
        (textObj) => {
          const text = textObj.text;
          dLog('vcfGenotypeLookup', text.length, text && text.slice(0,200), datasetV);
          this.vcfGenotypeText =  text;
          /** datasetV?.get('blocks').findBy('scope', scope)  */
          // let blockV = datasetV?.get('blocks.0');
          let blockV = this.blockService.viewed.find(
            (b) => (b.get('scope') === scope) && (b.get('datasetId.id') === datasetNameV));
          if (text && blockV) {
            const added = addFeaturesJson(
              blockV, this.requestFormat, this.replaceResults,
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
      let
      referenceBlock = this.axisBrush?.get('block'),
      /** expect : block.referenceBlock === referenceBlock
       */
      block = this.lookupBlock,
      sampleNames = this.vcfGenotypeSamplesSelected?.split('\n');
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

  // ---------------------------------------------------------------------------

}
