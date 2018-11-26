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
      let 
        activeFeatureList = this.get('activeFeatureList'),
      selectedFeatures = activeFeatureList.selectedFeatures,
      selectedFeatureNames = activeFeatureList.hasOwnProperty('selectedFeatures') ?
        selectedFeatures && selectedFeatures.mapBy('Feature')
        : activeFeatureList.featureNameList,
      blocksUnique = activeFeatureList.empty ? []
        : this.blocksUnique(selectedFeatureNames);

      this.set('blocksOfFeatures', blocksUnique);
    }
  }, // actions

  blocksUnique : function (selectedFeatureNames) {
      let me = this;
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
          blocks.forEach(function(b) { b.set('count', blockCounts[b.id]); });
          let blocksUnique = Array.from(blocks);
          console.log(blocksUnique);
          blocksUnique = blocksUnique.sortBy("count").reverse();
          console.log(blocksUnique);
          me.set('blocksOfFeatures', blocksUnique);
        });
  },

  /** didRender() is called in this component and in the child component
   * feature-list for each keypress in {{input value=featureNameList}} in the
   * child,  so identifying featureList is done in didInsertElement().
   */
  didInsertElement() {
    /** for trace */
    const fnName = 'didInsertElement';
    this._super(...arguments);

    /** possibly CF on childViews.@each */
    let children = this.get('childViews'),
    /** Currently the feature-list is the first of 2 child views
     * Can recognise the feature-list component via c.hasOwnProperty('featureNameList') or c.activeFeatureList or c.get('activeFeatureList');
     */
    lists = children.filter(function (c) { return c.activeFeatureList || c.get('activeFeatureList'); }),
    list = lists && lists.length && lists[0];
    console.assert(lists.length === 1, fnName + '() : list.length === 1');
    console.assert(list === children[0], fnName + '() : list === children[0]');
    this.set('featureList', list);
  },
  activeFeatureList : Ember.computed.alias('featureList.activeFeatureList'),

  loading : Ember.computed.alias('taskGet.isRunning'),

  refreshClassNames : Ember.computed('loading', function () {
    let classNames = "btn btn-info pull-right";
    return this.get('loading') ? classNames + ' disabled' : classNames;
  })

});
