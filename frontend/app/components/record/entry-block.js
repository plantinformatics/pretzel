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
    // block.set('isViewed', true);
  }

});
