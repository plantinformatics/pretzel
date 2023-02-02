import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import ManageBase from './manage-base'


export default ManageBase.extend({
  block: service('data/block'),

  classNames : ['h-100'],

  filterOptions: {
    'all': {'formal': 'All', 'icon': 'plus'},
    'block': {'formal': 'Block', 'icon': 'globe'},
    'intersect': {'formal': 'Intersect', 'icon': 'random'}
  },
  filter: 'all',

  /** From the .Chromosome field of selectedFeatures, lookup the block.
   */
  blockIdFromName(datasetIdAndScope) {
    let blocksByReferenceAndScope = this.get('block.blocksByReferenceAndScope'),
    [datasetId, scope]=datasetIdAndScope.split(':'),
    /** In a GM there can be multiple blocks with the same scope - at this point
     * there is no way to distinguish them.  This will be resolved when
     * selectedFeatures is be converted to a Set of features, from which .block
     * can be accessed.
     */
    block = blocksByReferenceAndScope.get(datasetId).get(scope)[0];
    return block && block.get('id');
  },

  data: computed('selectedBlock', 'selectedFeatures', 'filter', function() {
    let selectedBlock = this.get('selectedBlock')
    let selectedFeatures = this.get('selectedFeatures')
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    let filtered = selectedFeatures //all
    if (filter == 'block' && selectedBlock) {
      filtered = selectedFeatures.filter((feature) => {
        /** was : feature.Block, which is not defined, so lookup from .Chromosome */
        let featureBlock = this.blockIdFromName(feature.Chromosome);
        return featureBlock === selectedBlock.id;
      });
    } else if (filter == 'intersect') {
      //split by block
      let blocks = {}
      
      selectedFeatures.forEach((feature) => {
        /** was : feature.Block */
        let featureBlock = this.blockIdFromName(feature.Chromosome);
        if (!blocks[featureBlock]) {
          blocks[featureBlock] = {};
        }
        let block = blocks[featureBlock];
        // block[] could be a WeakSet.
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
    if (filtered) {
      filtered = this.showRefAlt(filtered);
    }
    return filtered
  }),
  /** if .Feature is just "chr"* and .feature.blockId.isSNP and it has
   * .values{ref,alt} then show ref/alt in place of .Feature.
   */
  showRefAlt(filtered) {
    filtered = filtered.map((f) => {
      let {Feature, ...rest} = f;
      if (Feature.startsWith('chr')) {
        let feature = rest.feature;
        // copied from axis-tracks.js : tracksTree, maybe factor depending on format changes
        let values = feature.get('blockId.isSNP') && feature.get('values');
        if (values && (values.ref || values.alt)) {
          let refAlt = (values.ref || '') + '/' + (values.alt || '');
          Feature = refAlt;
        }
      }
      rest.Feature = Feature;
      return rest;
    });
    return filtered;
  },
  actions: {
    changeFilter: function(f) {
      this.set('filter', f)
    }
  }
});
