import Ember from 'ember';
import config from '../config/environment';

const { Controller } = Ember;

export default Controller.extend({
  actions: {
    transitionToLoginRoute() {
      this.transitionToRoute('login');
    }
  }
});
 