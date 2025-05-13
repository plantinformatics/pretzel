import Component from '@glimmer/component';

import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';

import { clipboard_writeText } from '../../utils/common/html';

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

}
