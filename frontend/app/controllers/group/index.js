import Controller from '@ember/controller';
import { getOwner } from '@ember/application';
import { computed, action } from '@ember/object';

import { removeGroupMember } from '../../utils/data/group';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------


/**
 * @param model group
 */
export default class GroupIndexController extends Controller {

  //----------------------------------------------------------------------------

  // copied from controllers/groups.js
  /**
   * @param clientGroup is from this.model.groupsIn, via #each in .hbs
   */
  @action
  removeGroupMember(clientGroup) {
    const
    fnName = 'removeGroupMember',
    msgName = fnName + 'Msg',
    /** model is group */
    server = this.model.server,
    apiServers = server.apiServers,
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

  //----------------------------------------------------------------------------

}
