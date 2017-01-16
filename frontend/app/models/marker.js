import attr from 'ember-data/attr';
import Fragment from 'model-fragments/fragment';

export default Fragment.extend({
  _id: attr('string'),
  name: attr('string'),
  position: attr('number'),
});
