import $ from 'jquery';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

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
  }

});
