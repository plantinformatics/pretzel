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
/** Limit for the number of genotypeIds included in the Genolink search URL. */
const genolinkSearchIdsLimit = 100;


//------------------------------------------------------------------------------

import { clipboard_writeText } from '../../utils/common/html';
import { exportObjectsAsCSVFile } from '../../utils/dom/file-download';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

export default class PanelGenotypeSamplesComponent extends Component {
  @service('query-params') queryParamsService;

  @alias('queryParamsService.urlOptions') urlOptions;

  //----------------------------------------------------------------------------

  /*
  constructor() {
    super(...arguments);

    dLog('genotype-samples', 'showIntersectionCheckbox', this.args.showIntersectionCheckbox);
  }
  */

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
    aggSamples = g.selectedSamples.filter(s => s.match(/^AGG/)),
    genotypeIds = aggSamples,
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

  /** Copy selected samples to a query URL to open in a Genolink tab 
   * 
   * Note on Genolink query params for search by GenotypeId :
   *
   * Example URL :
   * https://genolink.plantinformatics.io/?filterMode=GenotypeId%20Filter&genotypeIds=AGG1WHEA1-B00014-1-01,AGG2WHEA1-B00014-1-09,AGG3WHEA1-B00002-1-39
   *
   * The character limit for Chrome, Firefox, and Edge is around 80,000
   * characters for URLs.
   * To keep the URL within this character limit, we should limit the number of
   * IDs included in the GET request sent to genolink.
   *
   *  For now, limit that to 100 IDs (ie: if there's more than that in the list,
   *  the button can't be clicked and a message like "max 100 IDs" is displayed)
   *
   * Only AGG samples are included in the URL, because Genolink has only AGG samples.
   * To test this without an AGG dataset, it is sufficient to paste AGG sample
   * names into the <Textarea selectedSamplesText >.
   *
   * @return string URL if there are selected samples which match the pattern for
   * the samples which are loaded in Genolink (/^AGG/).
   * Otherwise return falsey :
   * - undefined if ! .selectedSamples
   * - 0 if there are no AGG samples selected
   */

  @computed('args.the.selectedSamples.length')
  get genolinkSearchURL() {
    const
    fnName = 'genolinkSearchURL',
    g = this.args.the;
    if (! g.selectedSamples) {
      return undefined;
    }
    const
    aggSamples = g.selectedSamples.filter(s => s.match(/^AGG/)),
    truncatedMessage = (aggSamples.length > genolinkSearchIdsLimit) ? 'Maximum 100 IDs' : '',
    gIdsTruncated = truncatedMessage ? aggSamples.slice(0, genolinkSearchIdsLimit) : aggSamples,
    /** Sample / Accession names are system data not user data, and do not require quoting ATM. */
    genotypeIds = gIdsTruncated.join(','),
    url = aggSamples.length &&
      (genolinkBaseUrl + '?filterMode=GenotypeId%20Filter&genotypeIds=' + genotypeIds);
    if (aggSamples.length < g.selectedSamples.length) {
      dLog(fnName, g.selectedSamples.length - aggSamples.length,
           "selectedSamples not matching /^AGG/ are filtered out");
    }
    Ember_set(this, 'searchIdsTruncatedMessage', truncatedMessage);
    /* copy result to manage-genotype so it can be displayed in the tool banner
     * above the Genotype Table; the GUI location of this button is in flux. */
    Ember_set(g, 'genolinkSearchURL', url);
    return url;
  }


 

}
