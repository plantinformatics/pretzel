import BaseForm from './base-form';

export default BaseForm.extend({
  authMethod: 'resetPassword',
  requirements: {
    'newPassword': "Please enter a new password."
  },
  errorMap: {
    "AUTHORIZATION_REQUIRED": "The provided access token has expired",
    "RESET_FAILED_EMAIL_NOT_VERIFIED": "Your email has not been verified. Please check your inbox."
  },
  // need to override the super to add the access_token
  sendRequest(data) {
    this.setProperties({isProcessing: true})
    var vm = this
    let authMethod = this.get('authMethod')
    this.get('auth')[authMethod](data, this.access_token)
    .then(function(res){
      vm.handleSuccess(res)
    }, function(err, status) {
      vm.handleError(err, status)
    });
  }
});
