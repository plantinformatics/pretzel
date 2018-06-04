import Ember from 'ember';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';
import UnauthenticatedRouteMixin from 'ember-simple-auth/mixins/unauthenticated-route-mixin';

const { Route } = Ember;

// if (window['AUTH'] !== 'NONE') {
//   args.unshift(AuthenticatedRouteMixin);
// }

export default Route.extend(window['AUTH'] !== 'NONE'? AuthenticatedRouteMixin : UnauthenticatedRouteMixin);