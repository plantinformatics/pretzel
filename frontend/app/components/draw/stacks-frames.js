import Component from '@glimmer/component';
import { inject as service } from '@ember/service';


import { stacks } from '../../utils/stacks';

export default class DrawStacksFramesComponent extends Component {
  @service('data/block') block;

  stacks = [1, 2];  // stacks

  get stacksCount () {
    return this.block.stacksCount;
  }
}
