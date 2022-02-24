import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';


import { toArrayPromiseProxy } from '../utils/ember-devel';

const dLog = console.debug;

export default class GroupsRoute extends Route {
  @service auth;

  model() {
    let
    groupsP = this.get('auth').groups(/*own*/true),
    modelP = {groups : toArrayPromiseProxy(groupsP)};
    return modelP;
  }
}
