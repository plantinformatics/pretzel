import Ember from 'ember';
import Service from '@ember/service';
import { task } from 'ember-concurrency';

const { inject: { service } } = Ember;


// based on ./block.js

export default Service.extend(Ember.Evented, {
    auth: service('auth'),
    store: service(),
  apiEndpoints: service('api-endpoints'),


  /** Get the list of available datasets, in a task - yield the dataset result.
   * Signal that receipt with receivedDatasets(datasets).
   */
  taskGetList: task(function * () {
    /* This replaces controllers/mapview.js : updateChrs(), updateModel(). */
    let store = this.get('store'),
    apiEndpoints = this.get('apiEndpoints'),
    endpoints = apiEndpoints.get('endpoints'),
    /** -	repeat for each endpoint */
    endpoint = endpoints && endpoints[0],
    _unused = console.log('taskGetList', endpoints, endpoint),
    trace_promise = false,
    adapterOptions = apiEndpoints.addId(
      endpoint,
      {
        filter: {'include': 'blocks'}
      }),
    dP = store.query('dataset', adapterOptions);
    if (trace_promise)
      dP.then(function (d) { console.log(d, d.toArray()[0].get('blocks').toArray());});
    let
    datasets = yield dP;

    /* Give each block a .mapName attribute, referring to the dataset which contains it.
     * This is mostly to support existing references to block/chr.mapName; they can be all changed to .get('datasetId').get('id') or 'name'
     */
    datasets.forEach(function(dataset) {
      let datasetName = dataset.get('name');
      let blocks = dataset.get('blocks');
      if (blocks) {
        blocks.forEach(function(block) {
          block.set('mapName', datasetName);
        });
      }
    });

    datasets = datasets.toArray();
    console.log('taskGetList', this, datasets.length);
    this.trigger('receivedDatasets', datasets);
    return datasets;
  }),


  
  /** Call getData() in a task - yield the dataset result.
   * Signal that receipt with receivedDataset(id, dataset).
   *
   * Not used yet;  based on services/data/block.js : taskGet(), getData().
   */
  taskGet: task(function * (id) {
    let dataset = yield this.getData(id);
    console.log('taskGet', this, id, dataset);
    this.trigger('receivedDataset', id, dataset);
    return dataset;
  }),
  getData: function (id) {
    console.log("dataset getData", id);
    let store = this.get('store');
    let endpoints = this.get('apiEndpoints').get('endpoints'),
    adapterOptions = 
      {
          filter: {include: "blocks"}
      };
    this.get('apiEndpoints').set(adapterOptions, endpoints[0]);
    let datasetP = store.findRecord(
      'dataset', id,
      { reload: true,
        adapterOptions: adapterOptions}
    );

    return datasetP;
  }  // allow multiple in parallel - initially assume id-s are different
  ,

  /** @return dataset records */
  values: Ember.computed(function() {
    let records = this.get('store').peekAll('dataset');
    console.log('values', records);
    return records;
  })
  
});
