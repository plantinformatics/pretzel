import Ember from 'ember';
import { inject as service } from '@ember/service';
import { isPresent } from '@ember/utils';
import { default as ApiEndpoint, removePunctuation } from '../components/service/api-endpoint';


const { Service } = Ember;

// import ENV from '../../config/environment';



/*----------------------------------------------------------------------------*/

/**
 * Sends via Evented : receivedDatasets(datasets)
 */
export default Service.extend(Ember.Evented, {
  session: service(), 
  store: service(),
  dataset: service('data/dataset'),

  endpoints : Ember.Object.create(),
  endpointsLength : 0,
  id2Endpoint : new WeakMap(),
  /** Indexed by host url, value is an array of datasets, including blocks, returned from the api host. */
  datasetsBlocks : {},

  init() {
    this._super.apply(this, ...arguments);

    let { token, clientId } = this.get('session.data.authenticated');
    if (isPresent(token)) {
      console.log('init token', token, clientId);
      /** default backend server API on :5000,  typical devel configuration : ember server on :4200 */
      let primaryEndpoint = this.addEndpoint('http://localhost:5000', undefined, token);
      this.set('primaryEndpoint', primaryEndpoint);
      primaryEndpoint.set('firstTab', true);
    }

    if (false)  // useful in setting up development data
    {
      let protocol='http://', host = 'plantinformatics.io', // ENV.apiHost,
      /** e.g. map :4200 to :4201, (/00$/, '01') */
      host2 = host.replace(/^/, 'dev.');
      // this.addEndpoint(protocol + host, 'My.Email@gmail.com', undefined);
      this.addEndpoint(protocol + host2, 'My.Email@gmail.com', undefined);
    }
  },

  // needs: ['component:service/api-endpoint'],

  /** Add a new ApiEndpoint.
   * Store it in this.endpoints, indexed by .name = .host_safe()
   * @return endpoint (Ember Object) ApiEndpoint
   */
  addEndpoint : function (url, user, token) {
    // const MyComponent = Ember.getOwner(this).factoryFor('component:service/api-endpoint');
	  let endpointBase = 
      {
        host : url,
        user : user,
        token : token
      },
    ownerInjection = Ember.getOwner(this).ownerInjection(),
    endpoint = ApiEndpoint.create(
      ownerInjection,
      endpointBase),
	  endpoints = this.get('endpoints'),
    /**  .name is result of .host_safe().
     * -	check if any further sanitising of inputs required */
    nameForIndex = endpoint.get('name');
    console.log('addEndpoint', endpointBase, endpoint.get('tabId'), endpoint, endpoints, nameForIndex);
    endpoints.set(nameForIndex, endpoint);
    /* not used yet, intended as a dependent value for a computed function, which
     * cannot depend on .endpoints since it is a hash not an array. */
    this.incrementProperty('endpointsLength');
    // or equivalent : this.set('endpointsLength', Object.keys(endpoints).length);
    return endpoint;
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
      let endpoint =
      me.addEndpoint(url, user, token);
      endpoint.getDatasets();
    });
  }



});

/*----------------------------------------------------------------------------*/
