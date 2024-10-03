import Component from '@glimmer/component';

import { action } from '@ember/object';

export default class PanelGenotypeSamplesComponent extends Component {

  @action
  vcfGenotypeSamples() {
    this.args.the.vcfGenotypeSamples();
  }

  @action 
  nameFilterChanged(event) {
    this.args.the.nameFilterChanged(event.target.value);
  }

}
