import Component from '@glimmer/component';

import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';


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

}
