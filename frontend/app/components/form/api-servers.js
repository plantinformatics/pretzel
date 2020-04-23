import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  apiServers: service(),

  /* Early prototypes, up until commit fa0c40e, had action&function addEmpty(),
   * but not needed so dropped. */

  actions: {
    addNewDatasource() {
      $('#new-datasource-modal').modal('show');
    }
  },

  servers : Ember.computed.alias('apiServers.servers')

});
