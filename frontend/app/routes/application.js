import Ember from 'ember';
const {
  inject: { service },
  Route,
} = Ember;

export default Route.extend({
  auth: service('auth'),

  beforeModel() {
    this.get('auth').checkLogin();
  },
});
