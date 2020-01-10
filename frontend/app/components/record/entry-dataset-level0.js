import Ember from 'ember';
import EntryBase from './entry-base';


export default EntryBase.extend({
  tagName: '',

  actions: {
    selectDataset(dataset) {
      console.log('entry-dataset-level0', dataset);
      this.sendAction('selectDataset', dataset);
    },
    selectBlock(block) {
      console.log('entry-dataset-level0', block);
      this.sendAction('selectBlock', block);
    }
  }


});
