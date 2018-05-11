import Ember from 'ember';
import Service from '@ember/service';
import { task } from 'ember-concurrency';

const { inject: { service } } = Ember;

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
    let block = yield this.getData(id);
    // console.log('taskGet', this, id, block);
    block.set('isViewed', true);
    this.trigger('receivedBlock', id, block);
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

  /** @return block records */
  blockValues: Ember.computed(function() {
    let records = this.get('store').peekAll('block');
    console.log('blockValues', records);
    return records;
  }),
  selected: Ember.computed(
    'blockValues.@each.isSelected',
    function() {
    let records = this.get('blockValues')
      .filterBy('isSelected', true);
    console.log('selected', records);
    return records;  // .toArray()
    }),
  viewed: Ember.computed(
    'blockValues.@each.isViewed',
    function() {
    let records = this.get('blockValues')
      .filterBy('isViewed', true);
    console.log('viewed', records);
    return records;  // .toArray()
  })
  
});
