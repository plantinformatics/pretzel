import attr from 'ember-data/attr';
import DS from 'ember-data';

import Record from './record';

export default Record.extend({
  name: attr('string'),
  blockId: DS.belongsTo('block'),
  features: attr('array'),
  positions: attr('array')
});
