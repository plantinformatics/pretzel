import ManageRecord from './manage-record'

export default ManageRecord.extend({
  tagName: 'div',
  // attributes
  // classes
  classNames: ['col-xs-12'],
  // actions
  actions: {
    setTab(panelSide, panelName) {
      this.sendAction('setTab', panelSide, panelName);
    }
  }
});
