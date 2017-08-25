import DS from 'ember-data';
import DataAdapterMixin from 'ember-simple-auth/mixins/data-adapter-mixin';
import PartialModelAdapter from 'ember-data-partial-model/mixins/adapter';
import config from '../config/environment';

export default DS.RESTAdapter.extend(DataAdapterMixin, PartialModelAdapter, {
  authorizer: 'authorizer:application', // required by DataAdapterMixin
  host: config.apiHost,
  namespace: config.apiNamespace,
  urlForFindRecord(id, type, snapshot) {
    let url = this._super(...arguments);
    // facilitating loopback filter structure
    if (snapshot.adapterOptions && snapshot.adapterOptions.filter) {
      let queryParams = Ember.$.param(snapshot.adapterOptions);
      return `${url}?${queryParams}`;
    }
    return url;
  }
});
