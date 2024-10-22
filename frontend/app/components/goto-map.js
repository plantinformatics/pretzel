import Component from '@ember/component';

import { dLog } from '../utils/common/log';

export default Component.extend({

  actions: {
    selectBlock(block) {
      dLog('goto-map', 'selectBlock', block?.brushName, block);
      this.selectBlock(block);
    },
  }
});
