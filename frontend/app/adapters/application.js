import Ember from 'ember';
import DS from 'ember-data';
import DataAdapterMixin from 'ember-simple-auth/mixins/data-adapter-mixin';
import PartialModelAdapter from 'ember-data-partial-model/mixins/adapter';
import ENV from '../config/environment';
const { inject: { service } } = Ember;


var config = {
  apiEndpoints: service('api-endpoints'),
  authorizer: 'authorizer:application', // required by DataAdapterMixin
  session: service('session'),

  /** host and port part of the url of the API
   * @see buildURL()
   */
  host: function () {
    let endpoint = this._endpoint,
    host = endpoint ? endpoint.host : ENV.apiHost;
    console.log('app/adapters/application.js host', this, arguments, endpoint, host);
    return host;
  }.property().volatile(),
  namespace: ENV.apiNamespace,
  urlForFindRecord(id, type, snapshot) {
    let url = this._super(...arguments);
    // facilitating loopback filter structure
    if (snapshot.adapterOptions && snapshot.adapterOptions.filter) {
      let queryParams = Ember.$.param(snapshot.adapterOptions);
      return `${url}?${queryParams}`;
    }
    return url;
  },
  /** Wrap buildURL(); get endpoint associated with adapterOptions or query and
   * pass endpoint as this._endpoint through to get('host'), so that it can use endpoint.host
   * The adapterOptions don't seem to be passed to get('host')
   */
  buildURL(modelName, id, snapshot, requestType, query) {
    let endpointHandle;
    /** snapshot may be an array of snapshots.
     *  apparently snapshotRecordArray has the options, as adapterOptionsproperty,
     *   refn https://github.com/emberjs/data/blob/master/addon/-private/system/snapshot-record-array.js#L53
     */
    if (snapshot)
    {
      endpointHandle = snapshot.adapterOptions || (snapshot.length && snapshot[0].adapterOptions);
      console.log('buildURL snapshot.adapterOptions', endpointHandle);
    }
    else if (query)
    {
      console.log('buildURL query', query);
      endpointHandle = query;
    }
    if (! endpointHandle && id)
    {
      endpointHandle = id;
      console.log('buildURL id', id);
    }
    // if (endpointHandle) // or use 'current'
    {
      let map = this.get('apiEndpoints').get('id2Endpoint'),
      endpoint = map.get(endpointHandle),
      /** - drop this - don't need current (also should be currentEndpoint
       * because string 'current' cannot be WeakMap id). */
      current = map.get('current');
      if (endpoint)
        console.log('buildURL endpoint', endpoint, current);
      else
        endpoint = current;
      if (endpoint) {
        this._endpoint = endpoint;
        this.set('session.requestEndpoint', endpoint);
      }
    }
    return this._super(modelName, id, snapshot, requestType, query);
  },
  updateRecord(store, type, snapshot) {
    // updateRecord calls PUT rather than PATCH, which is
    // contrary to the record.save method documentation
    // the JSONAPI adapter calls patch, while the
    // RESTAdapter calls PUT
    let data = {};
    let serializer = store.serializerFor(type.modelName);

    serializer.serializeIntoHash(data, type, snapshot);

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
  }
}

var args = [PartialModelAdapter, config]

if (window['AUTH'] !== 'NONE'){
  args.unshift(DataAdapterMixin);
}

export default DS.RESTAdapter.extend(...args);
