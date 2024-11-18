import { inject as service } from '@ember/service';
import Route from '@ember/routing/route';
import ApplicationRouteMixin from '../utils/ember-simple-auth-mixin-replacements/application-route-mixin';	// ember-simple-auth/mixins/

export default Route.extend(/*ApplicationRouteMixin,*/ {
  session: service(),
  sessionAccount: service('session-account'),

  /** configuration for ember-simple-auth. */
  routeAfterAuthentication : 'mapview',

  init() {
    this._super(...arguments);
    console.log(this, this.session, this.session.on);
    /** Same comment as in app/utils/ember-simple-auth-mixin-replacements/application-route-mixin.js :
     * Registrations for session.on authenticationSucceeded and
     * invalidationSucceeded which were here until 83f6bda4 are already done by
     * ember-simple-auth/addon/services/session.js : _setupHandlers(), which
     * uses Configuration.{routeAfterAuthentication,rootURL}.
     * That does not include authenticationRequested : triggerAuthentication(),
     * which seems no longer applicable.
     */
  },

  async beforeModel() {
    await this.session.setup();
    return this._loadCurrentUser();
  },

  sessionAuthenticated() {
    // this._super(...arguments);
    this.session.handleAuthentication('index');
    this._loadCurrentUser();
  },

  _loadCurrentUser() {
    return this.get('sessionAccount').loadCurrentUser().catch(() => this.get('session').invalidate());
  }
});
