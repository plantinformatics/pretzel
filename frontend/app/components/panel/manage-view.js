import ManageBase from './manage-base'

export default ManageBase.extend({
  layout: {
  },
  actions: {
    selectChrom(chr) {
      this.sendAction('selectChrom', chr);
    },
    deleteChrom(chr) {
      this.sendAction('deleteChrom', chr.id);
    }
  }
});
