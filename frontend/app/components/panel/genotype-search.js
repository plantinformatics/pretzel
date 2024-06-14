import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import EmberObject, { computed, action } from '@ember/object';
import { alias, reads } from '@ember/object/computed';
import { later } from '@ember/runloop';

import { tracked } from '@glimmer/tracking';

//------------------------------------------------------------------------------

import { statusToMatrix } from '../../utils/data/vcf-files';

import { namesTrim } from '../../utils/string';

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

//------------------------------------------------------------------------------

export default class PanelGenotypeSearchComponent extends Component {
  @service() controls;
  @service('data/dataset') datasetService;
  @service() auth;

/*
  // @alias('args.userSettings')
  @alias('manageGenotype.selectedSamplesText') selectedSamplesText
  constructor() {
    this.manageGenotype = null;
  }
*/

  //----------------------------------------------------------------------------

  @tracked
  selectedDatasetId = null;

  @tracked
  selectedSamplesText;
  @tracked
  selectedFeaturesText;

  @tracked
  vcfFiles;

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.genotypeSearch = this;
    }
  }

  get manageGenotype() {
    return this.controls.registrationsByName['component:panel/manage-genotype'];
  }

  @computed('controls.apiServerSelectedOrPrimary.datasetsBlocks')
  get datasetsForSearch() {
    const
    apiServer = this.controls.apiServerSelectedOrPrimary,
    datasets = apiServer.datasetsBlocks?.filter(d => d.hasTag('VCF'));
    return datasets;
  }

  @computed('selectedDatasetId')
  get selectedDataset() {
    const
    /** By passing original=true, the result .length should be <= 1.
     * datasets[] elements are e.g. { name: "http___localhost_3000", server: {...}, store: {...}, dataset: {...} }
 */
    datasets = this.datasetService.datasetsForName(this.selectedDatasetId, /*original*/true);
    return datasets?.[0]?.dataset;
  }

  @computed('selectedDatasetId')
  get datasetVcfFiles() {
    /** Effect : this value .datasetVcfFiles is exposed in hbs so that the
     * vcfFiles are requested for the selected dataset.
     *
     * The text value could be displayed via a Proxy but is not required, it
     * displays as : <div style="display:none">[object Object]</div>
     */
    const
    datasetId = this.selectedDatasetId,
    filesP = datasetId &&
      this.auth.getFeaturesCountsStatus(datasetId, /*options*/undefined)
      .then(vcfStatus => {
        if (false) {
        const
        status = statusToMatrix(vcfStatus?.text),
        /** .vcf.gz files for this dataset, filtering out .MAF and .MAF.SNPList .vcf.gz */
        files = status.rows.mapBy(row => row['']);
          // filterBy('Name', name => ! name.match('.MAF');
        // note : . is unicodeDot here.  see statusToMatrix().
        // ! chr?.['·MAF·SNPList'];
        }
        const
        /** .vcf.gz files for this dataset, filtering out .MAF and .MAF.SNPList .vcf.gz */
        vr = vcfStatus.text.split('\n').filter(r =>
          !r.match('.MAF') && ! r.match('.csi') && r.match(/\.vcf\.gz$/)),
        /* row contains file size, date, name; extract name, assuming it does
         * not contain spaces. e.g. " 291386658 Jan 9 21:30 chr1A.vcf.gz" */
        files = vr.map(r => r.replace(/.* /, ''));
        this.vcfFiles = files;
        this.selectedDataset[Symbol.for('vcfFiles')] = files;
        return files;
      });
    return filesP;
  }

  @action
  sampleNameListInputKey(value) {
    const fnName = 'sampleNameListInputKey';
    dLog(fnName, value.length);
    if (this.manageGenotype) {
      this.manageGenotype.vcfGenotypeSamplesSelected = this.selectedSamples;
    }
  }
  @action
  sampleNameListInput(value, event) {
    const fnName = 'sampleNameListInput';
    dLog(fnName, value.length, event.target.value.length); // , event
    if (this.manageGenotype) {
      this.manageGenotype.vcfGenotypeSamplesSelected = this.selectedSamples;
    }
  }

  @action
  featureNameListInputKey(a, b, c) {
    const fnName = 'featureNameListInputKey';
    dLog(fnName, a, b, c);
  }
  @action
  featureNameListInput(a, b, c) {
    const fnName = 'featureNameListInput';
    dLog(fnName, a, b, c);
  }

  /** Convert string selectedSamplesText into an array.
   */
  @computed('selectedSamplesText')
  get selectedSamples() {
    const
    samples = ! this.selectedSamplesText ? [] :
      this.manageGenotype?.sampleNameListInputParse(namesTrim(this.selectedSamplesText));
    return samples;
  }

  /** The dependency on manageGenotype does not cause update; possibly use
   * Evented listener to monitor for manage-genotype lifecycle events.
   */
  @computed('selectedSamplesText', 'selectedFeaturesText', 'vcfFiles', 'manageGenotype')
  get vcfGenotypeSearchDisabled() {
    const
    fnName = 'vcfGenotypeSearchDisabled',
    disabled = 
      ! this.selectedSamplesText?.length ||
      ! this.selectedFeaturesText?.length ||
      ! this.vcfFiles?.length ||
      ! this.manageGenotype;
    dLog(
      fnName, disabled,
      this.selectedSamplesText?.length,
      this.selectedFeaturesText?.length,
      this.vcfFiles?.length,
      !! this.manageGenotype);
    if (this.manageGenotype) {
      this.manageGenotype.vcfGenotypeSamplesSelected = this.selectedSamples;
    }
    return disabled;
  }

  @action
  vcfGenotypeSearch() {
    const fnName = 'vcfGenotypeSearch';
    const searchScope = {datasetVcfFiles : this.vcfFiles, snpNames : namesTrim(this.selectedFeaturesText)};
    /** vcfGenotypeSearchDisabled prevents call to vcfGenotypeSearch() if ! this.manageGenotype */
    const manageGenotype = this.manageGenotype;
    /** Signify that manageGenotype component is operating under the control of
     * the genotype-search dialog / "automation wizard".
     */
    manageGenotype.args.userSettings.dialogMode =
      {component : 'genotype-search', datasetId : this.selectedDatasetId};
    this.manageGenotype.vcfGenotypeLookupDataset(
      /*blockV*/ undefined,
      /*vcfDatasetId*/ this.selectedDataset,  // [genotype-search] dataset instead of datasetId
      /*intersection*/ undefined,
      /*scope*/ undefined,
      /*domainInteger*/ searchScope,
      /*samples*/ namesTrim(this.selectedSamplesText),
      /*samplesLimitEnable*/ false);
    later(() => manageGenotype.args.userSettings.dialogMode = null, 10000);

    dLog(fnName);
  }
  

}
