///    UnauthenticatedRouteMixin becomes:

import Mixin from '@ember/object/mixin';
// import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default Mixin.create({
// export default Route.extend({
  session: service(),

  beforeModel(transition) {
    console.log('replacements/unauthenticated-route-mixin.js', 'beforeModel', transition);
    this.session.prohibitAuthentication(/*transition,*/ 'index');
  },
});

