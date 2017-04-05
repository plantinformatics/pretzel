import DS from 'ember-data';
import attr from 'ember-data/attr';
import { PartialModel, partial } from 'ember-data-partial-model/utils/model';

export default PartialModel.extend({
  name: attr('string'),
  extended: partial('chromosome', 'extended', {
    markers: DS.hasMany('marker', { async: true })
  })
});
