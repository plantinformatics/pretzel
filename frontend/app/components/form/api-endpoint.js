import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  apiEndpoints: service('api-endpoints'),
  dataset: service('data/dataset'),


  /** Indexed by host url, value is an array of blocks returned from the api host.
   * passed in from manage-explorer.hbs, through to api-endpoint
   * datasetsBlocks
   */

  getDatasets : function (endpoint) {
    let datasetService = this.get('dataset');
    let taskGetList = datasetService.get('taskGetList');  // availableMaps
    let datasetsTask = taskGetList.perform(endpoint);
    let me = this,
    datasetsBlocks = this.get('datasetsBlocks'),
    datasetsHandle = endpoint && endpoint.host && endpoint.host_safe();

    datasetsTask.then(function (blockValues) {
      console.log(datasetsHandle, 'datasetsTask then', blockValues);
      if (datasetsHandle)
      {
        /** computed property dependent keys .@each and .[] only pertain to
         * arrays, not hashes, so instead of datasetsBlocks[datasetsHandle] =
         * blockValues, maintain datasetsBlocks[] as an array of [key, value]
         * pairs, i.e. [datasetsHandle, blockValues]
         */
        let i, found;
        for (i=0, found = false; (i < datasetsBlocks.length) && !found; i++) {
          found = (datasetsBlocks[i][0] == datasetsHandle);
          if (found)
            datasetsBlocks[i][1] = blockValues;
        };
        if (! found)
          datasetsBlocks.push([datasetsHandle, blockValues]);
        // datasetsBlocks[datasetsHandle] = blockValues;
        // me.set("datasetsBlocks." + datasetsHandle, blockValues);
        me.sendAction('receivedDatasets', datasetsHandle, blockValues);
      }
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
