import { computed } from '@ember/object';
import $ from 'jquery';
import { get } from '@ember/object';
import { inject as service } from '@ember/service';
import RESTAdapter from '@ember-data/adapter/rest';
import DataAdapterMixin from '../utils/ember-simple-auth-mixin-replacements/data-adapter-mixin'; // 'ember-simple-auth/mixins/data-adapter-mixin';
// import PartialModelAdapter from 'ember-data-partial-model/mixins/adapter';
import { pluralize } from 'ember-inflector';

import ENV from '../config/environment';


import {
  getConfiguredEnvironment,
  getSiteOrigin
} from '../utils/configuration';

import { breakPoint } from '../utils/breakPoint';
import { dLog } from '../utils/common/log';

/*----------------------------------------------------------------------------*/

let trace = 1;

/*----------------------------------------------------------------------------*/

var config = {
  apiServers: service(),

  /** required by DataAdapterMixin */
  authorizer: 'authorizer:application',

  session: service('session'),

  /** host and port part of the url of the API
   * @see buildURL()
   */
  x_host: function () {
    let server = this._server,
    /** similar calcs in @see services/api-servers.js : init() */
    config =  getConfiguredEnvironment(this),
    configApiHost = config.apiHost,
    /** this gets the site origin. use this if ENV.apiHost is '' (as it is in
     * production) or undefined. */
    siteOrigin = getSiteOrigin(this),
    host = server ? server.host : ENV.apiHost || siteOrigin;
    if (ENV !== config)
      breakPoint('ENV !== config', ENV, config, ENV.apiHost, configApiHost);
    console.log('app/adapters/application.js host', this, arguments, server, config, configApiHost, ENV.apiHost, host);
    return host;
  },

  get host() {
    let store = this.store,
    adapterOptions = store && null, // store.adapterFor('block'),
    host = (adapterOptions && adapterOptions.host) || get(this, 'server.host');
    if (trace) {
      dLog('app/adapters/application.js host', adapterOptions, host, (trace < 2) ? [store.name, this._server?.name] : [this, store, this._server]);
    }
    return host;
  },

  /** determine the server to use.  */
  get server() {
    let
    server =
      this._server ||
      this.apiServers.currentRequestServer ||
      this.get('session.requestServer') ||
      this.apiServers.primaryServer;
    return server;
  },

  namespace: ENV.apiNamespace,

  urlForFindRecord(id, type, snapshot) {
    let url = this._super(...arguments);
    // facilitating loopback filter structure
    if (snapshot.adapterOptions && snapshot.adapterOptions.filter) {
      let queryParams = $.param(snapshot.adapterOptions);
      return `${url}?${queryParams}`;
    }
    return url;
  },

  get headers() {
    let
    fnName = 'headers',
    store = this.store,
    adapterOptions = store && store.adapterOptions,
    server = store.name && this.apiServers.lookupServerName(store.name) || this._server,
    token = server && server.token;
    if (! server) {
      server = this.apiServers.currentRequestServer;
      if (server) {
        const
        serverTime = this.apiServers.get('currentRequestServerTime'),
        now = Date.now();
        if (now - serverTime > 1000 /*ms*/) {
          dLog(fnName, now - serverTime, now, serverTime);
          /*
          server = undefined;
          this.apiServers.set('currentRequestServer', null);
          */
        }
        token = server?.token;
      }
      dLog(fnName, adapterOptions, store, server, token);
    }
    if (trace) {
      dLog(fnName, adapterOptions, (trace < 2) ? [store.name, server?.name] : [store, server], token);
    }
    return token && {
      Authorization : token
    };
  },

  /** Wrap buildURL(); get server associated with adapterOptions or query and
   * pass server as this._server through to get('host'), so that it can use server.host
   * The adapterOptions don't seem to be passed to get('host')
   */
  buildURL(modelName, id, snapshot, requestType, query) {
    let fnName = 'buildURL';
    let queryServerName, server;
    let serverHandle;
    /** snapshot may be an array of snapshots.
     *  apparently snapshotRecordArray has the options, as adapterOptionsproperty,
     *   refn https://github.com/emberjs/data/blob/master/addon/-private/system/snapshot-record-array.js#L53
     */
    if (snapshot)
    {
      serverHandle = snapshot.adapterOptions || (snapshot.length && snapshot[0].adapterOptions);
      console.log(fnName, 'snapshot.adapterOptions', serverHandle);
    }
    else if (query)
    {
      console.log(fnName, 'query', query);
      serverHandle = query;
      if (serverHandle.server) {
        if (serverHandle.server.name) {
          server = serverHandle.server;
          delete serverHandle.server;
        } else if (typeof serverHandle.server === 'string') {
          queryServerName = serverHandle.server;
          delete serverHandle.server;
        } else {
          console.log(fnName, 'server?', serverHandle.server);
        }
      }
    }
    if (! serverHandle && id)
    {
      serverHandle = id;
      console.log(fnName, 'id', id);
    }
    // this applies when serverHandle is defined or undefined
    if (! server)
    {
      if ((modelName === 'group') && id) {
        server = this.get('apiServers').groupId2Server(id);
        if (! server) {
          server = this.apiServers.primaryServer;
        }
      } else {
        /** block getData() is only used if allInitially (i.e. not progressive loading);
         *  so that addId is not done, so use id2Server. */
        let
        id2Server = this.get('apiServers.id2Server'),
        map = this.get('apiServers.obj2Server'),
        server = map.get(serverHandle) || (id && id2Server[id]);
        /* Don't use this for findRecord because if the id is not loaded, get :
         * Record client ... (@lid:client-...) is not yet loaded and thus cannot be accessed from the Snapshot during serialization
         */
        if (requestType !== 'findRecord' && ! server) {
          const
          /** the above works for blocks; for datasets (e.g. delete), can lookup server name from snapshot.record */
          snapshotServerName = snapshot && get(snapshot, 'record.store.name'),
          serverName = queryServerName || snapshotServerName,
          servers = this.get('apiServers.servers'),
          snapshotServer = servers && serverName && servers[serverName];
          server = snapshotServer;
          if (serverName) {
            dLog(fnName, queryServerName, snapshotServerName, snapshotServer);
          }
        }
        if (trace) {
          dLog(fnName, 'id2Server', id, requestType, (trace < 2) ? [server?.name] : [id2Server, map, server]);
        }
      }
    }

      /* if server is undefined or null then this code clears this._server and
       * session.requestServer, which means the default / local / primary
       * server is used.
       */
      {
        this._server = server;
        this.set('session.requestServer', server);
      }

    let url = this._super(modelName, id, snapshot, requestType, query);
    dLog(fnName, 'url', url, modelName, id, /*snapshot,*/ requestType, server?.name);
    return url;
  },

  updateRecord(store, type, snapshot) {
    const fnName = 'updateRecord';
    // updateRecord calls PUT rather than PATCH, which is
    // contrary to the record.save method documentation
    // the JSONAPI adapter calls patch, while the
    // RESTAdapter calls PUT
    let data = {};
    let
    object = store.peekRecord(snapshot.modelName, snapshot.id),
    /* changedAttributes now contains relationships in some cases. */
    changedAttributes = snapshot.changedAttributes(),
    changedAttributesKeys = Object.keys(changedAttributes),
    /** object.hasDirtyAttributes seems to be true if either an attribute or relationship has changed.
     */
    /** Recognise when dataset.groupId (only) is being set, and put only
     * .groupId in the PATCH, to avoid writing [] to .blocks
     * This could be used more generally as other changes are added.
     */
    /** possibly github.com/ef4/ember-data-relationship-tracker offers a better solution, or :
     * https://github.com/danielspaniel/ember-data-change-tracker
     * https://www.npmjs.com/package/ember-data-relationship-dirty-tracking
     * but they have not been updated to Ember v4.
     */
    record = snapshot.record,
    attributesToSave = record[Symbol.for('attributesToSave')];
    if (attributesToSave?.length) {
      dLog(fnName, record.id, attributesToSave);
      let attributeName;
      while ((attributeName = attributesToSave.pop())) {
        /** dataset record.get('clientId') is db id string instead of a proxy;
         * to handle that case, could instead do :
         *  const value = record.get(idField),
         *  valueId = value.then ? value.get('id') : value
         *  data[attributeName] = valueId || null;
         */
        const idField = attributeName.replace(/Id$/, 'Id.id');
        /* map undefined to null, for JSON web API.
         * When dataset.groupId is set to null, rc.groupId.get('id') returns
         * undefined; map this to null, which is valid JSON in PATCH.
         */
        data[attributeName] = record.get(idField) || null;
      }
      dLog(fnName, data, record.id, changedAttributes, attributesToSave);
    } else if ((changedAttributesKeys.length === 1) && (type.modelName !== 'feature')) {
      /* excluding 'feature' because having attributes .value and .values seems to
       * confuse snapshot.changedAttributes() - when .values.Ontology is set,
       * changedAttributes contains .value instead of .values
       */
      /** This handles changes to a single attribute, e.g. .public or ._meta,
       * and places only the changed attribute in the PATCH.
       */
      let key = changedAttributesKeys[0];
      /** the Dataset and Block serializers rename the db field .meta as ._meta
       * within the frontend, to avoid clash with Ember .meta. (commented also
       * in serializers/dataset.js : attrs).
       */
      let
      modelName = snapshot.modelName,
      serializer = store.serializerFor(modelName),
      model = store.modelFor(modelName),
      rename = serializer?._getMappedKey(key, model); // was serializer?.attrs[key] in Ember v3
      data[rename || key] = snapshot.attr(key); // was .__attributes[key];
    } else {
    let serializer = store.serializerFor(type.modelName);

    serializer.serializeIntoHash(data, type, snapshot);
    }

    let id = snapshot.id;
    let url = this.buildURL(type.modelName, id, snapshot, 'updateRecord');

    return this.ajax(url, "PATCH", { data: data });
  },

  deleteRecord(store, type, snapshot) {
    // loopback responds with 200 and a count of deleted entries
    // with the request. ember expects a 204 with an empty payload.
    return this._super(...arguments)
    .then(res => {
      if (Object.keys(res).length === 1 && res.count) {
        // Return null instead of an empty object, indicating to
        // ember a deleted record is persisted
        return null; 
      }
      return res;
    });
  },

  pathForType(type) {
    let path;
    /* if (type == "client-group") {
      path = pluralize(type);
    } else*/ {
      /** super will camel-case and pluralize the type */
      path = this._super(...arguments);
    }
    dLog('pathForType', type, path);
    return path;
  },

  _ajax(options) {
    let result;
    const server = this._server || this.server;
    /* if this is used then add Spark, as it has the same API as Germinate.
     * .serverType is set in new-datasource-modal.js : onConfirm() : ServerLogin().then()
     */
    if (server?.serverType !== 'Germinate') {
      result = this._super(...arguments);
    } else {
      dLog('_ajax', options, this, server);
    }
    return result;
  }

}

var args = [/*PartialModelAdapter,*/ config]

if (window['AUTH'] !== 'NONE'){
  args.unshift(DataAdapterMixin);
}

export default RESTAdapter.extend(...args);
