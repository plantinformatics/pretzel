import Ember from 'ember';

const { computed : { readOnly } } = Ember;
const { inject: { service } } = Ember;

import ViewedBlocks from '../mixins/viewed-blocks';

/* global d3 */

console.log("controllers/mapview.js");

let trace_dataflow = 1;
let trace_select = 1;

export default Ember.Controller.extend(Ember.Evented, ViewedBlocks, {
  dataset: service('data/dataset'),
  block: service('data/block'),

  actions: {
    // layout configuration
    setVisibility: function(side) {
      // console.log("setVisibility", side);
      let visibility = this.get(`layout.${side}.visible`)
      this.set(`layout.${side}.visible`, !visibility);
    },
    setTab: function(side, tab) {
      // console.log("setTab", side, tab);
      this.set(`layout.${side}.tab`, tab);
    },
    updateSelectedFeatures: function(features) {
    	// console.log("updateselectedFeatures in mapview", features.length);
      this.set('selectedFeatures', features);
      this.send('setTab', 'right', 'selection');
    },
    /** goto-feature-list is given features by the user and finds them in
     * blocks; this is that result in a hash, indexed by block id, with value
     * being an array of features found in that block.
     */
    updateFeaturesInBlocks: function(featuresInBlocks) {
      // console.log("updateFeaturesInBlocks in mapview", featuresInBlocks);
      this.set('featuresInBlocks', featuresInBlocks);
    },

    /** Change the state of the named block to viewed.
     * If this block has a parent block, also add the parent.
     * @param mapName
     * (named map for consistency, but mapsToView really means block, and "name" is db ID)
     * Also @see components/record/entry-block.js : action get
     */
    addMap : function(mapName) {
      let block = this.get('blockFromId')(mapName),
      referenceBlock = block.get('referenceBlock');
      if (referenceBlock)
        referenceBlock.get('setViewed').apply(this, [referenceBlock.get('id'), true]);
      this.get('setViewed').apply(this, [mapName, true]);
    },

    updateRoute() {
      let block_viewedIds = this.get('block.viewedIds');
      console.log("controller/mapview", "updateRoute", this.target.currentURL, block_viewedIds);

      let queryParams =
        {'mapsToView' : block_viewedIds,
         highlightFeature : this.get('model.params.highlightFeature')
        };
      let me = this;
      Ember.run.later( function () {
        me.transitionToRoute({'queryParams': queryParams }); });
    },
    removeBlock: function(block) {
      let block_id = block.get('id');
      this.send('removeMap', block_id);
    },
    /** Change the state of the named block to not-viewed.
     */
    removeMap : function(mapName) {
      this.get('setViewed').apply(this, [mapName, false]);
    },

    onDelete : function (modelName, id) {
      console.log('onDelete', modelName, id);
      if (modelName == 'block')
        this.send('removeMap', id); // block
      else
        console.log('TODO : undisplay child blocks of', modelName, id);
    },
    toggleShowUnique: function() {
      console.log("controllers/mapview:toggleShowUnique()", this);
      this.set('isShowUnique', ! this.get('isShowUnique'));
    }
    , isShowUnique: false
    , togglePathColourScale: function() {
      console.log("controllers/mapview:togglePathColourScale()", this);
      this.set('pathColourScale', ! this.get('pathColourScale'));
    }
    , pathColourScale: true,

    /** also load parent block */
    loadBlock : function loadBlock(block) {
      console.log('loadBlock', block);
      let referenceBlock = block.get('referenceBlock');
      if (referenceBlock)
        loadBlock.apply(this, [referenceBlock]);

      /** in result of featureSearch(), used in goto-feature-list, .block has .id but not .get */
      let id = block.get ? block.get('id') : block.id;
      let t = this.get('useTask');
      t.apply(this, [id]);
    },
    blockFromId : function(blockId) {
      let store = this.get('store'),
      block = store.peekRecord('block', blockId);
      return block;
    },

    selectBlock: function(block) {
      console.log('SELECT BLOCK mapview', block.get('name'), block.get('mapName'), block.id, block);
      this.set('selectedBlock', block);
      d3.selectAll("ul#maps_aligned > li").classed("selected", false);
      d3.select('ul#maps_aligned > li[data-chr-id="' + block.id + '"]').classed("selected", true);

      function dataIs(id) { return function (d) { return d == id; }; }; 
      d3.selectAll("g.axis-outer").classed("selected", dataIs(block.id));
      if (trace_select)
      d3.selectAll("g.axis-outer").each(function(d, i, g) { console.log(this); });
      // this.send('setTab', 'right', 'block');
    },
    selectBlockById: function(blockId) {
      let store = this.get('store'),
      selectedBlock = store.peekRecord('block', blockId);
      /* Previous version traversed all blocks of selectedMaps to find one
       * matching blockId. */
      this.send('selectBlock', selectedBlock)
    },
    selectDataset: function(ds) {
      this.set('selectedDataset', ds);
      this.send('setTab', 'right', 'dataset');
    },
    /** Get all available maps.
     */
    updateModel: function() {
      let model = this.get('model');
      console.log("controller/mapview: model()", model, 'get datasets');
      // see related : routes/mapview.js:model()
      let datasetsTaskPerformance = model.get('availableMapsTask'),
      newTaskInstance = datasetsTaskPerformance.task.perform();
      console.log(datasetsTaskPerformance, newTaskInstance);
      model.set('availableMapsTask', newTaskInstance);
    }
  },

  layout: {
    'left': {
      'visible': true,
      'tab': 'view'
    },
    'right': {
      'visible': true,
      'tab': 'selection'
    }
  },

  controls : Ember.Object.create({ view : {  } }),

  queryParams: ['mapsToView'],
  mapsToView: [],

  selectedFeatures: [],


  scaffolds: undefined,
  scaffoldFeatures: undefined,
  showScaffoldFeatures : false,
  showAsymmetricAliases : false,

  init: function() {
    /** refn : https://discuss.emberjs.com/t/is-this-possible-to-turn-off-some-deprecations-warnings/8196 */
    let deprecationIds = ['ember-simple-auth.session.authorize'];
    Ember.Debug.registerDeprecationHandler((message, options, next) => {
      if (! deprecationIds.includes(options.id)) {
        next(message, options);
      }
    });

    this._super.apply(this, arguments);
  },

  currentURLDidChange: function () {
    console.log('currentURLDidChange', this.get('target.currentURL'));
  }.observes('target.currentURL'),


  blockTasks : readOnly('model.viewedBlocks.blockTasks'),
  /** all available */
  blockValues : readOnly('block.blockValues'),
  /** currently viewed */
  blockIds : readOnly('model.viewedBlocks.blockIds'),


  /** Used by the template to indicate when & whether any data is loaded for the graph.
   */
  hasData: Ember.computed(
    function() {
      let viewedBlocks = this.get('block.viewed');
      if (trace_dataflow)
        console.log("hasData", ! viewedBlocks || viewedBlocks.length);
      return (viewedBlocks && viewedBlocks.length > 0);
    }),

  /** Update queryParams and URL.
   */
  queryParamsValue : Ember.computed(
    'block.viewedIds', 'block.viewedIds.[]', 'block.viewedIds.length',
    function() {
      console.log('queryParamsValue');
      this.send('updateRoute');
    }),

  /** Use the task taskGet() defined in services/data/block.js
   * to get the block data.
   */
  useTask : function (id) {
    console.log("useTask", id);
    let blockService = this.get('block');

    let getBlocks = blockService.get('getBlocksSummary');
    let blocksSummaryTasks = getBlocks.apply(blockService, [[id]]);

    let taskGet = blockService.get('taskGet');
    let block = taskGet.perform(id);
    console.log("block", id, block);
    // block.set('isViewed', true);
  }


});
