import Ember from 'ember';
import EntryBase from './entry-base';
const { inject: { service } } = Ember;
import { task } from 'ember-concurrency';

export default EntryBase.extend({
  block: service('data/block'),

  tagName: 'span',
  // attributes
  // classes
  actions: {
    saveEdit: function(record) {
      if (record.get('scope').length > 0) {
        this.send('setEditing', false)
        record.save()
      }
    },
    get : function(block) {
      let id = block.get('id');
      let t = this.get('useTask');
      t.apply(this, [id]);
      // t.perform(id);
    },
  },
  
  /** Use the task taskGet() defined in services/data/block.js
   * to get the block data.
   */
  useTask : function (id) {
    console.log("useTask", id);
    let blockService = this.get('block');
    let taskGet = blockService.get('taskGet');
    let block = taskGet.perform(id);
    console.log("block", id, block);
  },
  /** Alternative to useTask() - define a task here to call getData() in the block service.
   * This is not used (will drop after commit) because it seems better to
   * localise signalling receivedBlock in the block service; this component entry-block
   * handles user request for the block but the lifecycle of that request is
   * bettern handled in the block service task.
   */
  localGet: task(function * (id) {
    console.log("block task", id);
    let blockService = this.get('block');

    let block = yield blockService.getData(id);
    console.log("block", id, block);
    /* store.push() not needed because using findRecord().
     let store = this.get('store');
    store.push(id, block); */
    // this.trigger('receivedBlock', id, block);
  })

});
