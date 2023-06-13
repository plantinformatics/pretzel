import { computed } from '@ember/object';

import BaseForm from './base';

import { htmlErrorParse } from '../../utils/common/html';

//------------------------------------------------------------------------------

const dLog = console.debug;
const trace = 1;

//------------------------------------------------------------------------------

/**
 * These optional parameters can be used to pre-populate the input fields, via URL query-params.  
 * @param identification
 * @param password
 */
export default BaseForm.extend({
  /** identification and password are cleared before display. They do require an
   * initial value to support the 2-way binding.  */
  identification : 'initial identification',
  password : 'initial password',
  requirements: {
    'identification': "Please enter an email.",
    'password': "Please enter a password."
  },
  errorMap: {
    "LOGIN_FAILED": "Bad username / password. Please try again.",
    "LOGIN_FAILED_EMAIL_NOT_VERIFIED": "The email has not been verified."
  },
  sendRequest(data) {
    const fnName = 'sendRequest';
    this.setProperties({isProcessing: true})

    this.get('session')
    .authenticate('authenticator:pretzel-local', data.identification, data.password)
    .catch((reason) => {
      
      this.setProperties({isProcessing: false})
      /** In some cases, not yet characterised, the server sends a HTML
       * error page instead of jSON.
       */
      if (reason.startsWith('<!DOCTYPE html>')) {
	/** Parse a specific error page which is received in response to
	 * authentication failure in login.
	 * This can be replaced by the equivalent : htmlErrorParse(),
	 * which is not yet configured for Chrome.   Using DOMParser()
	 * is less brittle than a regexp, as noted in :
	 * https://stackoverflow.com/questions/1732348/regex-match-open-tags-except-xhtml-self-contained-tags/1732454#1732454
	 */
	/**
 result e.g. Array(3) [ "<title>Error</title>\n</head>\n<body>\n<pre>Error: login failed<br>", "Error", "Error: login failed" ]
	 */
	const match = reason.match(/<title>([A-Za-z]+)<\/title>\n<\/head>\n<body>\n<pre>([A-Za-z: ]+)<br>/);
	if (match) {
	  // the title is probably duplicated in the <pre>.
	  reason = match[2].startsWith(match[1]) ? '' : match[1] + ' ';
	  reason += match[2];
	}
      } else {
	reason = JSON.parse(reason);
      }

      dLog(fnName, 'back in auth', reason);
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
  },

  revealPassword : false,
  passwordInputType : computed('revealPassword', function() {
    return this.revealPassword ? 'text' : 'password';
  }),

});
