import BaseForm from './base-form';

export default BaseForm.extend({
  authMethod: 'signupRequest',
  requirements: {
    'email': "Please enter an email.",
    'password': "Please enter a password."
  },
  errorMap: {
    422: "Your email already exists in our records. Please log in."
  },
  successMap: {
    "EMAIL_USER_VERIFY": "Thank you for registering. You should receive a confirmation email shortly.",
    "EMAIL_ADMIN_VERIFY": "Thank you for registering. Your sign up request has been sent to an administrator for approval",
    "EMAIL_NO_VERIFY": "Thank you for registering. Please log in."
  },
  handleSuccess(res) {
    let codes = this.get('successMap')
    if (res.code) {
      this.set('successMessage', codes[res.code]);
    } else {
      this.set('successMessage', 'Thank you for registering.')
    }
    this._super(res)
  },
});
