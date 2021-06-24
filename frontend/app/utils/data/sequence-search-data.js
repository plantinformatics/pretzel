const dLog = console.debug;

import EmberObject, { computed } from '@ember/object';

/** Allocate a unique id to each search / blast-result tab, for navigation.
 */
let searchId = 0;

/** Data which backs each search instance initiated by sequence-search.
 * @param promise, seq, parent, searchType
 */
export default EmberObject.extend({

  init() {
    this._super(...arguments);

    /** an alternative is to use concat helper as in
     * components/panel/api-server-tab.hbs, but this seems simpler,
     * and avoids repeated calculation of a constant value.
     */
    let
    id = searchId++,
    tabId = 'sequence-search-output-' + id;
    this.set('tabId', tabId);
    this.set('tabHref', '#' + tabId);
    /** It would reduce the DOM size to have a single table, shared
     * between all searches, but this is simpler, and retains scroll
     * position, selection, sorting, etc for each table, which users
     * would expect.
     */
    this.set('tableId', "blast-results-hotable-" + id);

    let startTime = new Date();
    // maybe : this.set('startTime', startTime);
    this.set('timeId', startTime.toTimeString().split(' ')[0]);
  },

  


});
