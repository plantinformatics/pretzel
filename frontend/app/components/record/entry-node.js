
import EntryBase from './entry-base';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

export default EntryBase.extend({

  actions: {
    selectDataset(dataset) {
      dLog('selectDataset', dataset);
      this.selectDataset(dataset);
    },
    selectBlock(block) {
      dLog('selectBlock', block);
      this.selectBlock(block);
    }
  }


});
