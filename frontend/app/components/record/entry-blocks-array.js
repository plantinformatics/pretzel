import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import { alphanum } from '@cablanchard/koelle-sort';

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
    /** if data is an Array Proxy, convert it to an Array to enable sort to work. */
    if (! (data instanceof Array)) {
     data = data.toArray();
    }
    /** As noted in entry-level.js : valuesFiltered() re. blocksFilterSortViewed(),
     * it may be preferred to sort blocks by view / recent / favourites.
     */
    /** Current crops have single-digit chromosome numbers, so this would suffice :
     *   .sortBy('name');
     * but for a natural sort of multi-digit numbers in chromosome
     * names, alphanum is used.
     */
    data = data
      .sort((a,b) => alphanum(a.get('name'), b.get('name')) );

    return data;
  }),


});
