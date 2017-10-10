// import OAuth2Bearer from 'ember-simple-auth/authorizers/oauth2-bearer';

// export default OAuth2Bearer.extend();

import BaseAuthorizer from 'ember-simple-auth/authorizers/base'

export default BaseAuthorizer.extend({
  // serverTokenEndpoint: `${config.apiHost}/Users/login`,
  // serverTokenRevocationEndpoint: `${config.apiHost}/Users/logout`

  authorize(data, block) {
    // console.log('authorize', data, block)

    block('Authorization', data.token)
  }
});