import EntryBase from './entry-base';

export default EntryBase.extend({
  tagName: '',
  actions: {
    selectBlockAndDataset(block) {
      console.log('selectBlockAndDataset', 'block => ', block);
      var dataset = block.get('datasetId')
      console.log('dataset => ', dataset);
      this.selectDataset(dataset);
      this.selectBlock(block);
    }
  }
});
