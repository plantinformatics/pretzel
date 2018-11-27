import Ember from 'ember';

const { inject: { service } } = Ember;
import { task } from 'ember-concurrency';

/* global d3 */


export default Ember.Component.extend({
  blockService: service('data/block'),

  taskGet : Ember.computed.alias('blockService.getBlocksOfFeatures'),

  /*----------------------------------------------------------------------------*/
  actions : {
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    },
    updateFeaturesInBlocks(featuresInBlocks) {
      this.sendAction('updateFeaturesInBlocks', featuresInBlocks);
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
    },

    /** not used - the requirements shifted from setting the axis brushes from
     * the outer features to showing ticks for all found features.  */
    brushFeatures : function () {
      this.brushFeatures();
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

          n = d3.nest()
            .key(function(f) { return f.blockId; })
            .entries(features.features),
          n1=n.sort(function (a,b) { return b.values.length - a.values.length; }),
          // n1.map(function (d) { return d.key; }),
          blocksUnique = n1.map(function (d) { return d.values[0].block; })
            .map(peekBlock);

          me.set('blocksOfFeatures', blocksUnique);
          /** convert nest [{key, values}..] to hash [key] : values */
          let featuresInBlocks = n.reduce(
            function (result, value) { result[value.key] = value.values; return result; },
            {} );
          console.log('featuresInBlocks', featuresInBlocks);
          me.send('updateFeaturesInBlocks', featuresInBlocks);

        });
  },

  /** didRender() is called in this component and in the child component
   * feature-list for each keypress in {{input value=featureNameList}} in the
   * child,  so the call to lookupFeatureList(), identifying featureList,
   * is done in didInsertElement().
   */
  didInsertElement() {
    this._super(...arguments);
    this.lookupFeatureList();
  },

  /** Identify the feature-list child component.
   */
  lookupFeatureList() {
    /** for trace */
    const fnName = 'lookupFeatureList';

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
  }),

  brushFeatures() {
  }

});
