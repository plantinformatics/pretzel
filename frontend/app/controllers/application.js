import Ember from 'ember';
import config from '../config/environment';

const { Controller } = Ember;

export default Controller.extend({
  buildDate: config.APP.buildDate,
  version: config.APP.version,
  actions: {
    transitionToLoginRoute() {
      this.transitionToRoute('login');
    }
  }
});
