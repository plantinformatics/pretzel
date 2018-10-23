import Ember from 'ember';
import Service from '@ember/service';
import { task } from 'ember-concurrency';

const { inject: { service }, getOwner } = Ember;

// based on ./block.js

export default Service.extend(Ember.Evented, {
    auth: service('auth'),
  apiEndpoints: service('api-endpoints'),
  primaryEndpoint : Ember.computed.alias('apiEndpoints.primaryEndpoint'),

  storeManager: Ember.inject.service('multi-store'),

  /** Get the list of available datasets, in a task - yield the dataset result.
   * Signal that receipt with receivedDatasets(datasets).
   */
  taskGetList: task(function * (endpoint) {
    /* This replaces controllers/mapview.js : updateChrs(), updateModel(). */
    let
      owner = getOwner(this),
    store0 = getOwner(this).lookup("service:store"),

    apiEndpoints = this.get('apiEndpoints'),
    primaryEndpoint = apiEndpoints.get('primaryEndpoint'),
    _unused = console.log('taskGetList', endpoint, primaryEndpoint),
    /** routes/mapview:model() uses primaryEndpoint; possibly it will pass that
     * in or perhaps formalise this to an if (endpoint) structure; sort that in
     * next commit. */
    _unused2 = endpoint || (endpoint = primaryEndpoint),
    store = endpoint.store,
    trace_promise = false,

    /** looks like store.adapterOptions is overridden by adapterOptions passed
     * to query, so merge them. */
    adapterOptions = apiEndpoints.addId(
      endpoint || primaryEndpoint,
    /* adapterOptions = store.adapterOptions ||*/ {
    /* adapterOptions */
      filter :  {'include': 'blocks'} }), /*;
    let */
    dP = store.query('dataset', adapterOptions);
    if (trace_promise)
      dP.then(function (d) { console.log(d, d.toArray()[0].get('blocks').toArray());});
    let
    datasets = yield dP;

    if (endpoint && endpoint.host)
    {
      /* Give each dataset a meta.apiHost attribute, referring to the API endpoint from which it was received.
       * This is for display in the GUI, and can be used to select the endpoint for block contents request.
       */
      datasets.forEach(function(dataset) {
        let meta = dataset.get('meta');
        if (! meta)
        {
          meta = {};
          dataset.set('meta', meta);
        }
        meta.apiHost = endpoint.host;
      });
    }

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
    let
    /** This is draft; caller may pass in endpoint .. */
    endpoint = this.get('primaryEndpoint'),
    store = endpoint.store,
    adapterOptions = 
      {
          filter: {include: "blocks"}
      };
    this.get('apiEndpoints').addId(endpoint, adapterOptions);
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
    let 
    endpoint = this.get('primaryEndpoint'),
    store = endpoint.store,
    records = store.peekAll('dataset');
    console.log('values', records);
    return records;
  })
  
});
