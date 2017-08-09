import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  session:        service('session'),

  errorExists(response) {
    let mapper = {
      "INVALID_PASSWORD": "The old password is not valid. Please try again."
    }

    try {
      if (response.error && response.error[0]) {
        return response.error[0]
      } else if (response.error && response.error.code) {
        let code = response.error.code
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

  actions: {
    changeWithBasic() {
      let config = Ember.getOwner(this).resolveRegistration('config:environment')
      let endpoint = config.apiHost + '/api/Clients/change-password'

      this.set('errorMessage', '');

      let { oldPassword, newPassword } = this.getProperties('oldPassword', 'newPassword');

      let userToken;
      this.get('session').authorize('authorizer:application', (headerName, headerValue) => {
          userToken = headerValue;
      });
      console.log('passwords', oldPassword, newPassword)
      if (!oldPassword) {
        let errorString = "Please enter the old password."
        this.set('errorMessage', errorString);
      } else if (!newPassword) {
        let errorString = "Please enter a new password."
        this.set('errorMessage', errorString);
      } else {

        this.setProperties({isProcessing: true})

        var vm = this

        Ember.$.ajax({
          url: endpoint,
          type: 'POST',
          crossDomain: true,
          data: JSON.stringify({
            oldPassword: oldPassword,
            newPassword: newPassword
          }),
          headers: {
            'Authorization': userToken
          },
          contentType: 'application/json'
          // dataType: 'json'
        }).then(function(response){
          // console.log('RESPONSE', response)
          vm.setProperties({
            isProcessing: false,
            isRegistered: true
          })
        }, function(xhr, status) {
          vm.setProperties({isProcessing: false})
          var response = xhr.responseText;
          response = JSON.parse(response)

          let error = vm.errorExists(response)
          if (error) {
            vm.set('errorMessage', error);
          }
        });
      }
    }
  }
});
