import Route from '@ember/routing/route';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';
import UnauthenticatedRouteMixin from 'ember-simple-auth/mixins/unauthenticated-route-mixin';

// if (window['AUTH'] !== 'NONE') {
//   args.unshift(AuthenticatedRouteMixin);
// }

export default Route.extend(window['AUTH'] !== 'NONE'? AuthenticatedRouteMixin : UnauthenticatedRouteMixin);