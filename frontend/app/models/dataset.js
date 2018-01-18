import DS from 'ember-data';
import attr from 'ember-data/attr';

import Record from './record';

export default Record.extend({
  blocks: DS.hasMany('block', { async: false })
});
