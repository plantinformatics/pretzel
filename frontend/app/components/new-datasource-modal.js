import { on } from '@ember/object/evented';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

const dLog = console.debug;

export default Component.extend({
    apiServers: service(),

  $(selector) {
    let this$ = jQuery('#'+this.elementId),
    s$ = /*new?*/jQuery.fn.init(selector,  this$);
    return s$;
  },

    didInsertElement: on('didInsertElement', function() {
        let confirmButton = this.$('button[name=confirm]');
        this.$('input[name=password]').keyup(function(event) {
            if (event.keyCode == 13) {
                confirmButton.click();
            }
        });
    }),

  actions: {
    onConfirm() {
      console.log('onConfirm');
      let host = this.$('input[name=host]').val();
      let user = this.$('input[name=user]').val();
      let password = this.$('input[name=password]').val();
      if (host == "" || user == "" || password == "") {
        /* host, user, password are required inputs.
         * Can make 'confirm' button sensitive when they are non-empty.
         *
         * onConfirm() is called when these values are "", immediately after it
         * is called with the correct values.
         * This can be changed to use ember input binding value= instead of
         * jQuery this.$('input[name=...]').val() (or .value ?).
         */
        dLog('onConfirm', 'empty input', host, user, password.length);
      }
      else
        this.get('apiServers').ServerLogin(host, user, password);
    }
  }
});
