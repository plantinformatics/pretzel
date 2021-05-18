import { computed } from '@ember/object';
import Model, { attr, belongsTo, hasMany } from '@ember-data/model';
//import Fragment from 'model-fragments/fragment';

export default Model.extend({
  blockId: belongsTo('block'),
  _name: attr('string'),
  /* currently have a mix of .range and .value in pretzel-data [develop];
   * handle both for now;  chrData() also handles either.  */
  value: attr(),
  range: attr(),
  values: attr(),
  parentId: belongsTo('feature', {inverse: 'features'}),
  features: hasMany('feature', {inverse: 'parentId'}),

  /*--------------------------------------------------------------------------*/

  name : computed('_name', 'isAnon', function () {
    let name = this.get('_name') ||
        (this.get('isAnon') && (this.get('blockId.name') + ':' + this.get('value.0')));
    return name;
  }),

  isAnon : computed('blockId.datasetId.tags', function () {
    let block = this.get('blockId.content') || this.get('blockId'),
        anon = block.hasTag('AnonFeatures');
    return anon;
  }),

  /*--------------------------------------------------------------------------*/

  /** @return a positive interval equal in range to .value[]
   * @desc
   * feature can have a direction, i.e. (value[0] > value[1])
   * For domain calculation, the ordered value is required.
   */
  valueOrdered : computed('value', function () {
    let value = this.get('value');
    if (value[0] > value[1]) {
      value = [value[1], value[0]];
    }
    return value;
  })

  /*--------------------------------------------------------------------------*/

});
