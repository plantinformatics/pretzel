import DS from 'ember-data';
import Fragment from 'model-fragments/fragment';

export default Fragment.extend({
  name: DS.attr('string'),
  position: DS.attr('number'),

});
