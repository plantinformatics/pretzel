import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';


import { toArrayPromiseProxy } from '../utils/ember-devel';

const dLog = console.debug;

export default class GroupRoute extends Route {
  @service controls;

  @alias('controls.apiServerSelectedOrPrimary.store') selectedOrPrimaryStore;

  beforeModel() {
    let store = this.get('selectedOrPrimaryStore');
    dLog('beforeModel', this.store === store);
    this.store = store;
  }

  x_model(params) {
    dLog('group model', this, params);
    let store = this.get('selectedOrPrimaryStore');
    let modelP;

    if (params.group_id) {
      let groupP =
          store.peekRecord('group', params.group_id) ||
          store.findRecord('group', params.group_id);
      modelP = groupP;
    }
    return modelP;
  }


}
