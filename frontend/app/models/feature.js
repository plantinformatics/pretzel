import { computed } from '@ember/object';
import DS from 'ember-data';
import attr from 'ember-data/attr';
//import Fragment from 'model-fragments/fragment';

export default DS.Model.extend({
  blockId: DS.belongsTo('block'),
  name: attr('string'),
  /* currently have a mix of .range and .value in pretzel-data [develop];
   * handle both for now;  chrData() also handles either.  */
  value: attr(),
  range: attr(),
  parentId: DS.belongsTo('feature', {inverse: 'features'}),
  features: DS.hasMany('feature', {inverse: 'parentId'}),

  /*--------------------------------------------------------------------------*/

  /** feature can have a direction, i.e. (value[0] > value[1])
   * For domain calculation, the ordered value is required.
   */
  valueOrdered : computed('value', function () {
    let value = this.get('value');
    if (value[0] > value[1]) {
      let value = [value[1], value[0]];
    }
    return value;
  })

  /*--------------------------------------------------------------------------*/

});
