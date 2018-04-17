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
    onDelete(id) {
      this.sendAction('onDelete', id)
    }
  }
});
