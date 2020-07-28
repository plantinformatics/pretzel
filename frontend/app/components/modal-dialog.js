export default Ember.Component.extend({
  actions: {
    confirm: function() {
      this.sendAction('onConfirm');
      this.$('.modal').modal('hide');
    },
    resetForm() {
      this.$('input').val('');
      
    }
  },
  show: Ember.on('didInsertElement', function() {
    let me = this;
    this.$('.modal').on('hidden.bs.modal', function() {
      me.send('resetForm');
      me.sendAction('onClose');
    });
  })
});
