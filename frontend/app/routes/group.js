import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';


import { toArrayPromiseProxy } from '../utils/ember-devel';

const dLog = console.debug;

export default class GroupRoute extends Route {
  @service session;
  @service controls;

  @alias('controls.apiServerSelectedOrPrimary.store') selectedOrPrimaryStore;

  activate() {
    this.controllerFor('group').send('reset');
  }

  beforeModel(transition) {
    const fnName = 'beforeModel';
    // pre-Octane equivalent using AuthenticatedRouteMixin : authenticationRoute = 'login';
    // this.session.requireAuthentication(transition, 'login');
    if (! this.session.isAuthenticated) {
      dLog(fnName, '!isAuthenticated', this.session);
      this.transitionTo('login');
    }

    let store = this.get('selectedOrPrimaryStore');
    dLog(fnName, this.store === store);
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
