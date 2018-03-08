import attr from 'ember-data/attr';

import Record from './record';

export default Record.extend({
  name: attr('string'),
  blockId: DS.belongsTo('block'),
  features: attr('array'),
  positions: attr('array')
});
