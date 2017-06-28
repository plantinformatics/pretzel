import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({

  errorExists(response) {
    let mapper = {
      "AUTHORIZATION_REQUIRED": "The provided access token has expired",
      "RESET_FAILED_EMAIL_NOT_VERIFIED": "Your email has not been verified. Please check your inbox."
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
    resetWithBasic() {
      let config = Ember.getOwner(this).resolveRegistration('config:environment')
      let endpoint = config.apiHost + '/api/Clients/reset-password'

      this.set('errorMessage', '');

      let { newPassword } = this.getProperties('newPassword');
      if (!newPassword) {
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
            newPassword: newPassword
          }),
          headers: {
            'Authorization': this.access_token
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
