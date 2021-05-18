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
  checkError(data, mapper) {
    try {
      if (data.error && data.error[0]) {
        return data.error[0]
      } else if (data.error && data.error.statusCode) {
        let code = data.error.statusCode
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
