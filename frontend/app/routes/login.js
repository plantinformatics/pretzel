import Ember from 'ember';
import UnauthenticatedRouteMixin from 'ember-simple-auth/mixins/unauthenticated-route-mixin';

const { Route } = Ember;

const dLog = console.debug;

export default Route.extend(UnauthenticatedRouteMixin, {
  model(paramsIn, transition) {
    // queryParams may contain user_{identification,password} so only log this in devel
    // dLog('model() transition.queryParams', transition.queryParams);
    return transition.queryParams;
  }

});
