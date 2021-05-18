import { attr, belongsTo } from '@ember-data/model';

import Record from './record';

export default Record.extend({
  name: attr('string'),
  blockId: belongsTo('block'),
  features: attr('array'),
  positions: attr('array')
});
