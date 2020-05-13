import Ember from 'ember';
const {
  inject: { service },
  Route,
} = Ember;

export default Route.extend({
  auth: service('auth'),
  beforeModel() {
    // check if we are authenticated
    // parse the url hash that comes back from auth0
    // if authenticated on login, redirect to mapview
    this.get('auth')
      .handleAuthentication()
      .then(() => this.transitionTo('/mapview'));
  },
});
