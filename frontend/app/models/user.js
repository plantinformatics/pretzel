import DS from 'ember-data';

export default DS.Model.extend({
  firstName: DS.attr('string'),
  lastName: DS.attr('string'),
  email: DS.attr('string'),
  apiKey: DS.attr('string'),
  age: DS.attr('number'),
  subscribed: DS.attr('boolean'),
  verified: DS.attr('boolean'),
  createdAt: DS.attr('date'),
  updatedAt: DS.attr('date')
});
