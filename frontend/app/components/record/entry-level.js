import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import EntryBase from './entry-base';


export default EntryBase.extend({
  viewHistory : service('data/view'),

  valuesFiltered : computed('values.[]', 'controlOptions.{historyView,historyBlocks}', function () {
    let
    values = this.get('values'),
    historyView = this.controlOptions.historyView,
    historyBlocks = this.controlOptions.historyBlocks;

    if ((this.levelMeta.get(values) === 'Blocks') && (historyView !== 'Normal') && this.controlOptions.historyBlocks ) {
      /* Could sort by this.viewHistory.blockViewed(b)[(historyView === 'Recent') ? 'timestamp' : 'counter'], i.e. use viewHistory.blocksFilterSortViewed()
       * The blocks (chromosomes) typically fit in a small grid (3 x 7 max for
       * wheat), so the default numeric sort is probably more ergonomic.
       * Similar : entry-values.js : keyValuesSorted().
       */
      values = values.filter((b) => this.get('viewHistory').blockViewed(b));
    }
    return values;
  }),

  actions: {
    selectDataset(dataset) {
      console.log('selectDataset', dataset);
      this.sendAction('selectDataset', dataset);
    },
    selectBlock(block) {
      console.log('selectBlock', block);
      this.sendAction('selectBlock', block);
    }
  }


});
