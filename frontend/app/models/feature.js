import DS from 'ember-data';
import attr from 'ember-data/attr';
//import Fragment from 'model-fragments/fragment';

export default DS.Model.extend({
  blockId: DS.belongsTo('block'),
  parentId: DS.belongsTo('feature'),
  name: attr('string'),
  range: attr('array'),
  type: attr('string'),
  aliases: attr('array'),
  features: DS.hasMany('feature')
});
