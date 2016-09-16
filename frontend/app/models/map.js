import DS from 'ember-data';

export default DS.Model.extend({
  name: DS.attr('string'),
  start: DS.attr(),
  stop: DS.attr(),
  maporder: DS.attr('number'),
  mapset: DS.belongsTo('mapset')

});
