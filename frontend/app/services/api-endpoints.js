import Ember from 'ember';
import { inject as service } from '@ember/service';
import { isPresent } from '@ember/utils';
import { default as ApiEndpoint, removePunctuation } from '../components/service/api-endpoint';

const { Service } = Ember;

// import ENV from '../../config/environment';

import {
  getConfiguredEnvironment,
  getSiteOrigin
} from '../utils/configuration';

/*----------------------------------------------------------------------------*/

let trace = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/**
 * Sends via Evented : receivedDatasets(datasets)
 */
export default Service.extend(Ember.Evented, {
  session: service(), 
  store: service(),
  dataset: service('data/dataset'),
  storeManager: Ember.inject.service('multi-store'),

  endpoints : Ember.Object.create(),
  endpointsLength : 0,
  id2Endpoint : {},
  obj2Endpoint : new WeakMap(),
  /** Indexed by host url, value is an array of datasets, including blocks, returned from the api host. */
  datasetsBlocks : {},

  init() {
    this._super.apply(this, ...arguments);

    let { token, clientId } = this.get('session.data.authenticated');
    if (isPresent(token)) {
      let 
        /** similar calcs in @see adapters/application.js : host() */
      adapter = this.get('store').adapterFor('application'),
      /** this is the API origin,  e.g.  'http://localhost:5000' */
      host = adapter.get('host'),
      config =  getConfiguredEnvironment(this),
      configApiHost = config.apiHost,

      apiOrigin = configApiHost, // host,

      siteOrigin = getSiteOrigin(this);

      console.log('init token', token, clientId, 'api host', apiOrigin, siteOrigin);
      /** ENV.apiHost is '' when environment=="production",
       * as a result apiOrigin is '' when site is served from the backend
       * rather than from ember server;  in this case use siteOrigin
       * because site server and API server are the same.
       * At the moment the same substitution of siteOrigin is done in
       * adapter.host(), so it is not necessary to do apiOrigin || siteOrigin
       * here.
       */
      let primaryEndpoint = this.addEndpoint(apiOrigin || siteOrigin, undefined, token);
      console.log('primaryEndpoint', primaryEndpoint);
    }

    if (false)  // useful in setting up development data
    {
      /** default backend server API on :5000,  typical devel configuration : ember server on :4200 */
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
    let existing = endpoints.get(nameForIndex);
    if (existing)
      console.log('addEndpoint existing=', existing, nameForIndex);
    endpoints.set(nameForIndex, endpoint);

    let options = { adapterOptions : { host : url } },
    storeManager = this.get('storeManager'),
    store;
    if (existing) {
      // replacing existing endpoint if same name;  also replace the store.
      store = storeManager.unregisterStore(nameForIndex);
      dLog('existing', existing.get('store') === store, store);
    }
    if (storeManager.registerStore(nameForIndex, options)) {
      store = storeManager.getStore(nameForIndex);
      endpoint.set('store', store);
      console.log('registered store', nameForIndex, store, endpoint, url);
    }

   /** isPrimary true means this is the API endpoint which serves the app,
    * or which the app connects to when it starts.
    */
    let isPrimary = this.get('endpointsLength') == 0;
    if (isPrimary || ! this.set('primaryEndpoint')) {
      this.set('primaryEndpoint', endpoint);
      /* first tab gets the initial .active, via addClassActive() */
      endpoint.set('firstTab', true);
    }

    /* Used as a dependent value for a computed function (stores), which
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
    let map = this.get('obj2Endpoint');
    map.set(id, endpoint);
    return id;
  },
  id2Store : function(blockId) {
    let
      id2Endpoint = this.get('id2Endpoint'),
    endpoint = id2Endpoint[blockId],
    store = endpoint.store;
    if (trace > 2)
      dLog('id2Store', blockId, endpoint, store);
    return store;
  },
  stores : Ember.computed('endpoints.@each.store', 'endpointsLength', function () {
    let
	  endpoints = this.get('endpoints'),
    stores = Object.keys(endpoints).map(
      (name) => endpoints[name].store);
    dLog('stores', stores, endpoints);
    return stores;
  }),


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
    }).catch(function (error) {
      dLog('EndpointLogin', url, user, error);
    });
  }



});

/*----------------------------------------------------------------------------*/
