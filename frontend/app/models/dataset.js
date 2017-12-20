import Ember from 'ember';
import DS from 'ember-data';
import Model from 'ember-data/model';
import attr from 'ember-data/attr';
// const { attr } = DS;

const { inject: { service } } = Ember;

export default DS.Model.extend({
  session: service('session'),
  name: attr('string'),
  chromosomes: DS.hasMany('chromosome', { async: false }),
  clientId: attr('string'),
  public: attr('boolean'),
  owner: Ember.computed('clientId', function() {
    let clientIdSession = this.get('session.data.authenticated.clientId')
    let clientId = this.get('clientId')
    return clientIdSession == clientId;
  }),
});
