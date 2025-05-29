import Component from '@glimmer/component';

import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';

//------------------------------------------------------------------------------

import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
const /*import */{
  getPassportDataByGenotypeIds,
} = vcfGenotypeBrapi.genolinkPassport; /*from 'vcf-genotype-brapi'; */

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
    baseUrl = "https://genolink.plantinformatics.io",
    passportP = aggSamples.length ? getPassportDataByGenotypeIds(aggSamples, baseUrl) :
      Promise.reject('No AGG samples out of ' + g.selectedSamples.length);
    passportP.then(resultByGenotype => {
      console.log("Result by genotype IDs:", resultByGenotype);
      const data = resultByGenotype.content;
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

}
