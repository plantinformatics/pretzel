import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';


import { toArrayPromiseProxy } from '../utils/ember-devel';

const dLog = console.debug;

export default class GroupRoute extends Route {
  @service router;
  @service session;
  @service apiServers;


  activate() {
    this.controllerFor('group').send('reset');
  }

  model(params) {
    const
    server = this.server || this.apiServers.primaryServer,
    store = server.store || this.store;
    dLog('model', server?.name, store.name);
    const groupP = store.findRecord('group', params.group_id);
    return groupP;
  }

  beforeModel(transition) {
    const fnName = 'beforeModel';
    // pre-Octane equivalent using AuthenticatedRouteMixin : authenticationRoute = 'login';
    // this.session.requireAuthentication(transition, 'login');
    if (! this.session.isAuthenticated) {
      dLog(fnName, '!isAuthenticated', this.session);
      this.router.transitionTo('login');
    }

    /** can add server to queryParams, as in routes/groups */
    let server = transition.from?.attributes.server;
    if (server) {
      dLog(fnName, server.name, server.store?.name);
      this.server = server;
    }
  }

}
