import Ember from 'ember';
import DS from 'ember-data';

const { computed : { readOnly } } = Ember;
const { inject: { service } } = Ember;

/* global d3 */

const dLog = console.debug;

dLog("controllers/mapview.js");

let trace_dataflow = 0;
let trace_select = 0;

export default Ember.Controller.extend(Ember.Evented, {
  dataset: service('data/dataset'),
  block: service('data/block'),
  apiServers: service(),
  controlsService : service('controls'),
	/** used for axisBrush.brushedAxes to instantiate axis-brush s. */
  flowsService: service('data/flows-collate'),


  /** Array of available datasets populated from model 
   */
  datasets: Ember.computed('model', 'model.availableMapsTask', 'model.availableMapsTask.value', function () {
    let task = this.get('model.availableMapsTask');
    let promise = task.then(function (value) { dLog('datasets from task', value); return value; });
    let resultP = DS.PromiseArray.create({ promise: promise });
    dLog(task, promise, 'resultP', resultP);
    return resultP;
  }),

  actions: {
    // layout configuration
    setVisibility: function(side) {
      // dLog("setVisibility", side);
      let visibility = this.get(`layout.${side}.visible`)
      this.set(`layout.${side}.visible`, !visibility);
    },
    setTab: function(side, tab) {
      dLog("setTab", side, tab, this.get('layout'));
      this.set(`layout.${side}.tab`, tab);
    },
    updateSelectedFeatures: function(features) {
    	// dLog("updateselectedFeatures in mapview", features.length);
      this.set('selectedFeatures', features);
      /** results of a selection impact on the selection (selectedFeatures) tab
       * and the paths tab, so if neither of these is currently shown, show the
       * selection tab.
       */
      let rightTab = this.get('layout.right.tab');
      /* this feature made sense when (selected) features table was new, but now
       * there is also paths table so it is not clear which tab to switch to,
       * and now the the table sizes (ie. counts of brushed features / paths)
       * are shown in their respective tabs, which serves to draw attention to
       * the newly available information, so this setTab() is not required.
       */
      if (false)
      if ((rightTab !== 'selection') && (rightTab !== 'paths'))
        this.send('setTab', 'right', 'selection');
    },
    /** goto-feature-list is given features by the user and finds them in
     * blocks; this is that result in a hash, indexed by block id, with value
     * being an array of features found in that block.
     */
    updateFeaturesInBlocks: function(featuresInBlocks) {
      // dLog("updateFeaturesInBlocks in mapview", featuresInBlocks);
      this.set('featuresInBlocks', featuresInBlocks);
    },
    /** from paths-table */
    updatePathsCount: function(pathsCount) {
      dLog("updatePathsCount in mapview", pathsCount);
      this.set('pathsTableSummary.count', pathsCount);
    },


    /** Change the state of the named block to viewed.
     * If this block has a parent block, also add the parent.
     * @param mapName
     * (named map for consistency, but mapsToView really means block, and "name" is db ID)
     * Also @see components/record/entry-block.js : action get
     */
    addMap : function(mapName) {
      let block = this.get('blockFromId')(mapName),
      blockId = mapName,
      setViewed = this.get('block.setViewed'),
      referenceBlock = block.get('referenceBlock');
      if (referenceBlock)
      {
        console.log('addMap referenceBlock', referenceBlock.get('id'));
        setViewed(referenceBlock.get('id'), true);
      }
      setViewed(blockId, true);
    },

    updateRoute() {
      let block_viewedIds = this.get('block.viewedIds');
      dLog("controller/mapview", "updateRoute", this.target.currentURL, block_viewedIds);

      let queryParams = this.get('model.params');
      let me = this;
      Ember.run.later( function () {
        me.transitionToRoute({'queryParams': queryParams }); });
    },
    /** Un-view a block.
     * @param block store object; this is only on difference from action removeMap(),
     * which takes a blockId
     */
    removeBlock: function(block) {
      if (typeof block === "string")
        this.send('removeMap', block);
      else {
        block.unViewChildBlocks();
        block.set('isViewed', false);
      }
    },
    /** Change the state of the named block to not-viewed.
     * Equivalent to action removeBlock(), which takes a block record instead of a blockId.
     * @param mapName blockId
     */
    removeMap : function(mapName) {
      let blockId = mapName;
      let block = this.blockFromId(blockId);
      block.unViewChildBlocks();

      this.get('block').setViewed(mapName, false);
    },

    onDelete : function (modelName, id) {
      dLog('onDelete', modelName, id);
      if (modelName == 'block')
        this.send('removeMap', id); // block
      else
        dLog('TODO : undisplay child blocks of', modelName, id);
    },
    toggleShowUnique: function() {
      dLog("controllers/mapview:toggleShowUnique()", this);
      this.set('isShowUnique', ! this.get('isShowUnique'));
    }
    , isShowUnique: false
    , togglePathColourScale: function() {
      dLog("controllers/mapview:togglePathColourScale()", this);
      this.set('pathColourScale', ! this.get('pathColourScale'));
    }
    , pathColourScale: true,

    /** also load parent block */
    loadBlock : function loadBlock(block) {
      dLog('loadBlock', block);
      // previously done in useTask() : (mixins/viewed-blocks)setViewed() : (data/block.js)setViewedTask()
      block.set('isViewed', true);
      let referenceBlock = block.get('referenceBlock');
      if (referenceBlock)
        loadBlock.apply(this, [referenceBlock]);

      /* Before progressive loading this would load the data (features) of the block.
       * Now it just loads summary information : featuresCount (block total) and
       * also featuresCounts (binned counts).
       * The block record itself is already loaded in the initial Datasets request;
       * - it is the parameter `block`.
       */
      if (true) {
        /** in result of featureSearch(), used in goto-feature-list, .block has .id but not .get */
        let id = block.get ? block.get('id') : block.id;
        let t = this.get('useTask');
        t.apply(this, [id]);
      }
    },
    blockFromId : function(blockId) {
      let
        id2Server = this.get('apiServers.id2Server'),
      server = id2Server[blockId],
      store = server.store,
      block = store.peekRecord('block', blockId);
      return block;
    },

    selectBlock: function(block) {
      dLog('SELECT BLOCK mapview', block.get('name'), block.get('mapName'), block.id, block);
      this.set('selectedBlock', block);
      d3.selectAll("ul#maps_aligned > li").classed("selected", false);
      d3.select('ul#maps_aligned > li[data-chr-id="' + block.id + '"]').classed("selected", true);

      function dataIs(id) { return function (d) { return d == id; }; }; 
      d3.selectAll("g.axis-outer").classed("selected", dataIs(block.id));
      if (trace_select)
      d3.selectAll("g.axis-outer").each(function(d, i, g) { dLog(this); });
      // this.send('setTab', 'right', 'block');
    },
    selectBlockById: function(blockId) {
      let
        id2Server = this.get('apiServers.id2Server'),
      server = id2Server[blockId],
      store = server.store,
      selectedBlock = store.peekRecord('block', blockId);
      /* Previous version traversed all blocks of selectedMaps to find one
       * matching blockId. */
      this.send('selectBlock', selectedBlock)
    },
    selectDataset: function(ds) {
      this.set('selectedDataset', ds);
      this.send('setTab', 'right', 'dataset');
    },
    /** Re-perform task to get all available maps.
     */
    updateModel: function() {
      let model = this.get('model');
      dLog('controller/mapview: updateModel()', model);

      let serverTabSelectedName = this.get('controlsService.serverTabSelected'),
      serverTabSelected = serverTabSelectedName && this.get('apiServers').lookupServerName(serverTabSelectedName);
      if (serverTabSelected)
      {
        let datasetsTask = serverTabSelected.getDatasets();
      }
      else
      {
      let datasetsTaskPerformance = model.get('availableMapsTask'),
      newTaskInstance = datasetsTaskPerformance.task.perform();
      dLog('controller/mapview: updateModel()', newTaskInstance);
      model.set('availableMapsTask', newTaskInstance);

      /** If this is called as refreshDatasets from data-csv then we want to get
       * blockFeatureLimits for the added block.
       */
      newTaskInstance.then((datasets) => {
        this.get('block').ensureFeatureLimits();
      });
      }
    }
  },

  layout: Ember.Object.create({
    'left': {
      'visible': true,
      'tab': 'view'
    },
    'right': {
      'visible': true,
      'tab': 'selection'
    }
  }),

  controls : Ember.Object.create({ view : {  } }),

  queryParams: ['mapsToView'],
  mapsToView: [],

  selectedFeatures: [],
  /** counts of selected paths, from paths-table; shown in tab. */
  pathsTableSummary : {},


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
    dLog('currentURLDidChange', this.get('target.currentURL'));
  }.observes('target.currentURL'),


  /** all available */
  blockValues : readOnly('block.blockValues'),

  /** same as services/data/block @see peekBlock()
   */
  blockFromId : function(blockId) {
    let 
      store = this.get('apiServers').id2Store(blockId),
    block = store && store.peekRecord('block', blockId);
    return block;
  },


  /** Used by the template to indicate when & whether any data is loaded for the graph.
   */
  hasData: Ember.computed(
    function() {
      let viewedBlocksLength = this.get('block.viewed.length');
      if (trace_dataflow)
        dLog("hasData", viewedBlocksLength);
      return viewedBlocksLength > 0;
    }),

  /** Update queryParams and URL.
   */
  queryParamsValue : Ember.computed(
    'model.params.mapsToView.[]',
    function() {
      dLog('queryParamsValue');
      this.send('updateRoute');
    }),

  /** Use the task taskGet() defined in services/data/block.js
   * to get the block data.
   */
  useTask : function (id) {
    dLog("useTask", id);
    let blockService = this.get('block');

    let getBlocks = blockService.get('getBlocksSummary');
    let blocksSummaryTasks = getBlocks.apply(blockService, [[id]]);
    /* get featureLimits if not already received.
     * Also adding a similar request to updateModal (refreshDatasets) so by this
     * time that result should have been received.
     */
    let block = this.blockFromId(id);
    if (block)
      block.ensureFeatureLimits();
    else
      this.get('block').ensureFeatureLimits(id);

    /** Before progressive loading this would load the data (features) of the block. */
    const progressiveLoading = true;
    if (! progressiveLoading) {
      let taskGet = blockService.get('taskGet');
      let block = taskGet.perform(id);
      dLog("block", id, block);
      // block.set('isViewed', true);
    }
  },

  /** Provide a class for the div which wraps the right panel.
   *
   * The class indicates which of the tabs in the right panel is currently
   * selected/displayed.  paths-table css uses this to display:none the
   * components div;   the remainder of the template is disabled via {{#if
   * (compare layout.right.tab '===' 'paths')}} which wraps the whole component.
   */
  rightPanelClass : Ember.computed('layout.right.tab', function () {
    let tab = this.get('layout.right.tab');
    dLog('rightPanelClass', tab);
    return 'right-panel-' + tab;
  }),

});
