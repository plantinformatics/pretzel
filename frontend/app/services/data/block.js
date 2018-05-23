import Ember from 'ember';
import Service from '@ember/service';
import { task } from 'ember-concurrency';

const { inject: { service } } = Ember;

let trace_block = 1;

export default Service.extend(Ember.Evented, {
    auth: service('auth'),
    store: service(),

  /** Not required because findRecord() is used;
   * might later want this for other requests or calculation results, but can
   * discard it.
   */
  push : function (id, block) {
    console.log('block push', block);
    let pushData = 
      {
        data: {
          id: id,
          type: 'block',
          attributes: block
        }
      };
    // silently fails to return
    this.get('store').push(pushData);
  },

  /** Call getData() in a task - yield the block result.
   * Signal that receipt with receivedBlock(id, block).
   */
  taskGet: task(function * (id) {
    /** if not already loaded and viewed, then trigger receivedBlock */
    let isViewed = this.get('getIsViewed').apply(this, [id]);
    let block = yield this.getData(id);
    // console.log('taskGet', this, id, block);
    if (! isViewed)
    {
      block.set('isViewed', true);
      this.trigger('receivedBlock', id, block);
    }
    return block;
  }),
  getData: function (id) {
    // console.log("block getData", id);
    let store = this.get('store');
    let blockP = store.findRecord(
      'block', id,
      { reload: true,
        adapterOptions:{
          filter: {include: "features"}
        }}
    );

    return blockP;
  }  // allow multiple in parallel - assume id-s are different
  // later can use ember-contextual-service to give each id its own task scheduler
  ,
  /*--------------------------------------------------------------------------*/

  /** @return true if the block is loaded into the store from the backend, and has .isViewed==true.
   */
  getIsViewed(blockId)
  {
    let store = this.get('store'),
    block = store.peekRecord('block', blockId),
    isViewed = block && block.get('isViewed');
    return isViewed;
  },

  /*--------------------------------------------------------------------------*/

  getBlocks(blockIds) {
    let taskGet = this.get('taskGet');
    console.log("getBlocks", blockIds);
    let blockTasks = blockIds.map(
      function (id) {
        let blockTask = taskGet.perform(id);
        console.log("mapview model", id, blockTask);
        return blockTask;
      });

    console.log("getBlocks() result blockTasks", blockTasks);
    return blockTasks;
  },

  /*--------------------------------------------------------------------------*/


  /** @return block records */
  blockValues: Ember.computed(function() {
    let records = this.get('store').peekAll('block');
    if (trace_block)
      console.log('blockValues', records);
    return records;
  }),
  selected: Ember.computed(
    'blockValues.@each.isSelected',
    function() {
      let records = this.get('blockValues')
        .filterBy('isSelected', true);
      if (trace_block)
        console.log('selected', records);
      return records;  // .toArray()
    }),
  viewed: Ember.computed(
    'blockValues.@each.isViewed',
    function() {
      let records = this.get('blockValues')
        .filterBy('isViewed', true);
      if (trace_block)
        console.log('viewed', records);
      return records;  // .toArray()
    }),
  viewedIds: Ember.computed(
    'viewed.[]',
    function() {
      let ids = this.get('viewed');
      if (trace_block > 1)
        ids.map(function (a) { console.log('viewedIds', a, a.get('id')); } );
      if (trace_block)
        console.log('viewedIds', ids);
      ids = ids.map(function (a) { return a.get('id'); } );
      if (trace_block)
        console.log('viewedIds', ids);

      return ids;
    })
  
});
