import { on } from '@ember/object/evented';
import { computed } from '@ember/object';
import EntryBase from './entry-base';

/* note also : naturalSort() from javascript-natural-sort/ which is a dependency of ember-jsoneditor / jsoneditor */
import { alphanum } from '@cablanchard/koelle-sort';

export default EntryBase.extend({
  initSteps: on('init', function() {
    let layout = {
      'active': false
    }
    this.set('entryLayout',layout);
  }),
  data: computed('entry.blocks', 'controlOptions.{historyView,historyBlocks}', function() {
    /*  this.filter is provided by filterOptions, available until d33fb802 */
    let
    dataset = this.get('entry'),
    historyView = this.controlOptions.historyView,
    data = (historyView === 'Normal') || ! this.controlOptions.historyBlocks ? this.get('entry.blocks') :
      (historyView === 'Recent') ? dataset.blocksRecent : dataset.blocksFavourite;
    data = data
      .filter((block) => !block.get('isCopy'))
      .sort((a,b) => alphanum(a.get('name'), b.get('name')) );
    return data;
  }),
  dataEmpty: computed('data', function() {
    let availableBlocks = this.get('data')
    if (availableBlocks && availableBlocks.length > 0) { return false; }
    else { return true; }
  }),
  expandIcon: computed('entryLayout.active', function() {
    let active = this.get('entryLayout.active')
    return active? 'minus' : 'plus'
  }),
  actions: {
    deleteBlock(block) {
      this.sendAction('deleteBlock', block.id);
    },
    switchDataset(dataset) {
      // console.log('switchDataset')
      let active = this.get('entryLayout.active')
      this.set('entryLayout.active', !active)
    },
    /** Dataset receives onDelete block, which it forwards up to manage-explorer
     * and thence mapview which translates it to removeMap, and dataset also, as
     * entry-base, sends onDelete dataset to manage-explorer ...
     */
     onDelete(modelName, id) {
      console.log('entry-dataset', 'onDelete', modelName, id);
      this.sendAction('onDelete', modelName, id);
    },
    selectDataset(dataset) {
      this.selectDataset(dataset);
    }
  }
});
