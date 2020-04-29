import Ember from 'ember';

const { inject: { service }, Component } = Ember;

/* global $ */

/*----------------------------------------------------------------------------*/

/** Enable display of form/api-server for each data source / api-server.
 * This was useful when developing the connection setup.
 * It displays the token, which is useful for command-line upload; otherwise
 * users have to go hunting through web inspector : Application : Storage :
 * cookies : ember_simple_auth-session : token.
 */
const showList = false;

/*----------------------------------------------------------------------------*/

export default Component.extend({
  apiServers: service(),

  showList,

  /* Early prototypes, up until commit fa0c40e, had action&function addEmpty(),
   * but not needed so dropped. */

  actions: {
    addNewDatasource() {
      $('#new-datasource-modal').modal('show');
    }
  },

  servers : Ember.computed.alias('apiServers.servers')

});
