import EntryBase from './entry-base';

export default EntryBase.extend({
  initSteps: function() {
    let layout = {
      'active': false
    }
    this.set('layout',layout);
  }.on('init'),
  data: Ember.computed('dataset.blocks', 'filter', function() {
    return this.get('dataset.blocks')

    // below handling is in the case of ownership
    // ACL handling at the block level, which may be
    // a future direction

    // console.log('dataset explorer computed')
    // let availableBlocks = this.get('dataset.blocks')
    // let filter = this.get('filter')
    // // perform filtering according to selectedChr
    // // let filtered = availableBlocks //all
    // if (filter == 'public') {
    //   return availableBlocks.filterBy('public', true)
    //   // return maps.filterBy('blocks', 'public', true)
    // } else if (filter == 'owner') {
    //   return availableBlocks.filterBy('owner', true)
    // } else {
    //   return this.get('dataset.blocks')
    // }
  }),
  dataEmpty: Ember.computed('data', function() {
    let availableBlocks = this.get('data')
    if (availableBlocks && availableBlocks.length > 0) { return false; }
    else { return true; }
  }),
  notEditing: Ember.computed('editing', function() {
    return !this.get('editing')
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
