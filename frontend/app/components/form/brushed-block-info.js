import Component from '@glimmer/component';

import { action } from '@ember/object';
import { inject as service } from '@ember/service';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/**
 * @param 
 */
export default class FormBrushedBlockInfoComponent extends Component {
  @service('data/block') blockService;

  
}
