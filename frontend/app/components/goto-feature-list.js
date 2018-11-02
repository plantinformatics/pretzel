import Ember from 'ember';

const { inject: { service } } = Ember;
import { task } from 'ember-concurrency';

export default Ember.Component.extend({
  blockService: service('data/block'),

  taskGet : Ember.computed.alias('blockService.getBlocksOfFeatures'),

  /*----------------------------------------------------------------------------*/
  actions : {
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    },

    getBlocksOfFeatures : function () {
      console.log("getBlocksOfFeatures", this);
      let me = this;
      let selectedFeatures = this.get('selectedFeatures'),
      selectedFeatureNames = selectedFeatures.mapBy('Feature');

      let blockService = this.get('blockService');
      function peekBlock(block) {
        return blockService.peekBlock(block.id); };
      let taskGet = this.get('taskGet'); // blockService.get('getBlocksOfFeatures');
      let blockTask = taskGet.perform(selectedFeatureNames)
        .then(function (features) {
          console.log("getBlocksOfFeatures", selectedFeatureNames[0], features);

          let blockIds = new Set(),
          blockCounts = {},
          blocks = features.features
            .filter(function (feature) {
              let blockId = feature.blockId,
              dup = blockIds.has(blockId);
              if (!(blockId in blockCounts))
                blockCounts[blockId] = 0;
              blockCounts[blockId] += 1;
              if (! dup) blockIds.add(blockId);
              return ! dup; })
            .mapBy('block')
            .map(peekBlock);
          blocks.forEach(function(b) { b.count = blockCounts[b.id] });
          let blocksUnique = Array.from(blocks);
          blocksUnique = blocksUnique.sortBy("count").reverse();
          console.log(blocksUnique);
          me.set('blocksOfFeatures', blocksUnique);
          console.log(blocksUnique);
        });
    }
  }, // actions


  loading : Ember.computed.alias('taskGet.isRunning'),

  refreshClassNames : Ember.computed('loading', function () {
    let classNames = "btn btn-info pull-right";
    return this.get('loading') ? classNames + ' disabled' : classNames;
  })

});
