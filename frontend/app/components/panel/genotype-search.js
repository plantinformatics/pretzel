import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import EmberObject, { computed, action, get as Ember_get, set as Ember_set } from '@ember/object';
import { alias, reads } from '@ember/object/computed';
import { later } from '@ember/runloop';

import { tracked } from '@glimmer/tracking';

import { task } from 'ember-concurrency';

//------------------------------------------------------------------------------

import { statusToMatrix } from '../../utils/data/vcf-files';

import { namesTrim, namesTrimArrayUniq, namesTrimUniq } from '../../utils/string';

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

//------------------------------------------------------------------------------

class ResultCounts {
  @tracked 
  blocks = 0;
  @tracked 
  features = 0;
};


//------------------------------------------------------------------------------

export default class PanelGenotypeSearchComponent extends Component {
  @service() controls;
  @service('data/dataset') datasetService;
  @service() auth;

  @alias('args.userSettings.selectedSamplesText') selectedSamplesText
/*
  constructor() {
    this.manageGenotype = null;
  }
*/

  //----------------------------------------------------------------------------

  @alias('args.userSettings.selectedDatasetId') selectedDatasetId;

  /* @tracked
  selectedSamplesText; */
  @tracked
  selectedFeaturesText;

  @tracked
  vcfFiles;

  @tracked
  resultCount = 0;

