import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  apiEndpoints: service('api-endpoints'),

  /**
   * @param endpoint
   */
  getDatasets : function (endpoint) {
    let apiEndpoints = this.get('apiEndpoints');
    apiEndpoints.getDatasets(endpoint);
  },

  actions: {
    getDatasets : function () {
      let endpoint = this.get('data');
      console.log('action getDatasets', this, endpoint);
      this.getDatasets(endpoint);
    }
  }

});
