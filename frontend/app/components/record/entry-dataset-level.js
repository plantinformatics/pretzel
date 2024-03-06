import EntryBase from './entry-base';


export default EntryBase.extend({
  tagName: '',

  actions: {
    selectDataset(dataset) {
      console.log('entry-dataset-level', dataset);
      this.selectDataset(dataset);
    },
    selectBlock(block) {
      console.log('entry-dataset-level', block);
      this.selectBlock(block);
    }


  }


});
