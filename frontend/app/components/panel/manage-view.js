import { computed } from '@ember/object';
import ManageBase from './manage-base'

export default ManageBase.extend({

  showChartOptions : false,

  isMapview: computed('view', function() {
    let view = this.get('view');
    if (view == 'mapview') {
      return true;
    }
    return false;
  }),

  hasDisplayData: computed('displayData.[]', function() {
    let displayData = this.get('displayData');
    if (displayData && displayData.length > 0) {
      return true;
    }
    return false;
  }),

  actions: {
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    },
    removeBlock(block) {
      this.sendAction('removeBlock', block);
    },
    removeDisplayData() {
      let me = this;
      let displayData = this.get('displayData');
      for (let i=displayData.length-1; i >= 0; i--) {
        me.send('removeBlock', displayData[i]);
      }
    }
  }
});
