import { on } from '@ember/object/evented';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

import $ from 'jquery';

const dLog = console.debug;

export default Component.extend({
    apiServers: service(),

    didInsertElement: on('didInsertElement', function() {
        let confirmButton = $('button[name=confirm]', this.element);
        $('input[name=password]', this.element).keyup(function(event) {
            if (event.keyCode == 13) {
                confirmButton.click();
            }
        });
    }),

  actions: {
    onConfirm() {
      console.log('onConfirm');
      let host = $('input[name=host]', this.element).val();
      let user = $('input[name=user]', this.element).val();
      let password = $('input[name=password]', this.element).val();
      if (host == "" || user == "" || password == "") {
        /* host, user, password are required inputs.
         * Can make 'confirm' button sensitive when they are non-empty.
         *
         * onConfirm() is called when these values are "", immediately after it
         * is called with the correct values.
         * This can be changed to use ember input binding value= instead of
         * jQuery $('input[name=...]', this.element).val() (or .value ?).
         */
        dLog('onConfirm', 'empty input', host, user, password.length);
      }
      else {
        this.set('errorText', null);
        let promise = this.get('apiServers').ServerLogin(host, user, password);
        promise
          .then(() => { this.close(); })
          .catch((error) => {
            let
            errorText = error ?
              (typeof error === "object") && 
              (Object.entries(error).map((kv) => kv.join(' : ')).join(', '))
              || '' + error : '' + error;
            this.set('errorText', '' + errorText); });
      }
    }
  },

  close : function() {
    dLog('close');
    this.closeNewDatasourceModal();
  }
});
