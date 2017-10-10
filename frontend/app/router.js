import Ember from 'ember';
import config from './config/environment';

const Router = Ember.Router.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

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
  // core app routes
  this.route('callback');
  this.route('about');
  this.route('mapview');
  this.route('geneticmaps', { path: '/geneticmaps' }, function() {
    this.route('geneticmap', { path: '/:geneticmap_id' });
  });
  this.route('upload-data');
  // landing page if not handled previously
  this.route('404', { path: '/*wildcard' });
});

export default Router;
