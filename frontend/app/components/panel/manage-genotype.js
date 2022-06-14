import Component from '@glimmer/component';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';


import { intervalSize } from '../../utils/interval-calcs';

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

  @alias('controls.apiServerSelectedOrPrimary') apiServerSelectedOrPrimary;

  // ---------------------------------------------------------------------------

  @tracked
  vcfGenotypeText = '';

  // ---------------------------------------------------------------------------

  /**
   * @return model:axis-brush
   */
  @computed('flowsService.axisBrush.brushedAxes')
  get block() {
    let blocks = this.flowsService.axisBrush.brushedAxes;
    return blocks && blocks[0];
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

  @computed('block.brushedDomain')
  get brushedDomainRounded () {
    /** copied from axis-brush.js */
    let domain = this.block.brushedDomain;
    if (domain) {
      domain = domain.map((d) => d.toFixed(2));
    }
    return domain;
  }

  @computed('block.brushedDomain')
  get vcfGenotypeLookupDomain () {
    /** copied from sequenceLookupDomain() axis-brush.js
     * could be factored to a library - probably 2 1-line functions - not compelling.
     */
    let
    domain = this.block?.brushedDomain,
    domainInteger = domain && 
      (intervalSize(domain) <= maxRequestInterval) &&
      domain.map((d) => d.toFixed(0));
    return domainInteger;
  }

  // ---------------------------------------------------------------------------

  vcfGenotypeLookup() {
    let
    domainInteger = this.vcfGenotypeLookupDomain;
    if (domainInteger) {
      let
      scope = this.block?.get('block.scope'),
      region = 'chr' + scope + ':' + domainInteger.join('-'),
      preArgs = '-r ' + region + ' -s ExomeCapture-DAS5-003024,ExomeCapture-DAS5-003047',
      parent = this.datasetName;

      let textP = this.auth.vcfGenotypeLookup(
        this.apiServerSelectedOrPrimary, parent, preArgs,
        {} );
      textP.then(
        (text) => {
          dLog('vcfGenotypeLookup', text);
          this.vcfGenotypeText =  text?.sequence;
        });
    }
  }

  // ---------------------------------------------------------------------------

}
