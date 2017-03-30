import DS from 'ember-data';
import attr from 'ember-data/attr';
//import Fragment from 'model-fragments/fragment';

export default DS.Model.extend({
  name: attr('string'),
  position: attr('number'),
  aliases: attr()
});
