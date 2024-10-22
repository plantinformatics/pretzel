import Route from '@ember/routing/route';
import AuthenticatedRouteMixin from '../utils/ember-simple-auth-mixin-replacements/authenticated-route-mixin';	// ember-simple-auth/mixins/

export default Route.extend(AuthenticatedRouteMixin, {
  authenticationRoute: 'login',

});

