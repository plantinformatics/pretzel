import Ember from 'ember';
import EntryBase from './entry-base';

const trace = 0;

/**
 * @param name
 * @param parentName  optional - used as hoverText, otherwise name is used
 * @param values
 */
export default EntryBase.extend({
  tagName: '',

  /** store is inherited from EntryBase, and also action loadBlock, but
   * otherwise EntryBase is not relevant to entry-scope, ditto for entry-parent. */

  node : Ember.computed('name', function () {
    let store = this.get('store'),
    name = this.get('name');
    /** problem : need dataset to make this unique. can annotate value with node. */
    let blocks = store.peekAll('Block').filter(function (r) { return r.get('scope') === name;});
    if (trace > 1)
      console.log('node Block', name, store, this, blocks);
    // use the first matching block
    return blocks.length && blocks[0];
  }),

  actions: {
    selectDataset(dataset) {
      if (trace)
      console.log('dataset2 => ', dataset);
      this.sendAction('selectDataset', dataset)
    },
    selectBlock(block) {
      if (trace)
      console.log('block2 => ', block);
      this.sendAction('selectBlock', block)
    }
  }
});
