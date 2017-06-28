import Ember from 'ember';
import config from '../../config/environment';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  session: service('session'),
  endpoint: `{config.ENV.APP.apiHost}/api/Clients/`,

  errorExists(response) {
    try {
      if (response.errors && response.errors[0]) {
        if (response.errors[0]) {
          return response.errors[0]
        } else {
          return false
        }
      } else {
        return false
      }
    } catch (error) {
      console.error(error)
      // may need more sophisticated handling here depending upon
      // type of error
      return false
    }
  },

  actions: {
    signupWithBasic() {

      this.set('errorMessage', '');

      let { identification, password } = this.getProperties('identification', 'password');
      if (!identification || !password) {
        let errorString = "Please enter an email and password."
        this.set('errorMessage', errorString);
      } else {

        this.setProperties({isProcessing: true})

        var vm = this

        Ember.$.ajax({
          url: this.endpoint,
          type: 'POST',
          crossDomain: true,
          data: JSON.stringify({
            // session: {
              email:    identification,
              password: password
            // }
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
        }, function(xhr, status, error) {
          var response = xhr.responseText;
          response = JSON.parse(response)
          console.log('STATUS', status)
          console.log('SIGNUP ERROR: ', response);

          if (response.error && response.error.statusCode === 422) {
            let errorString = "Email is already registered on Dav127. Please log in"
            vm.set('errorMessage', errorString);
          } else {
            let errorString = response.error
            vm.set('errorMessage', errorString);
          }
        });

      }
    }
  }
});
