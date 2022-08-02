import Component from '@glimmer/component';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { A as Ember_A } from '@ember/array';

import { intervalSize } from '../../utils/interval-calcs';
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

  /**
   * @return model:axis-brush
   */
  @computed('flowsService.axisBrush.brushedAxes')
  get axisBrush() {
    let axisBrushes = this.flowsService.axisBrush.brushedAxes;
    return axisBrushes && axisBrushes[0];
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
    let domain = this.axisBrush.brushedDomain;
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
            }
          }
        });
    }
  }

  // ---------------------------------------------------------------------------

}
