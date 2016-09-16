import DS from 'ember-data';

export default DS.Model.extend({
  name: DS.attr('string'),
  cM: DS.attr('number'),
  map: hasMany('map')

});
