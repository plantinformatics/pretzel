import EmberObject, { computed } from '@ember/object';

import { default as ApiServer } from './api-server';
import { Germinate } from '../../utils/data/germinate';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

export default ApiServer.extend({

  //----------------------------------------------------------------------------
  /** override some methods of ApiServer */
  init() {
    this._super(...arguments);

    this.set('groups', null);
    /* .germinateInstance is set by ServerLogin()
    this.germinate = new Germinate(); */
    dLog('germinate', this);
    if (window.PretzelFrontend) {
      window.PretzelFrontend.apiServerGerminate = this;
    }
  },
  willDestroy() {
    this._super(...arguments);
  },

  get blockFeatureTraits() { return []; },
  get blockFeatureOntologies() { return []; },

  getVersion : function () { return ''; },
  getDatasets : function () { return []; }, 

  featuresCountAllTaskInstance : computed(function () {
    return [];
  }),
  // ?  blocksByReferenceAndScope : computed(

  //----------------------------------------------------------------------------

});
