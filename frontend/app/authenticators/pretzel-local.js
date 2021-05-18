import { run } from '@ember/runloop';
import $ from 'jquery';
import { getOwner } from '@ember/application';
import { isEmpty } from '@ember/utils';
import { Promise, resolve } from 'rsvp';
import { inject as service } from '@ember/service';
import Base from 'ember-simple-auth/authenticators/base';

import {
  getConfiguredEnvironment,
  getSiteOrigin
} from '../utils/configuration';


export default Base.extend({
  apiServers: service(),

  restore: function(data) {
    return new Promise(function(resolve, reject){
      if(!isEmpty(data.token)) {
        resolve(data);
      } else {
        reject();
      }
    });
  },

  authenticate: function(identification, password) {
    /** This is equivalent to getConfiguredEnvironment() and it is also
     * equivalent to ENV, which can be imported here from
     * ../config/environment.js
     */
    let config = getOwner(this).resolveRegistration('config:environment')
    let


    /** similar calcs in @see services/api-servers.js : init() */
    /** this gets the site origin. use this if ENV.apiHost is '' (as it is in
     * production) or undefined. */
    siteOrigin = getSiteOrigin(this),
    apiServers = this.get('apiServers'),
    endpoint = config.apiHost + '/api/Clients/login';
    console.log('authenticate', config, config.apiHost, siteOrigin);
    return new Promise((resolve, reject) => {
      $.ajax({
        url: endpoint,
        type: 'POST',
        crossDomain: true,
        data: JSON.stringify({
            email:    identification,
            password: password
        }),
        accept: 'application/json',
        contentType: 'application/json'
      }).then(function(response){
        // console.log(response)
        run(function(){
          /** i.e. config.apiHost */
          let host = endpoint.replace(/\/api\/Clients\/login/, '');
          console.log('resolve', 'host url', host, 'token', response.id, 'clientId', response.userId, siteOrigin);
          if (host == '')
            host = siteOrigin;
          let apiServer = apiServers.addServer(/*url*/ host, /*user*/ identification, /*token*/ response.id, /*clientId*/ response.userId);
          console.log('primaryServer', apiServer);
          resolve({
            token: response.id,
            clientId: response.userId
          });
        });
      }, function(xhr, status, error) {
        var response = xhr.responseText;
        run(function(){
          reject(response);
        });
      });
    });
  },

  invalidate: function() {
    return resolve();
  }

});
