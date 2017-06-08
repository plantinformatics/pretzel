import Ember from 'ember';
import config from '../config/environment';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  session: service('session'),

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

        this.get('session').authenticate('authenticator:webgene-local', identification, password).catch((reason) => {
          // console.log('back in auth', reason)
          this.setProperties({isProcessing: false})
          reason = JSON.parse(reason)

          if (this.errorExists(reason)) {
            let errorString = "Bad email / password. Please try again."
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
