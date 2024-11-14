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
    this.session.session.on('authenticationSucceeded', () => this.sessionAuthenticated());
    this.session.session.on('invalidationSucceeded', () => this.session.handleInvalidation('login'));
    // no this.session.triggerAuthentication, maybe this.session.session.requireAuthentication('login')
    this.session.session.on('authenticationRequested', () => this.session.triggerAuthentication('login'));
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
