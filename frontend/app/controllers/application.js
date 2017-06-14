import Ember from 'ember';
import config from '../config/environment';

export default Ember.Controller.extend({
  buildDate: config.APP.buildDate,
  version: config.APP.version
});
