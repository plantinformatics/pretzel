
import EntryBase from './entry-base';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

export default EntryBase.extend({

  actions: {
    selectDataset(dataset) {
      dLog('selectDataset', dataset);
      this.sendAction('selectDataset', dataset);
    },
    selectBlock(block) {
      dLog('selectBlock', block);
      this.sendAction('selectBlock', block);
    }
  }


});
