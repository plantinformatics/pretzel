import Ember from 'ember';
import UnauthenticatedRouteMixin from 'ember-simple-auth/mixins/unauthenticated-route-mixin';

const { Route } = Ember;

export default Route.extend(UnauthenticatedRouteMixin, {
  queryParams: {
    access_token: {
      refreshModel: false
    }
  },

  // model(params) {
  //   console.log('in model', params)

  //   let token = params.access_token
  //   // preliminary parsing to discard tokens of incorrect length
  //   if (token) {
  //     if (token.length != 64) params.access_token = ''
  //   }
  //   console.log('this.access_token', this.access_token)
  // }
});
