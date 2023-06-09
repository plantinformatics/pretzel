import { inject as service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  session: service('session'),
  auth: service('auth'),
  //
  // component properties
  //
  authMethod: null, // specify method on auth service to invoke for form submit
  // further work on this section may subclass the base form to an auth form
  requirements: {
    // parameters to provide for API submission body
    // key is form property, value is error if absent
  },
  errorMap: {
    // pretty printing for error response codes
    // key is API response code, value is error if present
  },
  successMap: {
    // pretty printing for success response codes
    // key is API response code, value is error if present
  },
  errorMessage: '',
  successMessage: '',
  //
  // component methods
  //
  processForm() {
    // return error to blank for new form submission attempt
    // or populate with blank if property missing
    this.set('errorMessage', '');
    let requirements = this.get('requirements');
    let data = this.getProperties(Object.keys(requirements));
    this.validateProperties(requirements, data)
    if (this.get('errorMessage').length == 0) {
      this.sendRequest(data)
    }
  },
  validateProperties(requirements, data) {
    for(var key in data) {
      if (!data[key]) {
        let errorString = requirements[key]
        /* So far there is only 1 field which is optional; if there are more we
         * can add a more formal means to signify optional fields;  the following
         * simply interprets a field as optional if its prompt message finishes
         * in ", if applicable."  */
        if (! errorString.match(/, if applicable.$/))
          this.set('errorMessage', errorString);
      }
    }
  },
  sendRequest(data) {
    this.setProperties({isProcessing: true})
    var vm = this
    let authMethod = this.get('authMethod')
    this.get('auth')[authMethod](data)
    .then(function(res){
      vm.handleSuccess(res)
    }, function(err, status) {
      vm.handleError(err, status)
    });
  },
  handleError(err, status) {
    console.log(err);
    this.setProperties({isProcessing: false})

    let error = this.checkError(err.responseJSON, this.get('errorMap'))
    if (error) {
      this.set('errorMessage', error);
    }
  },
  /** Inspect the API result for an error code or message.
   * @param data result from API request
   * The original recognises these formats :
   * {error : [value]} return value
   * {error : {statusCode : code}} return mapper[code]
   * {error : {message}}   return message
   * after 1534cfda, adding :
   * {error : {statusCode: 401, code: "LOGIN_FAILED", name: "Error", message: "login failed" }} return mapper[code]
   * @param mapper hash mapping from text error codes to error message to present to user.
   * e.g. (user-login) : {
   * LOGIN_FAILED: "Bad username / password. Please try again.",
   * LOGIN_FAILED_EMAIL_NOT_VERIFIED: "The email has not been verified." }
   * @return false if error code or message
   */
  checkError(data, mapper) {
    try {
      if (data.error && data.error[0]) {
        return data.error[0]
      } else if (data.error && data.error.statusCode) {
        const code = data.error.code || data.error.statusCode;
        if (mapper[code]) return mapper[code]
        else return data.error.message;
      } else {
        return false
      }
    } catch (error) {
      console.error(error)
      // may need more sophisticated handling here depending upon
      // type of error
      return error
    }
  },
  handleSuccess(res) {
    // console.log('RESPONSE', response)
    this.setProperties({
      isProcessing: false,
      isRegistered: true
    })
  },

  actions: {
    submitForm() {
      this.processForm()
    },
  }
});
