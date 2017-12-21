import attr from 'ember-data/attr';

import Record from './record';

export default Record.extend({
  blockId: attr('string'),
  starting: attr('string'),
  ending: attr('string')
});
