import BaseForm from './base';

export default BaseForm.extend({
  authMethod: 'changePassword',
  requirements: {
    'oldPassword': "Please enter the old password.",
    'newPassword':  "Please enter a new password."
  },
  errorMap: {
    "INVALID_PASSWORD": "The old password is not valid. Please try again."
  }
});
