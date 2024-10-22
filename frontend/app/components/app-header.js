import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

import config from '../config/environment';

export default Component.extend({
  session:        service('session'),
  sessionAccount: service('session-account'),
  config: config,

  buildDate: config.APP.buildDate,
  version: config.APP.version,

  buildDateFormatted: computed('buildDate', function() {
    let value = this.get('buildDate')
    return value.substring(0, 10)
  }),

  actions: {
    login() {
      // Closure actions are not yet available in Ember 1.12
      // eslint-disable-next-line ember/closure-actions
      this.onLogin();
    },

    logout() {
      this.get('session').invalidate();
    }
  },
  auth: window['AUTH'] !== 'NONE'
});
