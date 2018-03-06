import Ember from 'ember';
import DS from 'ember-data';
import Model from 'ember-data/model';
import attr from 'ember-data/attr';
import { readOnly } from '@ember/object/computed';

const { inject: { service } } = Ember;

export default DS.Model.extend({
  session: service('session'),
  name: attr('string'),
  clientId: attr('string'),
  public: attr('boolean'),
  readOnly: attr('boolean'),
  createdAt: attr("date"),
  updatedAt: attr("date"),
  owner: Ember.computed('clientId', function() {
    let clientIdSession = this.get('session.data.authenticated.clientId')
    let clientId = this.get('clientId')
    if (!clientId) {
      return false;
    }
    return clientIdSession == clientId;
  }),
  editable: Ember.computed('owner', 'readOnly', function() {
    return this.get('owner') || !this.get('readOnly')
  })
});
