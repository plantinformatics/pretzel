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
  features: DS.hasMany('feature', {inverse: 'parentId'})
});
