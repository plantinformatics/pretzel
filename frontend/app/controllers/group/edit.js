import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { computed, action } from '@ember/object';
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
        clientGroupP.then((clientGroup) => {
          dLog(fnName, clientGroup);
          this.send('refreshModel');});

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

  @action
  selectMember(group, client, li) {
    const fnName = 'selectMember';
    dLog(fnName, group?.id, client?.id, li);
    let clientGroups = group.clientGroups.toArray();
    if (clientGroups.length) {
    let clientGroupId = clientGroups[0].id;
      this.set('selectedClientGroupId', clientGroupId);
    } else {
      let clientId = client.id,
          groupId = group.id,
          where = {clientId, groupId},
          filter = {where};
      /** API filter gives 0 results, so filter here instead.
      */
      group.store.query('client-group', {/*filter*/})
      // findAll('client-group')
        .then((clientGroups) => {
          let cgs;
          if (clientGroups.modelName) {
            cgs = clientGroups.toArray()
              .filter((cg) => (cg.get('clientId.id') === clientId) && (cg.get('groupId.id') === groupId))
              .map((c) => ({id : c.id, clientId : c.get('clientId.id'), groupId : c.get('clientId.id')}));
          } else {
            cgs = clientGroups.filter((cg) => (cg.clientId === clientId) && (cg.groupId === groupId));
          }
          if ( ! cgs.length) {
            dLog(fnName, 'not matched', clientId, groupId, clientGroups);
          } else {
            if (cgs.length > 1) {
              dLog(fnName, cgs.length, 'matched', clientId, groupId, cgs);
            }
            let clientGroup = cgs[0];
            this.set('selectedClientGroupId', clientGroup.id);
          }
        })
        .catch((error) => dLog(fnName, clientId, error));
    }
  };

  @action
  removeGroupMember() {
    const
    /** possibly pass clientGroupId in as param */
    clientGroupId = this.selectedClientGroupId,
    fnName = 'removeGroupMember',
    apiServers = this.get('apiServers'),
    server = this.get('controls.apiServerSelectedOrPrimary'),
    store = server.store,

    clientGroup = store.peekRecord('client-group', clientGroupId),
    adapterOptions = apiServers.addId(server, { }), 

    destroyP = clientGroup.destroyRecord(adapterOptions);
    destroyP.then(() => {
      this.set('selectedClientGroupId', null);
      dLog(fnName, 'done', clientGroupId);
      this.send('refreshModel');
    })
      .catch((error) => dLog(fnName, 'error', error, clientGroupId));
    return destroyP;
  }

}
