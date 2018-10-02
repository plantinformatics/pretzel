import Ember from 'ember';
import { inject as service } from '@ember/service';
import { isPresent } from '@ember/utils';

const { Service } = Ember;

// import ENV from '../../config/environment';

/*----------------------------------------------------------------------------*/

/**
 * @param url host URL
 */
function ApiEndpoint(url, user, token) {
  console.log('ApiEndpoint', url, user, token);
  this.host = url;
  this.user = user;
  // -	also sanitize user input
  this.name = url
    ? this.host_safe()
    : "New";
  this.token = token;
}

/** Convert punctuation, including whitespace, to _  */
function removePunctuation(text) {
  // a normal input will contain e.g. :/@\.
  return text && text.replace(/[^A-Za-z0-9]/g, '_');
};
ApiEndpoint.prototype.host_safe = function() {
  return removePunctuation(this.host);
};
ApiEndpoint.prototype.user_safe = function() {
  return removePunctuation(this.user);
};

/** used as a WeakMap id - for now */
const currentEndpoint = {currentEndpoint : '' };

/*----------------------------------------------------------------------------*/

export default Service.extend({
  session: service(), 
  store: service(),
  endpoints : Ember.Object.create(),
  id2Endpoint : new WeakMap(),

  init() {
    this._super.apply(this, ...arguments);

    let { token, clientId } = this.get('session.data.authenticated');
    if (isPresent(token)) {
      let store = this.get('store'),
      client = store.peekRecord('block', clientId);
      console.log('init token', token, clientId, client);
      this.addEndpoint('http://localhost:4200', 'My.Email@gmail.com', token);
    }

    let protocol='http://', host = 'plantinformatics.io', // ENV.apiHost,
    /** e.g. map :4200 to :4201, (/00$/, '01') */
    host2 = host.replace(/^/, 'dev.');
    // this.addEndpoint(protocol + host, 'My.Email@gmail.com', undefined);
    this.addEndpoint(protocol + host2, 'My.Email@gmail.com', undefined);
  },

  /** Add a new ApiEndpoint.
   * Store it in this.endpoints, indexed by .name = .host_safe()
   */
  addEndpoint : function (url, user, token) {
	    let endpoint = new ApiEndpoint(url, user, token),
	  endpoints = this.get('endpoints'),
    /**  .name is result of .host_safe().
     * -	check if any further sanitising of inputs required */
    nameForIndex = endpoint.name;
	  // use .set() for CF updates
    endpoints.set(nameForIndex, endpoint);
    },

  /** Lookup an endpoint by its API host URL.
   * @param host  may be raw URL, or result of ApiEndpoint.host_safe().
   * @return undefined if host is undefined
   */
  lookupEndpoint : function(host) {
    let name = host && removePunctuation(host);
    let endpoint = name && this.get('endpoints').get(name);
    return endpoint;
  },

  addId : function(endpoint, id) {
    let map = this.get('id2Endpoint');
    map.set(id, endpoint);
    // map.set(currentEndpoint, endpoint);
    return id;
  },
  EndpointLogin: function(url, user, password) {
    let me = this;
    if (url.indexOf('http://') == -1) {
      url = 'http://' + url;
    }
    Ember.$.ajax({
      url: url + '/api/Clients/login',
      type: 'POST',
      crossDomain: true,
      contentType: 'application/json',
      data: JSON.stringify({
        email: user,
        password: password
      })
    }).then(function(response) {
      let token = response.id;
      me.addEndpoint(url, user, token);
    });
  }

});

/*----------------------------------------------------------------------------*/
