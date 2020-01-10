import DS from 'ember-data';
import attr from 'ember-data/attr';

import Record from './record';

export default Record.extend({
  name: attr('string'),
  parent: DS.belongsTo('dataset', {inverse: 'children'}),
  children: DS.hasMany('dataset', {inverse: 'parent'}),
  blocks: DS.hasMany('block', { async: false }),
  type: attr('string'),
  namespace: attr('string'),
  tags: attr('array'),
  meta: attr()
});
