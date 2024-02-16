/**
https://github.com/simplabs/ember-simple-auth/issues/2185
 Quest: Drop mixins #2185 
...
https://github.com/simplabs/ember-simple-auth/pull/2198
 Deprecate mixins #2198 

--------------------------------------------------------------------------------
https://github.com/mainmatter/ember-simple-auth/issues/2185
https://github.com/mainmatter/ember-simple-auth/issues/2185#issuecomment-624137111
 marcoow commented on May 6, 2020

I think the best option would be to expose all functionality via the session service. I put together a quick example here. The idea is to add a few new methods into the service that replace the existing mixins more or less 1:1:
*/

///    AuthenticatedRouteMixin becomes:

import Mixin from '@ember/object/mixin';
// import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default Mixin.create({
// export default Route.extend({
  session: service(),

  beforeModel(transition) {
    this.session.requireAuthentication(transition, 'login');
  },

  model() {
    return this.get('store').findAll('post');
  }
});

