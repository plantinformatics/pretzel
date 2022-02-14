import Component from '@ember/component';
import { inject as service } from '@ember/service';

export default Component.extend({
  store: service(),
  tagName: 'div',
  // attributes
  // classes
  classNames: ['panel-section'],
  // actions
  actions: {
    setTab(panelSide, panelName) {
      this.sendAction('setTab', panelSide, panelName);
    },
    changeTab(tab) {
      this.sendAction('changeTab', tab);
    },
    selectBlock(chr) {
      this.sendAction('selectBlock', chr);
    },
    selectDataset(dataset) {
      this.sendAction('selectDataset', dataset);
    }
  },
});
