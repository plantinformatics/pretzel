import Ember from 'ember';
import Service from '@ember/service';
import { task } from 'ember-concurrency';

const { inject: { service } } = Ember;

const dLog = console.debug;

// based on ./block.js

export default Service.extend(Ember.Evented, {
    auth: service('auth'),
    store: service(),

  /** Get the list of available datasets, in a task - yield the dataset result.
   * Signal that receipt with receivedDatasets(datasets).
   */
  taskGetList: task(function * () {
    /* This replaces controllers/mapview.js : updateChrs(), updateModel(). */
    console.log('dataset taskGetList', this);
    let store = this.get('store'),
    trace_promise = false,
    dP = store.query('dataset',
      {
        filter: {'include': 'blocks'}
      });
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
    let store = this.get('store');
    let datasetP = store.findRecord(
      'dataset', id,
      { reload: true,
        adapterOptions:{
          filter: {include: "blocks"}
        }}
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
 
  
  
});
