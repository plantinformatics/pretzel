import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { computed, action } from '@ember/object';
import { alias } from '@ember/object/computed';
import { getOwner } from '@ember/application';

/* global Ember */

import { toPromiseProxy } from '../../utils/ember-devel';
import { removeGroupMember } from '../../utils/data/group';

// -----------------------------------------------------------------------------

const dLog = console.debug;

/** If false then datasets with .public===false have .groupId === null
 * Same as in lb4app/lb3app/common/models/group.js
 */
const allowGroupsWhenPrivate = false;

// -----------------------------------------------------------------------------


/**
 * @param model group
 */
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

  @alias('controls.apiServerSelectedOrPrimary') server;

  /** .server.store === .groupStore. */
  @alias('group.store') groupStore;
  /** Lookup the server of the store of this group. */
  get server() {
    return this.get('apiServers').lookupServerName(this.groupStore.name);
  };

  /** clientId for the primaryServer */
  get clientIdSession() {

    /** copied from ./add.js */
    let clientIdSession = this.get('session.data.authenticated.clientId');
    return clientIdSession;
  }

  @action
  refresh() {
    this.send('refreshModel');
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
    server = this.get('server'),
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



  @action
  unGroup(dataset, button) {
    const
    fnName = 'unGroup',
    msgName = fnName + 'Msg';

    dLog(fnName, dataset.groupId, button);

    this.set(msgName, null);

    dataset.set('groupId', null);
    let
    unGroupP = dataset.save()
      .then((dataset) => {
        dLog(fnName, dataset.get('id'), dataset.get('public'), dataset.get('groupId.content'));
        this.send('refreshModel');
      })
      .catch((error) => {
        dLog(fnName, error);
        /** Example error.message :
         * "Ember Data Request PATCH .../api/datasets/datasetP1b returned a 500
         * Payload (application/json; charset=utf-8)
         * [object Object]"
         * log : Request PATCH /api/datasets/datasetP1b failed with status code 500. Error: Dataset not found
         * Possibly 404 instead ? refn : https://datatracker.ietf.org/doc/html/rfc5789
         */
        this.set(msgName, error.message || error);
      });
  }



  @action
  selectMember(clientGroup, li) {
    const fnName = 'selectMember';
    dLog(fnName, clientGroup?.id, li);
    this.set('selectedClientGroup', clientGroup);
  }

  /** Use group (this.model) and the given client to identify a clientGroup.
   * Used by removeGroupMemberClient() which is no longer required;
   * probably won't be needed.
   */
  clientToClientGroup(client) {
    let
    fnName = 'clientToClientGroup',
    group = this.model,
    cgs = group.clientGroups,
    clientGroup = cgs.find((cg) => {
      return cg.clientId === client.id;
    });
    dLog(fnName, clientGroup, cgs);
    if (! clientGroup) {
      clientGroup = client.groups.find((cg) => cg.clientId.get('id') === client.get('id'));
      dLog(fnName, clientGroup, client.get('id'), client.groups);
    }
    return clientGroup;
  }

  @action
  removeGroupMemberClient(client) {
    const
    fnName = 'removeGroupMemberClient',
    clientGroup = this.clientToClientGroup(client);
    if (clientGroup) {
      this.removeGroupMember(clientGroup.id);
    }
  }

  /**
   * @param clientGroup may be this.selectedClientGroup or group (this.model) .clientGroups[i]
   */
  @action
  removeGroupMember(clientGroup) {
    const
    fnName = 'removeGroupMember',
    msgName = fnName + 'Msg',
    apiServers = this.get('apiServers'),
    server = this.get('server');

    this.set(msgName, '');
    let
    destroyP = removeGroupMember(apiServers, server, clientGroup, clientGroup.id);
    destroyP
      .then((cg) => {
        this.set('selectedClientGroup', null);
        this.send('refreshModel');
      })
      .catch((errorText) => {
        this.set(msgName, errorText);
      });
    return destroyP;
  }

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
  }
  /** If allowGroupsWhenPrivate then the user is prevented from deleting groups
   * which have datasets assigned; otherwise, the user may delete the group and
   * .groupId of the corresponding datasets is set to null.
   *
   * @return true or null, for disabled=
   */
  get deleteGroupDisabled() {
    let insensitive = allowGroupsWhenPrivate && this.groupDatasets.length ? true : null;
    return insensitive;
  }
  @action
  deleteGroup() {
    const fnName = 'deleteGroup';
    this.set('deleteGroupMsg', '');
    let
    group = this.model,
    apiServers = this.get('apiServers'),
    store = this.get('groupStore'),
    server = this.get('server'),
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
            let dataGroups = this.get('server.groups');
            dataGroups.refresh();
            /* equivalent
            let
            owner = Ember.getOwner(this.target),
            routeGroups = owner.lookup('route:groups');
            routeGroups.transitionTo('groups');
            */
            this.target.transitionTo('groups');
          })
          .catch((error) => {
            const errorDetail = error?.errors[0];
            dLog(fnName, errorDetail || error);
            if (errorDetail?.status === '404') {
              error = 'Unable to delete Group because this Group no longer exists.';
            }
            dLog(fnName, error);

            // error.name : TypeError
            if (error.message !== 'owner is undefined') {
              this.set('deleteGroupMsg', error);
            }
          });
        return destroyP;
      });
    return removeMembersP;
  }


}
