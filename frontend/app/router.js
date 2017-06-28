import Ember from 'ember';
import config from './config/environment';

const Router = Ember.Router.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(function() {
  // auth routes
  this.route('login');
  this.route('signup');
  this.route('reset-request');
  this.route('reset-password');
  this.route('verified');
  this.route('protected');
  this.route('auth-error');
  // core app routes
  this.route('callback');
  this.route('about');
  this.route('mapview');
  this.route('geneticmaps', { path: '/geneticmaps' }, function() {
    this.route('geneticmap', { path: '/:geneticmap_id' });
  });
  // landing page if not handled previously
  this.route('404', { path: '/*wildcard' });
});

export default Router;
