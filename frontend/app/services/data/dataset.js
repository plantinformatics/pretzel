import Ember from 'ember';
import Service from '@ember/service';
import { task } from 'ember-concurrency';

const { inject: { service }, getOwner } = Ember;

const dLog = console.debug;

// based on ./block.js

export default Service.extend(Ember.Evented, {
    auth: service('auth'),
  apiServers: service(),
  primaryServer : Ember.computed.alias('apiServers.primaryServer'),

  storeManager: Ember.inject.service('multi-store'),

  /** Get the list of available datasets, in a task - yield the dataset result.
   * Signal that receipt with receivedDatasets(datasets).
   */
  taskGetList: task(function * (server) {
    /* This replaces controllers/mapview.js : updateChrs(), updateModel(). */
    console.log('dataset taskGetList', this);
    let
      owner = getOwner(this),
    store0 = getOwner(this).lookup("service:store"),

    apiServers = this.get('apiServers'),
    primaryServer = apiServers.get('primaryServer'),
    id2Server = apiServers.get('id2Server'),
    _unused = console.log('taskGetList', server, primaryServer),
    /** routes/mapview:model() uses primaryServer; possibly it will pass that
     * in or perhaps formalise this to an if (server) structure; sort that in
     * next commit. */
    _unused2 = server || (server = primaryServer),
    store = server.store,
    trace_promise = false,

    /** looks like store.adapterOptions is overridden by adapterOptions passed
     * to query, so merge them. */
    adapterOptions = apiServers.addId(
      server || primaryServer,
    /* adapterOptions = store.adapterOptions ||*/ {
    /* adapterOptions */
      filter :  {'include': 'blocks'} }), /*;
    let */
    dP = store.query('dataset', adapterOptions);
    if (trace_promise)
      dP.then(function (d) { console.log(d, d.toArray()[0].get('blocks').toArray());});
    let
    datasets = yield dP;

    if (false && server && server.host)
    {
      /* Give each dataset a meta.apiHost attribute, referring to the API server from which it was received.
       * This is for display in the GUI, and can be used to select the server for block contents request.
       */
      datasets.forEach(function(dataset) {
        let meta = dataset.get('meta');
        if (! meta)
        {
          meta = {};
          dataset.set('meta', meta);
        }
        meta.apiHost = server.host;
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
          // if the block is not cached on the server, then note the server as the owner of the block.
          if (! block.get('isCopy'))
          id2Server[block.get('id')] = server;
        });
      }
    });

    datasets = datasets.toArray();
    console.log('taskGetList', this, datasets.length);
    this.trigger('receivedDatasets', datasets);
    return datasets;
  }).drop(),


  
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
    /** This is draft; caller may pass in server .. */
    server = this.get('primaryServer'),
    store = server.store,
    adapterOptions = 
      {
          filter: {include: "blocks"}
      };
    this.get('apiServers').addId(server, adapterOptions);
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
    server = this.get('primaryServer'),
    store = server.store,
    records = store.peekAll('dataset');
    console.log('values', records);
    return records;
  })
  ,
  /** Map the given array of objects by the result of the keyFn.
   * @return Map of key values to objects.
   */
  objectsMap : function (objects, keyFn) {
      let
      objectsMap = objects.reduce(
        (map, o) => {
          let block = keyFn(o),
          axis = block.get('axis'),
          stack = axis && axis.getStack();
          if (stack) {
            let axes = map.get(stack);
            if (! axes)
              map.set(stack, axes = []);
            axes.push(axis);
          }
          return map; },
        new Map()
      );
      return objectsMap;
  },
  /** Collate all loaded datasets by their parent name.
   * Those without a parent name are mapped by the value null.
   * This does not check if the named parent exists - use datasetsByName() for that.
   *
   * This will recalculate if the user uploads an additional dataset, which will
   * not be frequent, so it is efficient to calculate this in advance.
   * We could also reload when other users or system admins add datasets to the
   * database, but again that is not expected to be frequent, and it is
   * likely that this user will not need them in this session.
   */
  datasetsByParent : Ember.computed('values.[]', function () {
    let values = this.get('values'),
    map = this.objectsMap(values, (d) => d.get('parent'));
    dLog('datasetsByParent', map);
    return map;
  }),
  datasetsByName : Ember.computed('values.[]', function () {
    /** currently dataset.name is used as DB ID, so name lookup of datasets can
     * also be done via peekRecord('dataset', name).
     */
    let values = this.get('values'),
    map = this.objectsMap(values, (d) => d.get('name'));
    dLog('datasetsByName', map);
    return map;
  }),
 
  /** Collate the datasets of the servers by the given keyFunction.
   * The calling ComputedProperty should depend on 'apiServers.datasetsWithServerName.[]'.
   */
  datasetsByFunction : function datasetsByFunction (keyFunction) {
    let
      datasetsWithServerName = this.get('apiServers.datasetsWithServerName'),
    datasetsByValue = datasetsWithServerName.reduce(function(result, d) {
      let serverName = d.serverName;
      d.datasetsBlocks.forEach(function (dataset) {
        /** key will be .parentName or .id (name)  */
        let key = keyFunction(dataset),
        rp = result[key] || (result[key] = []);
        rp.push({dataset, serverName});
      });
      return result;
    });
    dLog('datasetsByFunction', datasetsByValue);
    return datasetsByValue;
  },

  /** Similar to datasetsByParent, except that is limited to .primaryServer,
   * whereas this matches datasets on all stores/servers,
   * and this maps by .parentName instead of .parent which may be undefined.
   * @return [parentName] -> {dataset, serverName}
   */  
  datasetsByParentName : Ember.computed('apiServers.datasetsWithServerName.[]', function () {
    function parentNameFn (dataset) { return dataset.get('parentName') || null; }
    let datasetsByParentName = this.datasetsByFunction(parentNameFn);
    dLog('datasetsByParentName', datasetsByParentName);
    return datasetsByParentName;
  }),
  /** Similar to datasetsByName, except that is limited to .primaryServer,
   * whereas this matches datasets on all stores/servers.
   */
  datasetsByNameAllServers : Ember.computed('apiServers.datasetsWithServerName.[]', function () {
    function nameFn (dataset) { return dataset.get('id') || null; }
    let datasetsByName = this.datasetsByFunction(nameFn);
    dLog('datasetsByNameAllServers', datasetsByName);
    return datasetsByName;
  }),
  /** Lookup the datasets matching the given parentName, i.e. dataset.parentName === parentName.
   *
   * @param parentName  to match
   * @param original  if true then exclude copied / cached datasets (having .meta.origin)
   * @return [ {dataset, serverName}, ... ]
   */
  datasetsForParentName : function(parentName, original) {
    let datasetsByParentName = this.get('datasetsByParentName'),
    childDatasets = datasetsByParentName[parentName];
    return childDatasets;
  },
  /** Lookup the datasets matching the given name.
   *
   * @param name  to match, usually a parentName
   * @param original  if true then exclude copied / cached datasets (having .meta.origin)
   */
  datasetsForName : function(name, original) {
    let
          apiServers = this.get('apiServers'),
        datasets = apiServers.dataset2stores(name);
    if (original)
      datasets = datasets.filter((d) => ! d.dataset.get('meta.origin'));
    return datasets;
  }
  
  
});
