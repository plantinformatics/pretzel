import $ from 'jquery';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

export default Component.extend({
  apiServers: service(),

  classNames : ['api-server' ],

  /**
   * @param server
   */
  getDatasets : function (server) {
    server.getDatasets();
  },

  actions: {
    getDatasets : function () {
      let server = this.get('data');
      console.log('action getDatasets', this, server);
      this.getDatasets(server);
    }
  },
  allelematrices() {
    const
    fnName = 'allelematrices',
    server = this.get('data'),
    url = server.germinateInstance.brapi_root.brapi.brapi_base_url;
    if (url.match(/localhost:30/)) {
      server.allelematrices();
    } else {
      server.variantsets_references_samples_allelematrices();
    }
  },

});
