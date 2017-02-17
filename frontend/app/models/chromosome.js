import DS from 'ember-data';
import attr from 'ember-data/attr';
//import Fragment from 'model-fragments/fragment';
//import fragmentArray from 'model-fragments/attributes';

export default DS.Model.extend({
  name: attr('string'),
  markers: DS.hasMany('marker', { async: false })
});
