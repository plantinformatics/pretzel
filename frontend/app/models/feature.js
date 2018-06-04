import DS from 'ember-data';
import attr from 'ember-data/attr';
//import Fragment from 'model-fragments/fragment';

export default DS.Model.extend({
  blockId: DS.belongsTo('block'),
  name: attr('string'),
  value: attr(),
  parentId: DS.belongsTo('feature', {inverse: 'features'}),
  features: DS.hasMany('feature', {inverse: 'parentId'})
});
