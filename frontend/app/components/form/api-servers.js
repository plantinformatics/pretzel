import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

/* global $ */
/* global d3 */

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
  },

  servers : alias('apiServers.servers'),

  /** Provide class .multipleServers on <body> to enable tspan.blockServer to be
   * hidden when there is only 1 server.
   */
  multipleServersEffect : computed('apiServers.serversLength', function () {
    d3.select('body')
      .classed('multipleServers', this.get('apiServers.serversLength') > 1);
  })

});
