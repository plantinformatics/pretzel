import attr from 'ember-data/attr';
import Fragment from 'model-fragments/fragment';
import { fragmentArray } from 'model-fragments/attributes';

export default Fragment.extend({
  _id: attr('string'),
  name: attr('string'),
  markers: fragmentArray('marker'),
});
