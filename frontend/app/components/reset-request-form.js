import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({

  errorExists(response) {
    let mapper = {
      "EMAIL_NOT_FOUND": "The email was not found in our records.",
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
      console.log('password reset')

      let config = Ember.getOwner(this).resolveRegistration('config:environment')
      let endpoint = config.apiHost + '/api/Clients/reset'

      this.set('errorMessage', '');

      let { identification } = this.getProperties('identification');
      if (!identification) {
        let errorString = "Please enter an email."
        this.set('errorMessage', errorString);
      } else {

        this.setProperties({isProcessing: true})

        var vm = this

        Ember.$.ajax({
          url: endpoint,
          type: 'POST',
          crossDomain: true,
          data: JSON.stringify({
            email: identification
          }),
          contentType: 'application/json'
          // dataType: 'json'
        }).then(function(response){
          
          console.log('RESPONSE', response)
          vm.setProperties({
            isProcessing: false,
            isRegistered: true
          })
          // Ember.run(function(){
          //   resolve({
          //     token: response.id
          //   });
          // });
        }, function(xhr, status) {
          vm.setProperties({isProcessing: false})
          var response = xhr.responseText;
          response = JSON.parse(response)
          console.log('STATUS', status)
          console.log('RESET ERROR: ', response);

          let error = vm.errorExists(response)

          if (response.error && response.error.code == "EMAIL_NOT_FOUND") {
            vm.setProperties({
              isRegistered: true
            })
          } else if (error) {
            vm.set('errorMessage', error);
          }
        });
      }
    }
  }
});
