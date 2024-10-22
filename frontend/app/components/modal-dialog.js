import { on } from '@ember/object/evented';
import Component from '@ember/component';

import $ from 'jquery';

/** Previously used in new-datasource-modal.hbs which changed in f5117533 to <BsModal >
 * See header comment in components/ember-modal-dialog.js
 */
export default Component.extend({
  actions: {
    confirm: function() {
      this.sendAction('onConfirm');
      $('.modal', this.element).modal('hide');
    },
    resetForm() {
      $('input', this.element).val('');
      
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
