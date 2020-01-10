import Ember from 'ember';
import EntryBase from './entry-base';


export default EntryBase.extend({

  actions: {
    selectDataset(dataset) {
      console.log('entry-datasets', dataset);
      this.sendAction('selectDataset', dataset);
    }

  }


});
