import BaseForm from './base';

export default BaseForm.extend({
  requirements: {
    'identification': "Please enter an email.",
    'password': "Please enter a password."
  },
  errorMap: {
    "LOGIN_FAILED": "Bad username / password. Please try again.",
    "LOGIN_FAILED_EMAIL_NOT_VERIFIED": "The email has not been verified."
  },
  sendRequest(data) {
    this.setProperties({isProcessing: true})

    this.get('session')
    .authenticate('authenticator:pretzel-local', data.identification, data.password)
    .catch((reason) => {
      
      this.setProperties({isProcessing: false})
      reason = JSON.parse(reason)

      // console.log('back in auth', reason)
      let error = this.checkError(reason, this.get('errorMap'))
      if (error) {
        this.set('errorMessage', error);
        this.setProperties({password: ''})
      }
    });
  },
  actions: {
    // authenticateWithOAuth2() {
    //   let { identification, password } = this.getProperties('identification', 'password');
    //   this.get('session').authenticate('authenticator:oauth2', identification, password).catch((reason) => {
    //     this.set('errorMessage', reason.error);
    //   });
    // },

    // authenticateWithFacebook() {
    //   this.get('session').authenticate('authenticator:torii', 'facebook');
    // },

    // authenticateWithGoogleImplicitGrant() {
    //   let clientId = config.googleClientID;
    //   let redirectURI = `${window.location.origin}/callback`;
    //   let responseType = `token`;
    //   let scope = `email`;
    //   window.location.replace(`https://accounts.google.com/o/oauth2/v2/auth?`
    //                         + `client_id=${clientId}`
    //                         + `&redirect_uri=${redirectURI}`
    //                         + `&response_type=${responseType}`
    //                         + `&scope=${scope}`
    //   );
    // }
  }
});
