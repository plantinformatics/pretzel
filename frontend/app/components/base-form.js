import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  session: service('session'),
  auth: service('auth'),
  //
  // component properties
  //
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
    this.setProperties({isProcessing: false})
    var response = err.responseText;
    response = JSON.parse(response)

    let error = this.checkError(response, this.get('errorMap'))
    if (error) {
      this.set('errorMessage', error);
    }
  },
  checkError(data, mapper) {
    // console.log('checkError')
    try {
      if (data.error && data.error[0]) {
        return data.error[0]
      } else if (data.error && data.error.code) {
        let code = data.error.code
        if (mapper[code]) return mapper[code]
        else return code
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
