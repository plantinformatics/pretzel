import Component from '@glimmer/component';

import {
  Block,
  Stacked,
  Stack,
  stacks,
  xScaleExtend,
  axisRedrawText,
  axisId2Name
} from '../../utils/stacks';


export default class DrawStackViewComponent extends Component {

  constructor() {
    super(...arguments);

    this.axisTransformO = Stack.prototype.axisTransformO;
  }

}
