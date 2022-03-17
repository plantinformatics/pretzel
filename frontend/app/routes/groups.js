import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';


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
    groupsP = [false, true].map(
      (own) => this.get('auth').groups(own)),
    modelP = {};

    /** these 2 blocks can be factored into a function, split out of model(). */
    let serializer = store.serializerFor('client-group');
    let groupsP0R = 
    groupsP[0].then((cgs) => {
      let cgrs = cgs.map((cg) => {
        let j = serializer.normalizeGroupsIn(cg),
        jr = serializer.store.push(j);
        return jr;
      });
      return cgrs;
    });
    modelP.groupsIn = toArrayPromiseProxy(groupsP0R);

    let groupSerializer = store.serializerFor('group');
    let groupsP1R = 
    groupsP[1].then((gs) => {
      let grs = gs.map((g) => {
        let j = groupSerializer.normalizeGroupsOwn(g),
        jr = groupSerializer.store.push(j);
        return jr;
      });
      return grs;
    });
    modelP.groupsOwn = toArrayPromiseProxy(groupsP1R);


    return modelP;
  }

  @action
  refreshModel() {
    this.refresh();
  }

}
