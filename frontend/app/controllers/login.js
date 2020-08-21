import Ember from 'ember';

export default Ember.Controller.extend({

  /** copy one-way from URL -> model -> params to form/user-login */
  user_identification : Ember.computed.oneWay('model.user_identification'),
  user_password : Ember.computed.oneWay('model.user_password')


});
