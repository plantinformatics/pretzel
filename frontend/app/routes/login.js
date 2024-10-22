import Route from '@ember/routing/route';
import UnauthenticatedRouteMixin from '../utils/ember-simple-auth-mixin-replacements/unauthenticated-route-mixin';	// ember-simple-auth/mixins/

const dLog = console.debug;

export default Route.extend(UnauthenticatedRouteMixin, {
  /** configuration for ember-simple-auth. */
  routeIfAlreadyAuthenticated: 'mapview',

  model(paramsIn, transition) {
    // queryParams may contain user_{identification,password} so only log this in devel
    // dLog('model() transition.queryParams', transition.queryParams);
    return transition.queryParams;
  }

});
