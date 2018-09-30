import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  apiEndpoints: service('api-endpoints'),
  dataset: service('data/dataset'),

  getDatasets : function (endpoint) {
    let datasetService = this.get('dataset');
    let taskGetList = datasetService.get('taskGetList');  // availableMaps
    let datasetsTask = taskGetList.perform(endpoint);

    datasetsTask.then(function (blockValues) {
      console.log('datasetsTask then', blockValues);
    });

    console.log('getDatasets', this);
  },


  actions: {
    getDatasets : function () {
      let endpoint = this.get('data');
      console.log('action getDatasets', this, endpoint);
      this.getDatasets(endpoint);
    }
  }

});
