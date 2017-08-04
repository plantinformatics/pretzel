import Ember from 'ember';
import config from '../config/environment';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  session: service('session'),

  errorExists(response) {
    let mapper = {
      "LOGIN_FAILED": "Bad username / password. Please try again.",
      "LOGIN_FAILED_EMAIL_NOT_VERIFIED": "The email has not been verified. Please check your inbox."
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

  testFunction: Ember.computed('people.@each', function(){
    var that = this;
    return this.get('people').map(function(person){
      return {
        'person': person,
        'icon': that.findIconFor(person)
      };
    });
  }),


  actions: {
    // authenticateWithOAuth2() {
    //   let { identification, password } = this.getProperties('identification', 'password');
    //   this.get('session').authenticate('authenticator:oauth2', identification, password).catch((reason) => {
    //     this.set('errorMessage', reason.error);
    //   });
    // },

    authenticateWithBasic() {
      let { identification, password } = this.getProperties('identification', 'password');
      if (!identification || !password) {
        let errorString = "Please enter an email and password."
        this.set('errorMessage', errorString);
      } else {

        this.setProperties({isProcessing: true})

        this.get('session').authenticate('authenticator:pretzel-local', identification, password).catch((reason) => {
          
          this.setProperties({isProcessing: false})
          reason = JSON.parse(reason)

          console.log('back in auth', reason)

          let errorString = this.errorExists(reason)

          if (errorString) {
            this.set('errorMessage', errorString);
            this.setProperties({password: ''})
          }
        });

      }
    },

    authenticateWithFacebook() {
      this.get('session').authenticate('authenticator:torii', 'facebook');
    },

    authenticateWithGoogleImplicitGrant() {
      let clientId = config.googleClientID;
      let redirectURI = `${window.location.origin}/callback`;
      let responseType = `token`;
      let scope = `email`;
      window.location.replace(`https://accounts.google.com/o/oauth2/v2/auth?`
                            + `client_id=${clientId}`
                            + `&redirect_uri=${redirectURI}`
                            + `&response_type=${responseType}`
                            + `&scope=${scope}`
      );
    }
  }
});
