import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';

/* global Ember */

import { toPromiseProxy } from '../../utils/ember-devel';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------


export default class GroupEditController extends Controller {
  // @service auth;

  // @service apiServers;
  // apiServers: service(),

  // @service session;
  // session : service(),

  // @service controls;

  // newClientName : string;
  constructor() {
    super();
    this.newClientName = undefined;
  }

  /** lookup owner and services when required. */
  @computed() get services () {
    let owner = Ember.getOwner(this.target);
    let
    apiServers = owner.lookup('service:apiServers'),
    session = owner.lookup('service:session'),
    auth = owner.lookup('service:auth'),
    controls = owner.lookup('service:controls'),

    services = {
      apiServers, session, auth, controls
    };
    return services;
  }
  @alias('services.apiServers') apiServers;
  @alias('services.session') session;
  @alias('services.auth') auth;
  @alias('services.controls') controls;


  /** clientId for the primaryServer */
  get clientIdSession() {

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
    dLog(fnName, groupId, newClientName);
    let
    server = this.get('controls.apiServerSelectedOrPrimary'),
    store = server.store;
    let
    clientId = server.clientId || this.clientIdSession;
    dLog(fnName, this.clientIdSession);
    {
      dLog(fnName, store.name, this.store === store);
      if (store && groupId && clientId)  {
        let
        group = store.peekRecord('group',groupId),
        // clientP = store.queryRecord('client', {email: newClientName}),
        // clientP.then((client))
        clientGroupP = this.get('auth').addClientGroupEmail(groupId, newClientName),
        p = toPromiseProxy(clientGroupP);
          /*
          store.createRecord('client-group', {
          groupId : group,
          clientId : newClientName
        });
        let p = clientGroup.save();
        */

        this.set(msgName, p);
      }
    }
  }



  @computed('model.group.id')
  get groupDatasets() {
    let
    apiServers = this.get('apiServers'),
    server = this.get('controls.apiServerSelectedOrPrimary'),
    store = server.store,
    group = this.model,
    groupId = group.id,
    filter = {include: 'group', where : {groupId}},

    /** associate the server with the adapterOptions, used by
     *   adapters/application.js : buildURL().
     * as in :
     *   services/data/dataset.js : taskGetList(), getData()
     *   services/data/block.js : getData()
     */
    adapterOptions = apiServers.addId(server, { filter }), 

    datasetsP = store.query('dataset', adapterOptions);

    datasetsP.then(function(datasets) {
      dLog('datasets', datasets.toArray());
    });

    return datasetsP;
  };


}
