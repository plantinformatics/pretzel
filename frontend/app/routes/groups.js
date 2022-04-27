import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { alias } from '@ember/object/computed';


const dLog = console.debug;

export default class GroupsRoute extends Route {
  @service controls;
  @service apiServers;
  @service session;

  queryParams = {
    server : {
      refreshModel: true
    }};

  @alias('controls.apiServerSelectedOrPrimary') defaultServer;

  beforeModel() {
    const fnName = 'beforeModel';
    if (! this.session.isAuthenticated) {
      dLog(fnName, '!isAuthenticated', this.session);
      this.transitionTo('login');
    }
  }

  /** Model contains the groups of the selected server. */
  model(queryParams, transition) {
    let server;
    /** queryParams.server is text id : server.tabId */
    if (queryParams.server) {
      server = this.apiServers.lookupServerTabId(queryParams.server);
      // this.controller ? this.controller.get('serverObj') :
      if (this.controller && (queryParams.server !== this.controller.get('server'))) {
        dLog('model', this.controller.server, '!==', queryParams.server);
      }
      dLog('model', queryParams.server, server);
    }
    /* queryParams.server may be invalid, e.g. refresh tab while secondary
     * server is selected in groups; .apiServers.servers contains only the
     * primary because of refresh.  Then .defaultServer is correct.
     */
    if (! server) {
      server = this.get('defaultServer');
    }
    this.set('server', server);
    let groups = server.groups;

    let
    // filter :  {'include': 'clients'}
    // filter: {clientId} (where : {clientId} )
    // store.query('group', {}),

    fieldNames = ['groupsIn', 'groupsOwn'],
    /** groups{In,Own} values in groupsP and modelP are promises  */
    groupsP = fieldNames.map((fieldName) => [fieldName, groups.get(fieldName)]),
    modelP = Object.fromEntries(groupsP);
    modelP.server = server;
    modelP.groupsOwn.then((gs) => console.log('routes/groups:model() groupsOwn.then', gs.map((g) => [g.get('id'), g.get('name')]))); 

    return modelP;
  }

  @action
  refreshModel() {
    /** called before model(), so this.server is the previous value.
     * groups.refresh() may not be required when simply switching between servers (via select-server)
     */
    this.get('controller.serverObj.groups').refresh();
    this.refresh();
  }

}
