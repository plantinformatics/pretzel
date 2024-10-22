import Route from '@ember/routing/route';
import UnauthenticatedRouteMixin from '../utils/ember-simple-auth-mixin-replacements/unauthenticated-route-mixin';	// ember-simple-auth/mixins/

export default Route.extend(UnauthenticatedRouteMixin);
