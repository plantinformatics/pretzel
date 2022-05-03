import $ from 'jquery';

import { getOwner } from '@ember/application';
import EmberObject, { computed } from '@ember/object';
import Evented from '@ember/object/evented';
import Service, { inject as service } from '@ember/service';
import { isPresent } from '@ember/utils';

import { find as collection_find } from 'lodash/collection';

import {
  default as ApiServer,
  removePunctuation
} from '../components/service/api-server';

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
export default Service.extend(Evented, {
  session: service(), 
  store: service(),
  dataset: service('data/dataset'),
  storeManager: service('multi-store'),
  controls : service(),

  servers : EmberObject.create(),
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
      let primaryServer = this.addServer(apiOrigin || siteOrigin, undefined, token, clientId);
      console.log('primaryServer', primaryServer);
      primaryServer.getVersion();
    }

    if (false)  // useful in setting up development data
    {
      /** default backend server API on :5000,  typical devel configuration : ember server on :4200 */
      let protocol='http://', host = 'plantinformatics.io', // ENV.apiHost,
      /** e.g. map :4200 to :4201, (/00$/, '01') */
      host2 = host.replace(/^/, 'dev.');
      // this.addServer(protocol + host, 'My.Email@gmail.com', undefined);
      this.addServer(protocol + host2, 'My.Email@gmail.com', undefined /* , clientId */ );
    }
  },

  // needs: ['component:service/api-server'],

  /** @return true if currently connected to >1 servers.
   * @desc used to enable select-server pull-down
   */
  get multipleServers() {
    return this.serversLength > 1;
  },

  /** Add a new ApiServer.
   * Store it in this.servers, indexed by .name = .host_safe()
   * @return server (Ember Object) ApiServer
   */
  addServer : function (url, user, token, clientId) {
    // const MyComponent = Ember.getOwner(this).factoryFor('component:service/api-server');
    let serverBase = 
      {
        host : url,
        user : user,
        token : token,
        clientId
      },
    ownerInjection = getOwner(this).ownerInjection(),
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
      /* first tab gets the initial .active, via firstTabActive() */
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
  /** Lookup a server by its api-server.tabId, which is generally .name without 'https__'.
   * @param tabId
   * @return undefined if tabId is not in .servers
   */
  lookupServerTabId : function(tabId) {
    const
    servers = this.get('servers'),
    server = collection_find(servers, (s) => s.tabId === tabId);
    return server;
  },

  /*--------------------------------------------------------------------------*/
  /** The user selection of one of the server tabs in the data explorer
   * indicates which server should be the request target for upload, datasets
   * refresh and display in explorer.
   * @return the selected api-server, or default to primaryServer if none selected.
   */
  serverSelected : computed('controls.serverTabSelected', function () {
    /** As this function depends on controls.serverTabSelected, it could be
     * split out of this service into a service object with a constructor param
     * serverName, to enable different components to utilise different servers.
     */
    let
    serverTabSelectedName = this.get('controls.serverTabSelected'),
    serverTabSelected = serverTabSelectedName ?
      this.lookupServerName(serverTabSelectedName) :
      this.primaryServer;
    dLog('serverSelected', serverTabSelectedName, serverTabSelected);
    return serverTabSelected;
  }),

  /*--------------------------------------------------------------------------*/


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
    if ((trace && ! server) || trace > 2)
      dLog('id2Store', blockId, server, store);
    return store;
  },
  stores : computed('servers.@each.store', 'serversLength', function () {
    let
    servers = this.get('servers'),
    stores = Object.keys(servers).map(
      (name) => servers[name].store);
    dLog('stores', stores, servers);
    return stores;
  }),
  /** Lookup all connected stores for the given fieldName:id.
   * @return array of matches [{name, server, store, object }, ...] .
   */
  id2Stores : function (fieldName, id) {
    /** based on dataset2stores(), which could be simplified to :
     * return this.id2Stores('dataset', datasetName).map(
     *  (s) => { s.dataset = s.object; delete s.object; return s; })
     */
    let
    servers = this.get('servers'),
    nameList = Object.keys(servers),
    stores = nameList.map(
      (name) => { let server = servers[name]; return {name, server, store: server.store};})
      .filter((s) => {let d = s.store.peekRecord(fieldName, id); return d && Object.assign(s, {object : d });  } );
    if ((trace > 2) || (trace && (stores.length !== 1)))
      dLog('stores', id, stores, servers);
    return stores;
  },
  /** Similar to id2Store(), but that only finds originals because id2Server
   * does not contain copies. This function checks all connected stores, and
   * returns an array of matches.
   */
  blockId2Stores : function (blockId) {
    let stores = this.id2Stores('block', blockId);
    if (trace > 1) {
      dLog('blockId2stores', blockId, stores);
    }
    return stores;
  },
  dataset2stores : function (datasetName) {
    let
    servers = this.get('servers'),
    nameList = Object.keys(servers),
    stores = nameList.map(
      (name) => { let server = servers[name]; return {name, server, store: server.store};})
      .filter((s) => {let d = s.store.peekRecord('dataset', datasetName); return d && Object.assign(s, {dataset : d });  } );
    if ((trace > 2) || (trace && (stores.length !== 1)))
      dLog('stores', datasetName, stores, servers);
    return stores;
  },

  // ---------------------------------------------------------------------------

  groupId2Server(groupId) {
    let
    servers = this.get('servers'),
    server = Object.values(servers)
      .find((server) => {
        let
        groups = server.groups,
        match = groups.groupsInIds?.includes(groupId) ||
          groups.groupsOwn.toArray().findBy('id', groupId);
        return match;
      });
    return server;
  },

  

  // ---------------------------------------------------------------------------

  /** Equivalent to this.get('datasetsBlocks') which is [serverName] -> datasetsBlocks.
   * This form is useful as a ComputedProperty dependency, because dependency
   * .@each can only be on arrays, not objects (i.e. indexed by integer, not
   * string).
   *
   * @return [ {dataset, serverName}, ... ]
   */
  datasetsWithServerName : computed(
    // datasetsBlocksRefresh represents 'servers.@each.datasetsBlocks',
    'datasetsBlocksRefresh', 'serversLength', 
    function datasetsWithServerName () {
      let
        servers = this.get('servers'),
      nameList = Object.keys(servers),
      result = nameList.map(function(serverName) {
        let server = servers.get(serverName),
        datasetsBlocks = server.get('datasetsBlocks');
        return {datasetsBlocks, serverName};
      });
      return result;
    }),

  // ---------------------------------------------------------------------------


  ServerLogin: function(url, user, password) {
    let me = this;
    if ((url.indexOf('http://') == -1) &&
        (url.indexOf('https://') == -1)) {
      url = 'http://' + url;
    }
    let promise = 
    $.ajax({
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
        me.addServer(url, user, token, response.userId);
      server.getDatasets();
      server.getVersion();
    }).catch(function (error) {
      let
      re = error && error.responseJSON && error.responseJSON.error,
      reTexts = re && 
        ['statusCode', 'name', 'message'].reduce((texts, fN) => (texts[fN] = re[fN]) && texts, {});
      dLog('ServerLogin', url, user, error, error.statusText, reTexts);
      throw reTexts || error.statusText;
    });
    return promise;
  }



});

/*----------------------------------------------------------------------------*/
