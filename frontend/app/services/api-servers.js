import Ember from 'ember';
import { inject as service } from '@ember/service';
import { isPresent } from '@ember/utils';
import { default as ApiServer, removePunctuation } from '../components/service/api-server';

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

  servers : Ember.Object.create(),
  serversLength : 0,
  id2Server : {},
  obj2Server : new WeakMap(),
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
      let primaryServer = this.addServer(apiOrigin || siteOrigin, undefined, token);
      console.log('primaryServer', primaryServer);
    }

    if (false)  // useful in setting up development data
    {
      /** default backend server API on :5000,  typical devel configuration : ember server on :4200 */
      let protocol='http://', host = 'plantinformatics.io', // ENV.apiHost,
      /** e.g. map :4200 to :4201, (/00$/, '01') */
      host2 = host.replace(/^/, 'dev.');
      // this.addServer(protocol + host, 'My.Email@gmail.com', undefined);
      this.addServer(protocol + host2, 'My.Email@gmail.com', undefined);
    }
  },

  // needs: ['component:service/api-server'],

  /** Add a new ApiServer.
   * Store it in this.servers, indexed by .name = .host_safe()
   * @return server (Ember Object) ApiServer
   */
  addServer : function (url, user, token) {
    // const MyComponent = Ember.getOwner(this).factoryFor('component:service/api-server');
	  let serverBase = 
      {
        host : url,
        user : user,
        token : token
      },
    ownerInjection = Ember.getOwner(this).ownerInjection(),
    server = ApiServer.create(
      ownerInjection,
      serverBase),
	  servers = this.get('servers'),
    /**  .name is result of .host_safe().
     * -	check if any further sanitising of inputs required */
    nameForIndex = server.get('name');
    console.log('addServer', serverBase, server.get('tabId'), server, servers, nameForIndex);
    let existing = servers.get(nameForIndex);
    if (existing)
      console.log('addServer existing=', existing, nameForIndex);
    servers.set(nameForIndex, server);

    let options = { adapterOptions : { host : url } },
    storeManager = this.get('storeManager'),
    store;
    if (existing) {
      // replacing existing server if same name;  also replace the store.
      store = storeManager.unregisterStore(nameForIndex);
      dLog('existing', existing.get('store') === store, store);
    }
    if (storeManager.registerStore(nameForIndex, options)) {
      store = storeManager.getStore(nameForIndex);
      server.set('store', store);
      console.log('registered store', nameForIndex, store, server, url);
    }

   /** isPrimary true means this is the API server which serves the app,
    * or which the app connects to when it starts.
    */
    let isPrimary = this.get('serversLength') == 0;
    if (isPrimary || ! this.get('primaryServer')) {
      this.set('primaryServer', server);
      /* first tab gets the initial .active, via addClassActive() */
      server.set('firstTab', true);
    }

    /* Used as a dependent value for a computed function (stores), which
     * cannot depend on .servers since it is a hash not an array. */
    this.incrementProperty('serversLength');
    // or equivalent : this.set('serversLength', Object.keys(servers).length);
    return server;
    },

  /** Lookup a server by its API host URL.
   * @param host  may be raw URL, or result of ApiServer.host_safe().
   * @return undefined if host is undefined
   */
  lookupServer : function(host) {
    let name = host && removePunctuation(host);
    let server = name && this.get('servers').get(name);
    return server;
  },
  /** Lookup a server by its api-server.name (equiv store.name).
   * @param name
   * @return undefined if name is not in .servers
   */
  lookupServerName : function(name) {
    let server = name && this.get('servers').get(name);
    return server;
  },
  /** Lookup a server by its api-server.name (equiv store.name).
   * and return an integer [0 .. nServers-1]
   * @param name
   * @return -1 if name is not in .servers
   */
  lookupServerNameIndex : function(name) {
    let servers = this.get('servers'),
    nameList = Object.keys(servers),
    index = nameList.indexOf(name);
    return index;
  },

  addId : function(server, id) {
    let map = this.get('obj2Server');
    map.set(id, server);
    return id;
  },
  id2ServerGet(blockId) {
    let
      id2Server = this.get('id2Server'),
    server = id2Server[blockId];
    return server;
  },
  id2RemoteRefn(blockId) {
    let
      id2Server = this.get('id2Server'),
    server = id2Server[blockId],
    isPrimary = server === this.get('primaryServer'),
    remote = isPrimary ? blockId : {blockId, host : server.host, token : server.token};
      // or encode as text ? : blockId + '@' + server.host + '#' + server.token;
    return remote;
  },
  id2Store : function(blockId) {
    let
      id2Server = this.get('id2Server'),
    server = id2Server[blockId],
    store = server && server.store;
    if (! server || trace > 2)
      dLog('id2Store', blockId, server, store);
    return store;
  },
  stores : Ember.computed('servers.@each.store', 'serversLength', function () {
    let
	  servers = this.get('servers'),
    stores = Object.keys(servers).map(
      (name) => servers[name].store);
    dLog('stores', stores, servers);
    return stores;
  }),
  dataset2stores : function (datasetName) {
    let
	  servers = this.get('servers'),
    nameList = Object.keys(servers),
    stores = nameList.map(
      (name) => { let server = servers[name]; return {name, server, store: server.store};})
      .filter((s) => {let d = s.store.peekRecord('dataset', datasetName); return d && Object.assign(s, {dataset : d });  } );
    dLog('stores', stores, servers);
    return stores;
  },



  ServerLogin: function(url, user, password) {
    let me = this;
    if ((url.indexOf('http://') == -1) &&
        (url.indexOf('https://') == -1)) {
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
      let server =
      me.addServer(url, user, token);
      server.getDatasets();
    }).catch(function (error) {
      dLog('ServerLogin', url, user, error);
    });
  }



});

/*----------------------------------------------------------------------------*/
