import Component from '@glimmer/component';

import { action, computed, set as Ember_set } from '@ember/object';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';

//------------------------------------------------------------------------------

import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
const /*import */{
  getPassportData,
} = vcfGenotypeBrapi.genolinkPassport; /*from 'vcf-genotype-brapi'; */

/** Base URL for HTTP GET request to open Genolink with the result of a search
 * for genotypeIds included in the URL.
 */
const genolinkBaseUrl = "https://genolink.plantinformatics.io";


//------------------------------------------------------------------------------

import { clipboard_writeText } from '../../utils/common/html';
import { exportObjectsAsCSVFile } from '../../utils/dom/file-download';
import { sampleNamePassportValues } from '../../utils/data/vcf-feature';



//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

//------------------------------------------------------------------------------

export default class PanelGenotypeSamplesComponent extends Component {
  @service('query-params') queryParamsService;

  @alias('queryParamsService.urlOptions') urlOptions;

  sampleNamePassportValues = sampleNamePassportValues;

  //----------------------------------------------------------------------------

  get enablePassportData() {
    const
    enable = this.args.enablePassportData &&
      (this.activeDataset?.isGenolink &&
       (this.urlOptions.tableRow || this.urlOptions.multiSelect));
    return enable;
  }

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    if (trace) {
      dLog('genotype-samples', 'showIntersectionCheckbox', this.args.showIntersectionCheckbox);
    }

    if (window.PretzelFrontend) {
      window.PretzelFrontend.genotypeSamples = this;
    }

  }

  //----------------------------------------------------------------------------

  /** .matchExactAlleles is the inverse of @userSettings.matchHet
   * This is added as a wrapper when the decision was made to invert the sense
   * of the checkbox in the GUI.
   */
  get matchExactAlleles() {
    return ! this.args.userSettings.matchHet;
  }
  set matchExactAlleles(matchExactAlleles) {
    Ember_set(this, 'args.userSettings.matchHet', ! matchExactAlleles);
  }

  //----------------------------------------------------------------------------

  /** Testing without this, using alias instead which is the same but lacks the
   * fallback value (.lookupBlock.datasetId) - seems OK.  Not decided.
   */
  get activeDataset_Disabled() {
    const
    mg = this.args.the,
    /** activeDataset is derived from brushedOrViewedVCFBlocksVisible,
     * but depends on setSelectedDataset() which is called in later(),
     * so provide a direct fallback.
     * Related : axisBrushBlock(), lookupBlockWithinBlocks(), selectDataset(),
     * mut_axisBrushBlockIndex().
     */
    dataset = mg.activeDataset || mg.lookupBlock?.datasetId.content;
    return dataset;
  }
  @alias('args.the.activeDataset') activeDataset;

  //----------------------------------------------------------------------------

  @action
  selectSampleArray(selectedSamples, add) {
    return this.args.the.selectSampleArray(selectedSamples, add);
  }

  //----------------------------------------------------------------------------

  @action
  vcfGenotypeSamples() {
    this.args.the.vcfGenotypeSamples();
  }

  @action 
  nameFilterChanged(event) {
    this.args.the.nameFilterChanged(event.target.value);
  }

  @action
  copyFilteredSamplesToClipboard() {
    const
    fnName = 'copyFilteredSamplesToClipboard',
    samplesText = this.args.the.filteredSamples.join('\n');
    dLog(fnName, this.args.the.filteredSamples.length, samplesText.slice(0, 30));
    clipboard_writeText(samplesText);
  }

  @action
  clearSelectedSamples() {
    const fnName = 'clearSelectedSamples';
    const g = this.args.the;
    dLog(fnName, g.selectedSamples.length, g.selectedSamplesText.length);
    g.selectedSamples = [];
    g.selectedSamplesText = '';
  }

  @action
  selectedSamplesGetPassport() {
    const
    fnName = 'selectedSamplesGetPassport',
    g = this.args.the,
    /** Originally this filtered for samples which matched the AGG name pattern
     * and hence are known to be available on Genolink.  This is no longer
     * required since we now indicate datasets which have samples on Genolink
     * with _meta.GenolinkURL "Genolink", and all their samples are valid for
     * Passport requests.
     *
     *  This was later factored as sampleNameIsAGG().
     * .filter(s => s.match(/^AGG/)),
     */
    aggSamples = g.selectedSamples,
    genotypeIds = aggSamples,
    /** The user may want selectFields to be those of the Genotype Table column
     * headers, or passport-table columns.
     * If the latter, change this to userSettings.passportTable.passportFields */
    passportFields = this.args.userSettings.passportFields,
    selectFields = passportFields.length ? passportFields : undefined,
    passportP = aggSamples.length ?
      Promise.all(
        getPassportData({ genotypeIds, selectFields }, genolinkBaseUrl))
      .then(a => [].concat.apply([], a)) :
      Promise.reject('No AGG samples out of ' + g.selectedSamples.length);
    passportP.then(resultByGenotype => {
      console.log("Result by genotype IDs:", resultByGenotype);
      const data = resultByGenotype;
      // just to test array.
      data.forEach(row => (row.aliases = row.aliases.mapBy('name')));
      const
      needsQuoting = (key, value, columnIndex) => ! key.endsWith('.id') && (value !== null),
      baseColumnHeaders = [];
      exportObjectsAsCSVFile('passportData.csv', needsQuoting, baseColumnHeaders, /*useAllKeys*/true, /*columnHeadersMap*/null, data);
    })
      .catch(err => console.log(err));
    return passportP;
  }

  //----------------------------------------------------------------------------

  @alias('args.the.genolinkSearchURL') genolinkSearchURL;

  //----------------------------------------------------------------------------

  @action
  /** event from Panel::SelectPassportFields indicating that user has selected
   * Passport fields for display in <PassportTable>
   */
  selectedFieldsChanged(values, c, add) {
    if (! add) {
      return Promise.resolve();
    }
    const
    /** not clear yet how best to connect to emberMulti2Table */
    emt = window.PretzelFrontend.emberMulti2Table,
    promise = emt.requestMissing(emt.tableData);

    return promise;
  }

  //----------------------------------------------------------------------------

}
