import Route from '@ember/routing/route';
import AuthenticatedRouteMixin from '../utils/ember-simple-auth-mixin-replacements/authenticated-route-mixin';	// ember-simple-auth/mixins/
import UnauthenticatedRouteMixin from '../utils/ember-simple-auth-mixin-replacements/unauthenticated-route-mixin';	// ember-simple-auth/mixins/

// see also ./mapview.js e.g. :
// if (window['AUTH'] !== 'NONE') {
//   args.unshift(AuthenticatedRouteMixin);
// }

export default Route.extend(
  {
    authenticationRoute: 'login',
  },
  window['AUTH'] !== 'NONE'? AuthenticatedRouteMixin : UnauthenticatedRouteMixin
);
