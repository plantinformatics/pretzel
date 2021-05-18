import { oneWay } from '@ember/object/computed';
import Controller from '@ember/controller';

export default Controller.extend({

  /** copy one-way from URL -> model -> params to form/user-login */
  user_identification : oneWay('model.user_identification'),
  user_password : oneWay('model.user_password')


});
