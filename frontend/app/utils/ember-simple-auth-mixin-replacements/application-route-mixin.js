///    ApplicationRouteMixin becomes:

import { inject as service } from '@ember/service';
import Mixin from '@ember/object/mixin';
//import Route from '@ember/routing/route';

export default Mixin.create({
//export default Route.extend({
  session: service(),
  sessionAccount: service('session-account'),

  init() {
    this._super(...arguments);
    /** These settings are replicated by routes/application.js : init() and 
     * ember-simple-auth/addon/services/session.js : _setupHandlers()
     * The latter uses Configuration.{routeAfterAuthentication,rootURL} so that is sufficient.
     */
    this.session.on('authenticationSucceeded', () => this.sessionAuthenticated());
    this.session.on('invalidationSucceeded', () => this.session.handleInvalidation('index'));
    this.session.on('authenticationRequested', () => this.session.triggerAuthentication('login'));
  },

  beforeModel() {
    return this._loadCurrentUser();
  },

  sessionAuthenticated() {
    this.session.handleAuthentication('index');
    this._loadCurrentUser();
  },

  _loadCurrentUser() {
    return this.get('sessionAccount').loadCurrentUser().catch(() => this.get('session').invalidate());
  }
});

/*
In this example, the app adds custom logic to the handler for the authenticationSucceeded event. To make things easier for the standard integration path of ESA, we could provide a convenience method handleSessionEvents or so which would be a shortcut for setting up the session service's standard event handlers for its own events like this:
*/
function handleSessionEvents() {
  this.session.on('authenticationSucceeded', () => this.session.handleAuthentication('index'));
  this.session.on('invalidationSucceeded', () => this.session.handleInvalidation('index'));
  this.session.on('authenticationRequested', () => this.session.triggerAuthentication('login'));
}
