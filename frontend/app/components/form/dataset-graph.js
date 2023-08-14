import Component from '@glimmer/component';
import { computed } from '@ember/object';

import { toPromiseProxy } from '../../utils/ember-devel';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/** Show a message to the user, using alert().
 */
function userMessage(text) {
  alert(text);
}

//------------------------------------------------------------------------------


export default class FormDatasetGraphComponent extends Component {

  userMessage = userMessage;

  constructor() {
    super(...arguments);

    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.datasetGraph = this;
    }

    dLog('constructor', this.args.datasetEmbeddings);
  }

  @computed('args.datasetEmbeddings')
  get datasetEmbeddings() {
    let proxy = toPromiseProxy(this.args.datasetEmbeddings);
    return proxy;
  }
}
