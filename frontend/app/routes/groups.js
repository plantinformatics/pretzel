import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';


import { toArrayPromiseProxy } from '../utils/ember-devel';

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
    groupsP = this.get('auth').groups(/*own*/true),
    modelP = {groups : toArrayPromiseProxy(groupsP)};
    return modelP;
  }
}
