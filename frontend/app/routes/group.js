import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';


import { toArrayPromiseProxy } from '../utils/ember-devel';

const dLog = console.debug;

export default class GroupRoute extends Route {
  @service controls;

  beforeModel() {
    let store = this.get('controls.apiServerSelectedOrPrimary.store');
    dLog('beforeModel', this.store === store);
    this.store = store;
  }

  x_model() {
    let
    groupsP = this.store.find .groups(/*own*/true),
    modelP = {groups : toArrayPromiseProxy(groupsP)};
    return modelP;
  }


}
