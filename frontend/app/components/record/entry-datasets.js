import EntryBase from './entry-base';


export default EntryBase.extend({

  actions: {
    selectDataset(dataset) {
      console.log('entry-datasets', dataset?.id, dataset);
      this.selectDataset(dataset);
    }

  }


});
