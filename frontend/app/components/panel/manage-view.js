import ManageBase from './manage-base'

export default ManageBase.extend({
  layout: {
  },
  actions: {
    selectBlock(block) {
      this.sendAction('selectBlock', block);
    },
    deleteBlock(block) {
      this.sendAction('deleteBlock', block.id);
    }
  }
});
