import Ember from 'ember';
const { inject: { service } } = Ember;

import EntryBase from './entry-base';


export default EntryBase.extend({
  store: service(),

  tagName: '',

  node : Ember.computed('name', function () {
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
