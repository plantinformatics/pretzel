import Controller from '@ember/controller';
import { inject as service } from '@ember/service';


// -----------------------------------------------------------------------------
const dLog = console.debug;

// -----------------------------------------------------------------------------
export default Controller.extend({
  apiServers: service(),


// export default class GroupsAddController extends Controller {

  // @service session;
  session : service(),

/*
  constructor() {
    super();
    this.newGroupName = undefined;
  }
*/
  newGroupName : undefined,

  // ---------------------------------------------------------------------------

  /** clientId for the primaryServer */
  get clientIdSession() {
    /** extract from models/record.js : owner() */
    let clientIdSession = this.get('session.data.authenticated.clientId');
    return clientIdSession;
  }
  ,

  // ---------------------------------------------------------------------------

  addGroup() {
    const
    fnName = 'addGroup',
    msgName = fnName + 'Msg',
    newGroupName = this.newGroupName;
    dLog(fnName, newGroupName);
    let
    clientId = this.clientIdSession;
    dLog(fnName, this.clientIdSession);
    {
      let store = this.get('apiServers.primaryServer.store');
      dLog(fnName, this.store, store);

        var group = store.createRecord('group', {
          name: newGroupName,
          clientId
        });
        let p = group.save();
        
        this.set(msgName, p);
      }
  }

  //}
});
