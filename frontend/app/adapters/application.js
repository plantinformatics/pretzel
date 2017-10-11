import DS from 'ember-data';
import DataAdapterMixin from 'ember-simple-auth/mixins/data-adapter-mixin';
import PartialModelAdapter from 'ember-data-partial-model/mixins/adapter';
import ENV from '../config/environment';

var config = {
  authorizer: 'authorizer:application', // required by DataAdapterMixin
  host: ENV.apiHost,
  namespace: ENV.apiNamespace,
  urlForFindRecord(id, type, snapshot) {
    let url = this._super(...arguments);
    // facilitating loopback filter structure
    if (snapshot.adapterOptions && snapshot.adapterOptions.filter) {
      let queryParams = Ember.$.param(snapshot.adapterOptions);
      return `${url}?${queryParams}`;
    }
    return url;
  }
}

var args = [PartialModelAdapter, config]

if (ENV.APP.AUTH != false) args.unshift(DataAdapterMixin);

export default DS.RESTAdapter.extend(...args);