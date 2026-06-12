import BaseForm from './base';

export default BaseForm.extend({
  authMethod: 'signupRequest',
  requirements: {
    'email': "Please enter an email.",
    'password': "Please enter a password with strength : good or very good.",
    'name' : 'Please enter your name.',
    'institution' : 'Please enter the name of your institution.',
    // 'project' : 'Please enter your project code, if applicable.'
  },
  errorMap: {
    422: "Your email already exists in our records. Please log in."
  },
  successMap: {
    "EMAIL_USER_VERIFY": "Thank you for registering. You should receive a verification email shortly.",
    "EMAIL_ADMIN_VERIFY": "Thank you for registering. Your sign up request has been sent to an administrator for approval",
    "EMAIL_NO_VERIFY": "Thank you for registering. Please log in."
  },

  /** To enable content (terms-of-use.hbs) to be displayed after auth-base,
   * prevent auth-base <div class=row> from applying display: flex;
   * The same is done in ./user-login.js
   * There is some duplicate use of content-after-auth-base :
   * templates/signup.hbs: <div class="content-after-auth-base auth-terms-page">
   */
  classNames : ['content-after-auth-base'],

  //----------------------------------------------------------------------------

  handleSuccess(res) {
    let codes = this.get('successMap')
    if (res.code) {
      this.set('successMessage', codes[res.code]);
    } else {
      this.set('successMessage', 'Thank you for registering.')
    }
    this._super(res)
  }
});
