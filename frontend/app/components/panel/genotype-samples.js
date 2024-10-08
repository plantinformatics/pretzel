import Component from '@glimmer/component';

import { action } from '@ember/object';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

export default class PanelGenotypeSamplesComponent extends Component {

  constructor() {
    super(...arguments);

    dLog('genotype-samples', 'showIntersectionCheckbox', this.args.showIntersectionCheckbox);
  }

  @action
  vcfGenotypeSamples() {
    this.args.the.vcfGenotypeSamples();
  }

  @action 
  nameFilterChanged(event) {
    this.args.the.nameFilterChanged(event.target.value);
  }

}
