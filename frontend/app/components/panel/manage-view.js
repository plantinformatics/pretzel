import ManageBase from './manage-base'

export default ManageBase.extend({

  isMapview: Ember.computed('view', function() {
    let view = this.get('view');
    if (view == 'mapview') {
      return true;
    }
    return false;
  }),

  actions: {
    removeBlock(block) {
      this.sendAction('removeBlock', block);
    }
  }
});
