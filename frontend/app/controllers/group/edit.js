import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { computed, action } from '@ember/object';
import { alias } from '@ember/object/computed';
import { getOwner } from '@ember/application';

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
    this.set(msgName, null);
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
        clientGroupP = this.get('auth').addClientGroupEmail(groupId, newClientName);
        clientGroupP.then((clientGroup) => {
          dLog(fnName, clientGroup);
          this.send('refreshModel');
          // this.target.transitionTo('group.edit', groupId);
        })
          .catch((error) => {
            dLog(fnName, error);
            if (error.responseJSON.error) { error = error.responseJSON.error; }
            else if (error.error) { error = error.error; }
            this.set(msgName, error.message || error);
          });

          /*
          store.createRecord('client-group', {
          groupId : group,
          clientId : newClientName
        });
        let p = clientGroup.save();
        */

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
              .map((c) => ({id : c.id, clientId : c.get('clientId.id'), groupId : c.get('groupId.id')}));
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


  /**
   * @param clientGroupId may be this.selectedClientGroupId or this.clientGroups[i].id
   */
  @action
  removeGroupMember(clientGroupId) {
    const
    fnName = 'removeGroupMember',
    msgName = fnName + 'Msg',
    apiServers = this.get('apiServers'),
    server = this.get('controls.apiServerSelectedOrPrimary'),
    store = server.store,

    clientGroup = store.peekRecord('client-group', clientGroupId),
    adapterOptions = apiServers.addId(server, { }), 

    destroyP = clientGroup.destroyRecord(adapterOptions);
    this.set(msgName, '');

    destroyP.then((cg) => {
      this.set('selectedClientGroupId', null);
      // expect API response is {count : 1}
      dLog(
        fnName, 'done', clientGroupId, 
        cg.id,
        'groupId', cg.get('groupId.id'),
        'clientId.id', cg.get('clientId.id'),
        'clientId.email', cg.get('clientId.email'),
        'groupId.clientId', cg.get('groupId.clientId.id'));

      this.send('refreshModel');
    })
      .catch((error) => {
        let
        e = error?.errors[0],
        statusCode = e.status,
        /** the GUI won't send a request which would cause 403. */
        detail = (statusCode === '403') ? 'Only group owner / admin can remove members' :
          (statusCode === '409') ? 'Data error' : undefined;
        this.set(msgName, detail || error.message || error);
        dLog(fnName, 'error', error, clientGroupId);
      });
    return destroyP;
  };

  removeAllGroupMembers() {
    let
    fnName = 'removeAllGroupMembers',
    group = this.model,
    cgs = group.clientGroups,
    destroyPs = cgs.map((cg) => {
      return this.removeGroupMember(cg.id);
    });
    dLog(fnName, cgs);
    return Promise.all(destroyPs);
  };
  /** @return true or null, for disabled=
   */
  get deleteGroupDisabled() {
    let insensitive = this.groupDatasets.length ? true : null;
    return insensitive;
  };
  @action
  deleteGroup() {
    const fnName = 'deleteGroup';
    this.set('deleteGroupMsg', '');
    let
    group = this.model,
    apiServers = this.get('apiServers'),
    server = this.get('controls.apiServerSelectedOrPrimary'),
    store = server.store,
    adapterOptions = apiServers.addId(server, { }),
    removeMembersP = 
    // group = store.peekRecord('group', this.model.id),
    this.removeAllGroupMembers();
    removeMembersP
      .catch((error) => {
        dLog(fnName, error);
        this.set('deleteGroupMsg', error);
      })
      .then(() => {
        let
        destroyP = 
          group.destroyRecord(adapterOptions);
        destroyP
          .then((done) => {
            if (done.count !== 1) { console.log(fnName, done); }
            if (getOwner(this)) {
              this.transitionToRoute('groups');
            } else {
              this.target.transitionTo('groups');
            }
          })
          .catch((error) => {
            dLog(fnName, error);
            // error.name : TypeError
            if (error.message !== 'owner is undefined') {
              this.set('deleteGroupMsg', error);
            }
          });
        return destroyP;
      });
    return removeMembersP;
  };


}
