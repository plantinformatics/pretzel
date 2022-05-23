import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';


import { toArrayPromiseProxy } from '../utils/ember-devel';

const dLog = console.debug;

export default class GroupRoute extends Route {
  @service session;

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

    /** can add server to queryParams, as in routes/groups */
    let store = transition.from?.attributes.server?.store;
    if (store) {
      dLog(fnName, this.store === store, store?.name);
      this.store = store;
    }
  }

}
