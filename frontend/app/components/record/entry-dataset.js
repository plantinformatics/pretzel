import EntryBase from './entry-base';

export default EntryBase.extend({
  initSteps: function() {
    let layout = {
      'active': false
    }
    this.set('layout',layout);
  }.on('init'),
  data: Ember.computed('entry.blocks', 'filter', function() {
    return this.get('entry.blocks')
  }),
  dataEmpty: Ember.computed('data', function() {
    let availableBlocks = this.get('data')
    if (availableBlocks && availableBlocks.length > 0) { return false; }
    else { return true; }
  }),
  expandIcon: Ember.computed('layout.active', function() {
    let active = this.get('layout.active')
    return active? 'minus' : 'plus'
  }),
  actions: {
    selectBlock(block) {
      // console.log('SELECT BLOCK manage-explorer-dataset', block)
      this.sendAction('selectBlock', block);
    },
    deleteBlock(block) {
      this.sendAction('deleteBlock', block.id);
    },
    switchDataset(dataset) {
      // console.log('switchDataset')
      let active = this.get('layout.active')
      this.set('layout.active', !active)
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
      this.sendAction('selectDataset', dataset);
    }
  }
});
