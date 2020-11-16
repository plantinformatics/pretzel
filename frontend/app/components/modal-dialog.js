import { on } from '@ember/object/evented';
import Component from '@ember/component';
export default Component.extend({
  actions: {
    confirm: function() {
      this.sendAction('onConfirm');
      this.element.querySelectorAll('.modal').modal('hide');
    },
    resetForm() {
      this.$('input').val('');
      
    }
  },
  show: on('didInsertElement', function() {
    let me = this;
    this.element.querySelectorAll('.modal').forEach(
      el => el.addEventListener('hidden.bs.modal', function() {
      me.send('resetForm');
      me.sendAction('onClose');
    }));
  })
});
