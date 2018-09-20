export default Ember.Component.extend({
  actions: {
    ok: function() {
      this.$('.modal').modal('hide');
      this.sendAction('ok');
    }
  },
  show: Ember.on('didInsertElement', function() {
    Ember.on('hidden.bs.modal', function() {
      this.sendAction('close');
    }.bind(this), this.$('.modal').modal());
  })
});