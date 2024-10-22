import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { computed, action } from '@ember/object';
import { alias } from '@ember/object/computed';
import { getOwner } from '@ember/application';

import { removeGroupMember } from '../utils/data/group';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class GroupsController extends Controller {
  @service router;
  @service apiServers;

  queryParams = ['server'];
  // .server is initially undefined.

  @computed('server')
  get serverObj() {
    const
    apiServers = this.apiServers,
    server = this.server ? apiServers.lookupServerTabId(this.server) : 
      apiServers.primaryServer;
    return server;
  }

  constructor() {
    super();
    this.newClientName = undefined;
  }

  /** lookup owner and services when required.
  @computed() get services () {
    let apiServers;
    let router;
    if (this.target) {
      dLog('services', 'target route', this.target);
      let owner = getOwner(this.target);
      apiServers = owner.lookup('service:apiServers');
      router = owner.lookup('service:router');
    } else if (this.model.server) {
      apiServers = this.model.server.apiServers;
    }
    const
    services = {
      apiServers, router,
    };
    return services;
  }
  @alias('services.apiServers') apiServers;
  @alias('services.router') router;
 */

  @action
  selectedServerChanged(server) {
    dLog('selectedServerChanged', server);
    let queryParams = {server : server.tabId};
    this.router.transitionTo({queryParams});
    // this.send('refreshModel');
  }

  /**
   * @param clientGroup is from this.model.groupsIn, via #each in .hbs
   */
  @action
  removeGroupMember(clientGroup) {
    const
    fnName = 'removeGroupMember',
    msgName = fnName + 'Msg',
    apiServers = this.get('apiServers'),
    store = clientGroup.store,
    server = apiServers.lookupServerName(store.name),
    clientGroupId = clientGroup.id;

    this.set(msgName, '');
    let
    destroyP = removeGroupMember(apiServers, server, clientGroup, clientGroupId);
    destroyP
      .then((cg) => {
        this.set('selectedClientGroupId', null);
        this.send('refreshModel');
      })
      .catch((errorText) => {
        this.set(msgName, errorText);
      });
    return destroyP;
  };

  @action
  setIsVisible(clientGroup, isVisible) {
    const
    fnName = 'setIsVisible',
    msgName = fnName + 'Msg';
    dLog(fnName, clientGroup, isVisible);
    if (clientGroup.isDeleted || clientGroup.isDestroying) {
      this.send('refreshModel');
    } else {
    this.set(msgName, null);
    clientGroup.set('isVisible', isVisible);
    clientGroup.save()
      .then((cg) => {
        dLog(fnName, cg.isVisible, clientGroup.isVisible);
        // this.send('refreshModel');
      })
      .catch((errorText) => {
        const errorDetail = errorText?.errors[0];
        dLog(fnName, errorDetail || errorText);
        if (errorDetail?.status === '404') {
          errorText = 'Unable to set visible because this group membership no longer exists.';
        }
        this.set(msgName, errorText);
        this.send('refreshModel');
      });
  }
  }
}
