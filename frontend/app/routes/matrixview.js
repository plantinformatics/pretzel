import Route from '@ember/routing/route';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';
import UnauthenticatedRouteMixin from 'ember-simple-auth/mixins/unauthenticated-route-mixin';

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