  @tracked
  resultCounts = new ResultCounts();

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    // selectedDatasetId is tracked, so this may be required.
    if (this.selectedDatasetId === undefined) {
      this.selectedDatasetId = null;
    }

    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.genotypeSearch = this;
    }
  }

  //----------------------------------------------------------------------------

  @computed('controls.registrationsByName.component:panel/manage-genotype')
  get manageGenotype() {
    return this.controls.registrationsByName['component:panel/manage-genotype'];
  }

  /** manageGenotype.lookupMessage is not effective as a dependency */
  @computed('resultCount', 'manageGenotype')
  get lookupMessage() {
    dLog('lookupMessage', this.resultCount, this.manageGenotype?.lookupMessage);
    return this.manageGenotype?.lookupMessage;
  }

  @computed('controls.apiServerSelectedOrPrimary.datasetsBlocks')
  get datasetsForSearch() {
    const
    apiServer = this.controls.apiServerSelectedOrPrimary,
    datasets = apiServer.datasetsBlocks?.filter(d => d.hasTag('VCF'));
    return datasets;
  }

  //----------------------------------------------------------------------------

  /** User has selected a datasetId from the pull-down list.
   * Set that value .selectedDatasetId.
   * Also use .navigateGenotypeTableP() because .selectedSamplesText depends on .manageGenotype
   */
  @action
  selectDataset(event) {
    this.selectedDatasetId = event.target.value;
    this.navigateGenotypeTableP().then(() => {
      // equivalent : manageGenotype.vcfGenotypeSamplesSelectedAll
      const selectedSamples = this.args.userSettings.vcfGenotypeSamplesSelected[this.selectedDatasetId];
      this.selectedSamplesText = selectedSamples ? selectedSamples.join('\n') : '';
    });
  }


  @computed('selectedDatasetId')
  get selectedDataset() {
    const
    fnName = 'selectedDataset',
    /** By passing original=true, the result .length should be <= 1.
     * datasets[] elements are e.g. { name: "http___localhost_3000", server: {...}, store: {...}, dataset: {...} }
 */
    datasets = this.selectedDatasetId && 
      this.datasetService.datasetsForName(this.selectedDatasetId, /*original*/true),
    /** null if ! this.selectedDatasetId */
    dataset = datasets?.[0]?.dataset;
    if (this.manageGenotype && ! this.manageGenotype.isDestroying) {
      dLog(fnName, this.selectedDatasetId, this.selectedDatasetId === dataset?.get('id'));
      Ember_set(this.args.userSettings, 'selectedDataset', dataset);
    }
    return dataset;
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
          ! r.match('.MAF') && ! r.match('.SNPList') && ! r.match('.csi') && r.match(/\.vcf\.gz$/)),
        /* row contains file size, date, name; extract name, assuming it does
         * not contain spaces. e.g. " 291386658 Jan 9 21:30 chr1A.vcf.gz" */
        files = vr.map(r => r.replace(/.* /, ''));
        this.vcfFiles = files;
        this.selectedDataset[Symbol.for('vcfFiles')] = files;
        return files;
      });
    return filesP;
  }

  /**
   * selectedSNPsInBrushedDomain() are included in the samples search request.
   * Related : .snpsInBrushedDomain, which is updated when
   * .featureFiltersCount changes.
   * Possibly depend on receivedNamesCount instead of featureFiltersCount.
   */
  @computed('selectedDatasetId', 'manageGenotype.featureFiltersCount')
  get ensureSamplesForSelectedDatasetEffect() {
    /** related : manage-genotype : vcfGenotypeSamples()
     */
    const fnName = 'ensureSamplesForSelectedDatasetEffect';
    let datasetId, vcfBlock;
    /** hbs checks that this.manageGenotype?.isDestroying === false */
    const
    manageGenotype = this.manageGenotype,
    filterSamplesByHaplotype = this.args.userSettings.filterSamplesByHaplotype;
    /* The case handling the filterSamplesByHaplotype is moved to
     * manage-genotype.js, and have a parallel Effect there, per brushed block.
     * specifically : brushedVCFBlocks evaluates
     * block.genotypeSamplesFilteredByHaplotypes() ->
     * vcfGenotypeSamplesDataset().
     */
    if (filterSamplesByHaplotype) {
      return;
    } else if (this.selectedDatasetId) {
      datasetId = this.selectedDatasetId;
      /** A block of .selectedDataset, choosing either the first viewed block or
       * the first block. */
      vcfBlock = this.selectedDataset.get('aBlock');
    }
    /** If filterSamplesByHaplotype, the result sampleNames also depends on the
     * filtering haplotypes (i.e. SNPs + genotype values) :
     * selectedSNPsInBrushedDomain().
     * Depending on performance, we might extend
     * sampleCache.sampleNames[datasetId] with [block.scope][filterByHaplotype] where
     * filterByHaplotype is as defined in vcfGenotypeSamplesDataset().
    */
    const sampleNames =
          this.manageGenotype.sampleCache.sampleNames[datasetId];
    if (! sampleNames && datasetId) {
      dLog(fnName, vcfBlock.brushName);
      if (vcfBlock) {
        const textP = this.manageGenotype.vcfGenotypeSamplesDataset(vcfBlock);
      }
    }
  }

  setSamplesSelected() {
    const ok = this.manageGenotype && ! this.manageGenotype.isDestroying;
    if (ok) {
      this.manageGenotype.vcfGenotypeSamplesSelected = this.selectedSamples;
    }
    return ok;
  }
  setSamplesSelectedLater() {
    if (! this.setSamplesSelected()) {
      this.navigateGenotypeTableP().then(() => this.setSamplesSelected());
    }
  }

  @action
  sampleNameListInputKey(value) {
    const fnName = 'sampleNameListInputKey';
    dLog(fnName, value.length);
    this.navigateGenotypeTable();
    this.setSamplesSelectedLater();
  }
  @action
  sampleNameListInput(value, event) {
    const fnName = 'sampleNameListInput';
    dLog(fnName, value.length, event.target.value.length); // , event
    this.setSamplesSelected();
  }

  @action
  featureNameListInputKey(value) {
    const fnName = 'featureNameListInputKey';
    dLog(fnName, value.length);
    this.navigateGenotypeTable();
    this.setSamplesSelectedLater();
  }
  @action
  featureNameListInput(value, event) {
    const fnName = 'featureNameListInput';
    dLog(fnName, value.length, event.code);
  }

  /** Convert string selectedSamplesText into an array.
   */
  @computed('selectedSamplesText')
  get selectedSamples() {
    /** Called from .setSamplesSelected() which ensures that this.manageGenotype?.isDestroying === false */
    const
    samples = ! this.selectedSamplesText ? [] :
      this.manageGenotype?.sampleNameListInputParse(namesTrim(this.selectedSamplesText));
    return samples;
  }

  /** Disable the Search button until the user has selected samples and input
   * features / SNPs.
   */
  @computed('selectedSamplesText.length', 'selectedFeaturesText.length', 'vcfFiles.length')
  get vcfGenotypeSearchDisabled() {
    /* Until 1596ae33, this also depended on 'manageGenotype'; now changed
     * Search button to show manage-genotype if it is not shown.
     */
    const
    fnName = 'vcfGenotypeSearchDisabled',
    disabled = 
      ! this.selectedSamplesText?.length ||
      ! this.selectedFeaturesText?.length ||
      ! this.vcfFiles?.length ||
      this.vcfGenotypeSearchTask.isRunning;
    dLog(
      fnName, disabled,
      this.selectedSamplesText?.length,
      this.selectedFeaturesText?.length,
      this.vcfFiles?.length,
      this.vcfGenotypeSearchTask.isRunning,
      !! this.manageGenotype);
    return disabled;
  }

  @action
  navigateGenotypeTable() {
    this.navigateGenotypeTableP();
  }
  /** Navigate to show the Genotype Table (manage-genotype) in the right panel.
   * Showing the Genotype Table enables this.manageGenotype to be defined.
   * @return promise yielding when manage-genotype is displayed
   */
  navigateGenotypeTableP() {
    const fnName = 'navigateGenotypeTableP';
    /** Select the Genotype Table display manage-genotype in the right panel. */
    this.controls.window.navigation.setTab('right', 'genotype');
    this.controls.window.rightSplitInstance?.setSizes([35, 65]);
    const promise = new Promise((resolve, reject) => {
      /** vcfGenotypeSamplesSelectedAll is used by vcfGenotypeSearch().
       * In manage-genotype : vcfGenotypeSamplesSelectedAll depends on
       * .userSettings.vcfGenotypeSamplesSelected which is set by
       * userSettingsDefaults().
       * Above setTab('right', 'genotype) will ensure manage-genotype is rendered;
       * wait for a render cycle.
       */
      later(() => {
        if (this.manageGenotype && ! this.manageGenotype.isDestroying) {
          Ember_get(this.manageGenotype, 'vcfGenotypeSamplesSelectedAll');
          resolve();
        } else {
          dLog(fnName, 'manageGenotype', this.manageGenotype);
          reject();
        }
      }, 500);
    });
    return promise;
  }


  /** if vcfGenotypeSearchTask is not running, perform it. */
  vcfGenotypeSearch() {
    if (! this.vcfGenotypeSearchTask.isRunning) {
      this.vcfGenotypeSearchTaskInstance = this.vcfGenotypeSearchTask.perform();
    }
  }
  /** Call vcfGenotypeSearchP() in a task - yield the result.
   * This function and vcfGenotypeSearch() are based on the equivalent vcfGenotypeLookup in manage-genotype.js
   */
  vcfGenotypeSearchTask = task({ drop: true }, async () => {
    console.log('vcfGenotypeSearchTask');
    let block = await this.vcfGenotypeSearchP();

    return block;
  });

  //------------------------------------------------------------------------------

  @action
  vcfGenotypeSearchP() {
    const fnName = 'vcfGenotypeSearchP';
    dLog(fnName, this.vcfGenotypeSearchTask.isRunning, 'vcfGenotypeSearchTask.isRunning');
    const snpNames = namesTrimUniq(this.selectedFeaturesText);
    const searchScope = {datasetVcfFiles : this.vcfFiles, snpNames};
    /** Called from vcfGenotypeSearchAfterNavigate() which ensures that this.manageGenotype?.isDestroying === false
     */
    const manageGenotype = this.manageGenotype;
    /** vcfGenotypeSearchDisabled prevents call to vcfGenotypeSearch() if ! this.manageGenotype */
    const userSettings = this.args.userSettings;
    /** Signify that manageGenotype component is operating under the control of
     * the genotype-search dialog / "automation wizard".
     */
    this.args.userSettings.dialogMode =
      {component : 'genotype-search', datasetId : this.selectedDatasetId};
    const resultCounts = (userSettings.resultCounts = this.resultCounts);
    resultCounts.blocks = 0;
    resultCounts.features = 0;

    this.navigateGenotypeTable();

    /** This needs to be tied closely to the user action, not in
     * vcfGenotypeLookupDataset() which can be repeated for one user action. */
    this.manageGenotype.lookupMessage = null;

    const
    samplesArray = namesTrimArrayUniq(this.selectedSamplesText),
    samples = samplesArray.join('\n');
    if (! manageGenotype.vcfGenotypeSamplesSelectedAll) {
      dLog(fnName, 'vcfGenotypeSamplesSelectedAll not defined');
    } else {
      manageGenotype.vcfGenotypeSamplesSelectedAll[this.selectedDatasetId] = samplesArray;
    }
    const
    resultP =
    this.manageGenotype.vcfGenotypeLookupDataset(
      /*blockV*/ undefined,
      /*vcfDatasetId*/ this.selectedDataset,  // [genotype-search] dataset instead of datasetId
      /*intersection*/ undefined,
      /*scope*/ undefined,
      /*domainInteger*/ searchScope,
      /*samples*/ samples,
      /*samplesLimitEnable*/ false);

    /** .resultCount signals that lookupMessage is available, so it should be
     * incremented after .lookupMessage is set.
     * resultP is derived from the promise in whose .catch() .lookupMessage is
     * set; it seems that the .finally() is performed before the .catch(), so
     * use later().
     */
    resultP.finally(() => later(() => {
      this.args.userSettings.dialogMode = null;
      this.resultCount++;
      dLog(fnName, 'resultCount', this.resultCount); }));

    dLog(fnName, searchScope, this.args.userSettings.dialogMode);

    return resultP;
  }

  @action
  vcfGenotypeSearchAfterNavigate() {
    this.navigateGenotypeTableP().then(() => this.vcfGenotypeSearch());
  }

}
