import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import EntryBlocks from './entry-blocks';


export default EntryBlocks.extend({
  viewHistory : service('data/view'),

  dataFiltered : computed('data.[]', 'controlOptions.{historyView,historyBlocks}', function () {
    let
    o = this.controlOptions,
    recent = o.historyView === 'Recent',
    data = this.get('data');

    // similar : entry-level.js : 
    if (o.historyBlocks && (o.historyView !== 'Normal')) {
      data = data.filter((b) => this.get('viewHistory').blockViewed(b));
    }
    return data;
  }),


});
