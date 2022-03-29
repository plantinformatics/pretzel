import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';


import { toArrayPromiseProxy } from '../utils/ember-devel';
import { getGroups } from '../utils/data/group';

const dLog = console.debug;

export default class GroupsRoute extends Route {
  @service auth;
  @service controls;


  model() {
    let
    /**   @service session;
    clientId = this.get('session.session.authenticated.clientId'),
    */
    store = this.get('controls.apiServerSelectedOrPrimary.store'),
    // filter :  {'include': 'clients'}
    // filter: {clientId} (where : {clientId} )
    // store.query('group', {}),

    auth = this.get('auth'),
    fieldNames = ['groupsIn', 'groupsOwn'],
    groupsP = [false, true].map(
      (own) => [fieldNames[+own], toArrayPromiseProxy(getGroups(auth, own, store))]),
    modelP = Object.fromEntries(groupsP);

    return modelP;
  }

  @action
  refreshModel() {
    this.refresh();
  }

}