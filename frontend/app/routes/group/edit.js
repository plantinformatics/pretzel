import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';


import { getGroups } from '../../utils/data/group';

// -----------------------------------------------------------------------------

const dLog = console.debug;

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


  /** refreshModel() is used after successful addClient() and removeGroupMember(),
   * so we want to update group.clients, so this.refresh() is not sufficient.
   * getGroups(,true,) will update that; it gets all groups owned by this user,
   * whereas we only need this group to be refreshed.
   */
  @action
  refreshModel() {
    const fnName = 'refreshModel';
    dLog(fnName);
    let
    group = this.controller.model,
    store = group.get('store'),
    server = this.get('apiServers').lookupServerName(store.name),
    groupsP = getGroups(this.get('auth'), /*own*/true, server);
    groupsP.then((groups) => {
      dLog(fnName, this.controller.model.clients, groups.length);
    });
    /** result of groupsP is pushed into the store. */
    /** Update parent model also. */
    const eventWasHandled = false;
    return eventWasHandled;
  }

}
