import Ember from 'ember';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';

const { Route } = Ember;

export default Ember.Route.extend(AuthenticatedRouteMixin, {
  titleToken: 'Upload Data'
})
