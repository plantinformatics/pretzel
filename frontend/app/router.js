import Ember from 'ember';
import config from './config/environment';

const Router = Ember.Router.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(function() {
  this.route('login');
  this.route('verified');
  this.route('protected');
  this.route('auth-error');
  this.route('callback');
  this.route('about');
  this.route('mapview');
  this.route('geneticmaps', { path: '/geneticmaps' }, function() {
    this.route('geneticmap', { path: '/:geneticmap_id' });
  });
  this.route('404', { path: '/*wildcard' });
});

export default Router;
