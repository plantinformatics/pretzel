import DS from 'ember-data';
import attr from 'ember-data/attr';

import Record from './record';

export default Record.extend({
  blockId: DS.belongsTo('block'),
  feature: attr('string')
});
