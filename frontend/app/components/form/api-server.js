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
    germinate = server.germinateInstance;
    dLog(fnName, this.name, this.attrs, this.data, germinate, germinate.brapi_root, this.__proto__);
    /*
     * function allelematrices(params, behavior)​
     * function allelematrices_search(params, behavior)​
      */
    const data = {dataset : 'dataset1'};
    germinate.brapi_root
      //.data([data])
      .allelematrices(data)
      .all(function(objects){
        dLog(fnName, objects);
      });
  },

});
