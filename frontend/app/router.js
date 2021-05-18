import EmberRouter from '@ember/routing/router';
import config from 'pretzel-frontend/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {
  // auth routes
  this.route('auth-error');
  this.route('change-password');
  this.route('login');
  this.route('signup');
  this.route('reset-request');
  this.route('reset-password');
  this.route('verified');
  this.route('admin-verified');
  this.route('access-request');
  // core app routes
  this.route('callback');
  this.route('mapview');
  this.route('matrixview');
  this.route('geneticmaps', { path: '/geneticmaps' }, function() {
    this.route('geneticmap', { path: '/:geneticmap_id' });
  });
  // landing page if not handled previously
  this.route('404', { path: '/*wildcard' });
});
