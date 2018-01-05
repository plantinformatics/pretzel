import ManageBase from './manage-base'

export default ManageBase.extend({
  filterOptions: {
    'all': {'formal': 'All', 'icon': 'plus'},
    'block': {'formal': 'Block', 'icon': 'globe'},
    'intersect': {'formal': 'Intersect', 'icon': 'random'}
  },
  filter: 'all',
  data: Ember.computed('selectedBlock', 'selectedFeatures', 'filter', function() {
    let selectedBlock = this.get('selectedBlock')
    let selectedFeatures = this.get('selectedFeatures')
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    let filtered = selectedFeatures //all
    if (filter == 'block' && selectedBlock) {
      filtered = selectedFeatures.filter(function(feature) {
        return feature.Block === selectedBlock.id
      })
    } else if (filter == 'intersect') {
      //split by block
      let blocks = {}
      
      selectedFeatures.forEach(function(feature) {
        if (!blocks[feature.Block]) {
          blocks[feature.Block] = {}
        }
        let block = blocks[feature.Block]
        block[feature.Feature] = true
      })
      filtered = selectedFeatures.filter(function(feature) {
        var include = true
        Object.keys(blocks).forEach(function(blockId) {
          if (!blocks[blockId][feature.Feature]) {
            include = false
          }
        })
        return include
      })
    }
    return filtered
  }),
  actions: {
    changeFilter: function(f) {
      this.set('filter', f)
    }
  }
});
