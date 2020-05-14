import Ember from 'ember';
import Resolver from './resolver';
import loadInitializers from 'ember-load-initializers';
import config from './config/environment';

let App;

window.global = window;

App = Ember.Application.extend({
  modulePrefix: config.modulePrefix,
  podModulePrefix: config.podModulePrefix,
  Resolver,
  
  customEvents: {
    paste: "paste"
  }
});

loadInitializers(App, config.modulePrefix);

export default App;
