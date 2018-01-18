import Ember from 'ember';

import config from '../config/environment';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  session:        service('session'),
  sessionAccount: service('session-account'),
  config: config,

  buildDate: config.APP.buildDate,
  version: config.APP.version,

  buildDateFormatted: Ember.computed('buildDate', function() {
    let value = this.get('buildDate')
    return value.substring(0, 10)
  }),

  actions: {
    login() {
      // Closure actions are not yet available in Ember 1.12
      // eslint-disable-next-line ember/closure-actions
      this.sendAction('onLogin');
    },

    logout() {
      this.get('session').invalidate();
    }
  },
  auth: window['AUTH'] !== 'NONE'
});
