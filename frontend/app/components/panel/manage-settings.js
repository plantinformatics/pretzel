import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  classNames: ['tabbed-table-container', 'bordered', 'control-panel'],
  filter: 'all',
  data: computed('selectedBlock', 'selectedFeatures', 'filter', function() {
    let selectedBlock = this.get('selectedBlock')
    let selectedFeatures = this.get('selectedFeatures')
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    let filtered = selectedFeatures //all
    if (filter == 'chrom' && selectedBlock) {
      filtered = selectedFeatures.filter(function(feature) {
        return feature.Block === selectedBlock.id
      })
    } else if (filter == 'union') {
      //split by chrom
      let blocks = {}
      selectedFeatures.forEach(function(feature) {
        if (!blocks[feature.Block]) {
          blocks[feature.Block] = {}
        }
        let chrom = blocks[feature.Block]
        chrom[feature.Feature] = true
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
