import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

/* global Ember */

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------


export default class GroupEditController extends Controller {

  // @service apiServers;
  // apiServers: service(),

  // @service session;
  // session : service(),

  // newClientName : string;
  constructor() {
    super();
    this.newClientName = undefined;
  }


  /** clientId for the primaryServer */
  get clientIdSession() {
    let owner = Ember.getOwner(this.target);
    this.apiServers = owner.lookup('service:apiServers');
    this.session = owner.lookup('service:session');

    /** copied from ./add.js */
    let clientIdSession = this.get('session.data.authenticated.clientId');
    return clientIdSession;
  }


  addClient() {
    const
    fnName = 'addClient',
    msgName = fnName + 'Msg',
    group = this.model,
    groupId = group.id,
    newClientName = this.newClientName;
    dLog(fnName, newClientName);
    let
    clientId = this.clientIdSession;
    dLog(fnName, this.clientIdSession);
    {
      let store = this.get('apiServers.primaryServer.store');
      dLog(fnName, this.store, store);
      if (store && groupId && clientId)  {
        var client = store.createRecord('client-group', {
          groupId,
          clientId : newClientName
        });
        let p = client.save();
        
        this.set(msgName, p);
      }
    }
  }


}
