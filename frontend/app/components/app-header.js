import Ember from 'ember';
import config from '../config/environment';
const {
  inject: { service },
  Component,
} = Ember;

export default Component.extend({
  router: service(),
  auth: service('auth'),
  config: config,

  buildDate: config.APP.buildDate,
  version: config.APP.version,

  buildDateFormatted: Ember.computed('buildDate', function() {
    let value = this.get('buildDate');
    return value.substring(0, 10);
  }),

  actions: {
    /**
     * From services/auth, starts the login process
     */
    login() {
      this.get('auth').login();
    },

    /**
     * From services/auth, removes user token from the session
     */
    logout() {
      this.get('auth').logout();
    },
  },
});
