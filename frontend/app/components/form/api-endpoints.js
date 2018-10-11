import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  apiEndpoints: service('api-endpoints'),

  /* Early prototypes, up until commit fa0c40e, had action&function addEmpty(),
   * but not needed so dropped. */

  actions: {
    addNewDatasource() {
      $('#new-datasource-modal').modal('show');
    }
  },

  endpoints : Ember.computed.alias('apiEndpoints.endpoints')

});
