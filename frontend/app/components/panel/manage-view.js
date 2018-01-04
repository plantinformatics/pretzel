import ManageBase from './manage-base'

export default ManageBase.extend({
  layout: {
  },
  actions: {
    selectBlock(chr) {
      this.sendAction('selectBlock', chr);
    },
    deleteBlock(chr) {
      this.sendAction('deleteBlock', chr.id);
    }
  }
});
