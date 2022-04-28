import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';


import { getGroups, groupDatasets } from '../../utils/data/group';

// -----------------------------------------------------------------------------

const trace = 1;
let dLog = trace ? console.debug : function () { };

// -----------------------------------------------------------------------------

export default class GroupEditRoute extends Route {
  @service auth;
  @service apiServers;

  @action
  willTransition(transition) {
    dLog('willTransition', transition);
    this.controller.set('newClientName', null);
    this.controller.set('selectedClientGroupId', null);
    this.controller.set('addClientMsg', null);
    this.controller.set('removeGroupMemberMsg', null);
    this.controller.set('deleteGroupMsg', null);
  }

  afterModel(model) {
    dLog('afterModel', model);
    let group = model;
    model.set('groupDatasets', this.groupDatasets(group));
  }

  /** refreshModel() is used after successful addClient() and removeGroupMember(),
   * so we want to update group.clients, so this.refresh() is not sufficient.
   * getGroups(,true,) will update that; it gets all groups owned by this user,
   * whereas we only need this group to be refreshed.
   *
   * If the user navigates to the groups page then 'Joined Groups' should be
   * refreshed, so use groups.refresh() which flags both groups/{in,own} to be
   * updated when they are displayed.
   */
  @action
  refreshModel() {
    const fnName = 'refreshModel';
    dLog(fnName);
    let
    group = this.controller.model,
    store = group.get('store'),
    apiServers = this.get('apiServers'),
    server = apiServers.lookupServerName(store.name),
    groups = server.groups;
    groups.refresh();
    groups.get('groupsIn'); 
    groups.get('groupsOwn'); 

    /** This updates just groups/own, whereas the above groups.refresh() also refreshes
     * groups/in, which the groups page displays. */
    if (false) {
      const
    groupsP = getGroups(this.get('auth'), /*own*/true, server, apiServers);
    groupsP.then((groups) => {
      dLog(fnName, (trace < 2) ? ',' : [this.controller.model.clients], groups.length);
    });
    }

    /** result of groupsP is pushed into the store. */
    /** Update parent model also. */
    this.refresh();
    const eventWasHandled = false;
    return eventWasHandled;
  }

  groupDatasets(group) {
    let
    apiServers = this.get('apiServers'),
    store = group.store,
    server = apiServers.lookupServerName(store.name),
    groupId = group.id,
    datasetsP = groupDatasets(apiServers, server, store, groupId);

    return datasetsP;
  };



}
