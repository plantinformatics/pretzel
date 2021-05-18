// import OAuth2Bearer from 'ember-simple-auth/authorizers/oauth2-bearer';

// export default OAuth2Bearer.extend();

import { inject as service } from '@ember/service';

import BaseAuthorizer from 'ember-simple-auth/authorizers/base';


export default BaseAuthorizer.extend({
  session: service('session'),

  // serverTokenEndpoint: `${config.apiHost}/Users/login`,
  // serverTokenRevocationEndpoint: `${config.apiHost}/Users/logout`

  authorize(data, block) {
    let
      server = this.get('session.requestServer'),
    accessToken = server && server.token;
    let token = accessToken || data.token;
    console.log('authorize', data, token, block);

    block('Authorization', token);
  }
});
