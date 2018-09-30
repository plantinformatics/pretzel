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

function removePunctuation(text) {
  return text && text.replace(/[:/@\.]/g, '_');
};
ApiEndpoint.prototype.host_safe = function() {
  return removePunctuation(this.host);
};
ApiEndpoint.prototype.name_safe = function() {
  return removePunctuation(this.name);
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

  addEndpoint : function (url, user, token) {
	    let endpoint = new ApiEndpoint(url, user, token),
	  endpoints = this.get('endpoints'),
    /**  -	sanitise inputs here also */
    nameForIndex = endpoint.name.replace(/\./g, '_');
	  // use .set() for CF updates
    endpoints.set(nameForIndex, endpoint);
    },
  addId : function(endpoint, id) {
    let map = this.get('id2Endpoint');
    map.set(id, endpoint);
    // map.set(currentEndpoint, endpoint);
    return id;
  }
});

/*----------------------------------------------------------------------------*/
