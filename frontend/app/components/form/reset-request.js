import BaseForm from './base';

export default BaseForm.extend({
  authMethod: 'resetRequest',
  requirements: {
    'email': "Please enter an email."
  },
  errorMap: {
    "EMAIL_REQUIRED": "The email was not found in the database.",
    "EMAIL_NOT_FOUND": "The email was not found in the database.",
    "RESET_FAILED_EMAIL_NOT_VERIFIED": "Your email has not been verified. Please check your inbox."
  },
  handleError(err, status) {
    this.setProperties({isProcessing: false})
    var response = err.responseText;
    response = JSON.parse(response)
    console.log('STATUS', status)
    console.log('RESET ERROR: ', response);
    // specific check for this request - an email may not exist
    // for the particular email address provided
    if (response.error && response.error.code == "EMAIL_NOT_FOUND") {
      this.setProperties({
        isRegistered: true
      })
    } else {
      this._super(err, status)
    }
  },
});
