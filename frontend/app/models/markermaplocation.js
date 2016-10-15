import DS from 'ember-data';

export default DS.Model.extend({
  linkageGroupA: DS.attr('string'),
  linkageGroupB: DS.attr('string'),
  chromosome: DS.attr('string'),
  location: DS.attr('number'),
  leftpos: DS.attr('string'),
  rightpos: DS.attr('string'),
  marker: DS.attr('string'),
  map: DS.belongsTo('map')

});
