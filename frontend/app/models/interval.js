import attr from 'ember-data/attr';

import Record from './record';

export default Record.extend({
  blockId: DS.belongsTo('block'),
  features: attr('array'),
  positions: attr('array')
});
