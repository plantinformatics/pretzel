import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import EntryBase from './entry-base';


export default EntryBase.extend({
  store: service(),

  tagName: '',

  node : computed('name', function () {
    let store = this.get('store');
    return store.peekRecord('Dataset', this.get('name'));
  }),
  actions: {
    selectDataset(dataset) {
      console.log('dataset3 => ', dataset);
      this.sendAction('selectDataset', dataset)
    },
    selectBlock(block) {
      console.log('block3 => ', block);
      this.sendAction('selectBlock', block)
    }
  }
});
