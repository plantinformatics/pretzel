import { registerDeprecationHandler } from '@ember/debug';
import { later } from '@ember/runloop';
import EmberObject, { computed, observer } from '@ember/object';
import Evented, { on } from '@ember/object/evented';
import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { readOnly, alias, reads, or } from '@ember/object/computed';
import { A as Ember_A } from '@ember/array';
import DS from 'ember-data';

import QueryParams from 'ember-parachute';

//------------------------------------------------------------------------------

/* global d3 */

//------------------------------------------------------------------------------

import { stacks } from '../utils/stacks';
import { axisFeatureCircles_selectOne, axisFeatureCircles_selectUnviewed } from '../utils/draw/axis';
import { thenOrNow } from '../utils/common/promises';
import { dLog } from '../utils/common/log';


/*----------------------------------------------------------------------------*/


dLog("controllers/mapview.js");

let trace_dataflow = 0;
let trace_select = 0;

//------------------------------------------------------------------------------

export const componentQueryParams = new QueryParams({
  naturalAuto: {
    defaultValue: false,
    refresh: false
  },
  searchFeatureNames: {
    defaultValue: '',
    refresh: false
  },
});


//------------------------------------------------------------------------------



export default Controller.extend(Evented, componentQueryParams.Mixin, {
  dataset: service('data/dataset'),
  block: service('data/block'),
  view : service('data/view'),
  selectedService : service('data/selected'),
  apiServers: service(),
  controlsService : service('controls'),
  queryParamsService : service('query-params'),

  //----------------------------------------------------------------------------
  // based on ember-parachute/README.md

  // queryParamsChanged: reads('queryParamsState.searchFeatureNames'),
  // or('queryParamsState.{page,search,tags}.changed'),

  setup({ queryParams }) {
    this.fetchData(queryParams);
  },

  queryParamsDidChange({ shouldRefresh, queryParams }) {
    // if any query param with `refresh: true` is changed, `shouldRefresh` is `true`
    if (shouldRefresh) {
      this.fetchData(queryParams);
    }
  },

  reset({ queryParams }, isExiting) {
    if (isExiting) {
      this.resetQueryParams();
    }
  },

  /** Use the values of queryParams
   */
  fetchData(queryParams) {
    // fetch data
  },

  actions: {
    resetAll() {
      // reset all query params to their default values specified in the query param map
      this.resetQueryParams();
    }
  },

  //----------------------------------------------------------------------------

  /** Array of available datasets populated from model 
   */
  datasets: computed('model', 'model.availableMapsTask', 'model.availableMapsTask.value', function () {
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
      const fieldName = `layout.${side}.tab`;
      if (this.get(fieldName) !== tab) {
        dLog("setTab", side, tab, this.get('layout'));
        this.set(fieldName, tab);
      }
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
     * This is replaced by loadBlock().
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
      later( function () {
        me.transitionToRoute({'queryParams': queryParams }); });
    },
    /** Un-view a block.
     * @param block store object; this is the only difference from action removeMap(),
     * which takes a blockId
     */
    removeBlock: function(block) {
      if (typeof block === "string")
        this.send('removeMap', block);
      else {
        block.unViewChildBlocks();
        block.set('isViewed', false);
        this.removeUnviewedBlockFeaturesFromSelected();
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
      later(() => this.removeUnviewedBlockFeaturesFromSelected(), 500);
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
      dLog('loadBlock', block.brushName || block);
      let related = this.get('view').viewRelatedBlocks(block);
      // load related[] before block.
      related.push(block);
      // or send('getSummaryAndData', block);
      related.forEach((block) => this.actions.getSummaryAndData.apply(this, [block]));
    },
    getSummaryAndData(block) {
      /* Before progressive loading this would load the data (features) of the block.
       * Now it just loads summary information : featureCount (block total) and
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
      /** For QTL / valueComputed, load all features of the QTL block,
       * and the reference block which enables calculation of the QTL
       * feature.value location
       */
      if (block.get) {
        later(() => block.get('loadRequiredData'));
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

    /** If block is not selected, select it.
     */
    selectBlock: function(block) {
      if (this.get('selectedBlock') !== block) {
        dLog('SELECT BLOCK mapview', block.get('name'), block.get('mapName'), block.id, block);
        this.set('selectedBlock', block);
        d3.selectAll("ul#maps_aligned > li").classed("selected", false);
        d3.select('ul#maps_aligned > li[data-chr-id="' + block.id + '"]').classed("selected", true);

        function dataIs(id) { return function (d) { return d == id; }; }; 
        d3.selectAll("g.axis-outer").classed("selected", dataIs(block.id));
        if (trace_select) {
          d3.selectAll("g.axis-outer").each(function(d, i, g) { dLog(this); });
        }
        // this.send('setTab', 'right', 'block');

        let queryParams = this.get('model.params');
        /* if the block tab in right panel is not displayed then select the block's dataset. */
        if (! (queryParams.options && queryParams.parsedOptions.blockTab)) {
          this.send('selectDataset', block.datasetId);
        }
      }
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
    /**
     * @param ds may be a promise (yielding a Dataset object)
     */
    selectDataset: function(ds) {
      thenOrNow(ds, (dataset) => this.actions.selectDatasetValue.apply(this, [dataset]));
    },
    /**
     * @param ds is a Dataset object, not a promise
     */
    selectDatasetValue: function(ds) {
      /** Switching to the dataset tab in right panel is useful if there is a
       * change of selected dataset, but when adjusting the axis brush, it is
       * un-ergonomic to constantly switch to the dataset tab, closing the
       * features or paths table and losing the users' column width adjustments
       * etc.  This condition excepts that case.
       */
      let changed = this.get('selectedDataset.id') !== ds.get('id');
      this.set('selectedDataset', ds);
      if (changed) {
        this.send('setTab', 'right', 'dataset');
      }
    },
    /** Re-perform task to get all available maps.
     */
    updateModel: function() {
      let model = this.get('model');
      dLog('controller/mapview: updateModel()', model);

      let serverTabSelectedName = this.get('controlsService.serverTabSelected'),
      serverTabSelected = this.get('apiServers.serverSelected'),
      datasetsTask = serverTabSelected && serverTabSelected.getDatasets();
      {
      let
      /** expect that both serverTabSelected and datasetsTask are defined, regardless of serverTabSelectedName.  */
      newTaskInstance = datasetsTask || Promise.resolve([]);
      dLog('controller/mapview: updateModel()', newTaskInstance);
      model.set('availableMapsTask', newTaskInstance);

      /** If this is called as refreshDatasets from data-csv then we want to get
       * blockFeatureLimits for the added block.
       * Perhaps can pass (undefined, {server : serverTabSelected}), and also
       * check if blocksLimitsTask.get('isRunning') (factor out of
       * mapview:model() )
       */
      newTaskInstance.then((datasets) => {
        this.get('block').getBlocksLimits();
      });
      }
      return datasetsTask;
    }
  },

  layout: EmberObject.create({
    'left': {
      'visible': true,
      'tab': 'view'
    },
    'right': {
      'visible': true,
      'tab': 'selection'
    },
    matrixView : {tableYDimensions : null},
  }),

  leftSplitSizes : Ember_A([21, 79]),
  leftSplitListen(event) {
    $('.left-panel-shown')
      .on('toggled', (event, shown) => {
        dLog(this.leftSplitSizes, '.left-panel-shown', 'toggled', event, shown);
        if (shown) {
          this.set('leftSplitSizes', this.leftSplitSizesPrev);
        } else {
          this.leftSplitSizesPrev = this.leftSplitSizes;
          this.set('leftSplitSizes', [0, 100]);
        }
        this.leftSplitInstance?.setSizes(this.leftSplitSizes);
      });
  },

  leftSplitListenSetup : on('init', function () {
    later(() => {
      this.leftSplitListen();
    });
  }),
  registerInstanceLeftSplit(splitInstance) {
    dLog('registerInstanceLeftSplit', splitInstance, this.leftSplitInstance);
    this.leftSplitInstance = splitInstance;
  },

  leftSplit_onDragEnd(sizes) {
    // dLog('leftSplit_onDragEnd', sizes);
    this.leftSplitSizes = sizes;
  },

  //----------------------------------------------------------------------------

  /** Register the Split.js instance which alternates in position between Right/Bottom.
   * and contains Dataset / Features / Paths / Genotypes
   */
  registerInstanceRightSplit(splitInstance) {
    dLog('registerInstanceRightSplit', splitInstance, this.rightSplitInstance);
    /* To provide also support for setSizes([100, 0]) when display of
     * the right panel is toggled, factor out leftSplitListen() to a
     * sub-component wrapping split-view.
     * For now, this instance reference enables the Genotype Table
     * width to be set for genotype-search.
     */
    this.controls.window.rightSplitInstance = splitInstance;
  },

  //----------------------------------------------------------------------------

  splitViewDirection : computed('tablesPanelRight', function () {
    let direction = this.tablesPanelRight ? 'horizontal' : 'vertical';
    dLog('splitViewDirection', direction, this.tablesPanelRight);
    return direction;
  }),
  /** attributes  : .sizesPrev, .sizes, .tablesPanelRight.
   * Records the sizes for 2 possible values of tablesPanelRight : true / false.
   */
  componentGeometry : EmberObject.create({sizesPrev : EmberObject.create({
    true :  [65, 35],
    false : [70, 30],
  }) }),
  onDragEnd(sizes) {
    dLog('onDragEnd', sizes);
    this.set('componentGeometry.sizes', sizes);
    this.set('componentGeometry.sizesPrev.' + this.tablesPanelRight, sizes);
    this.set('componentGeometry.tablesPanelRight', this.tablesPanelRight);
  },
  /** @return initial size, or size of this layout direction (tablesPanelRight)
   * after last resize drag. */
  get sizesPrev() {
    let
    tablesPanelRight = this.get('componentGeometry.tablesPanelRight'),
    sizes = this.get('componentGeometry.sizesPrev.' + this.tablesPanelRight);
    return sizes;
  },
  tablesPanelRight : alias('controls.window.tablesPanelRight'),
  toggleLayout(value) {
    const fnName = 'toggleLayout';
    this.toggleProperty('tablesPanelRight');
    /** tablesPanelRight is initially false, so it is OK to set body class in toggle action. */
    d3.select('body')
      .classed('tablesPanelRight', this.get('tablesPanelRight'));
  },


  controls : EmberObject.create({
    // .view becomes a reference to components/panel/view-controls
    view : {  },
    /** to add .viewed, use computed() to provide `this`
    viewed : () => this.get('controlsService.viewed'),  */
    /** Changing tablesPanelRight : false -> true because that suits the
     * Genotype Table, which is now a predominant display panel.
     */
    window : {tablesPanelRight : true, navigation : { } } }),

  queryParams: ['mapsToView'],
  mapsToView: [],
  /** GUI controls / settings changed by the user, preserved for components
   * which exist only while their tab is visible.
   * e.g. preserved settings for component panel/manage-genotype are in userSettings.genotype.
   */
  userSettings : {genotype : {}},

  selectedFeatures : alias('selectedService.selectedFeatures'),
  /** counts of selected paths, from paths-table; shown in tab. */
  pathsTableSummary : {},

  /** bundle of references  (object attributes) */
  oa : {axisApi : {}, stacks},

  scaffolds: undefined,
  scaffoldFeatures: undefined,
  showScaffoldFeatures : false,
  showAsymmetricAliases : false,

  init: function() {
    this._super.apply(this, arguments);

    /** refn : https://discuss.emberjs.com/t/is-this-possible-to-turn-off-some-deprecations-warnings/8196 */
    let deprecationIds = [
      'ember-component.send-action',
      /** ember-bootstrap/utils/cp/listen-to.js uses Ember.getWithDefault() */
      'ember-metal.get-with-default'];
    registerDeprecationHandler((message, options, next) => {
      if (! deprecationIds.includes(options.id)) {
        next(message, options);
      }
    });

    this.queryParamsService.queryParamsHost = this;
    stacks.oa = this.oa;

    this.controls.window.navigation.setTab = this.actions.setTab.bind(this);
  },

  currentURLDidChange: observer('target.currentURL', function () {
    dLog('currentURLDidChange', this.get('target.currentURL'));
  }),


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
  hasData: computed(
    function() {
      let viewedBlocksLength = this.get('block.viewed.length');
      if (trace_dataflow)
        dLog("hasData", viewedBlocksLength);
      return viewedBlocksLength > 0;
    }),

  /** Update queryParams and URL.
   */
  queryParamsValue : computed(
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
     * Also adding a similar request to updateModel (refreshDatasets) so by this
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

  /*--------------------------------------------------------------------------*/

  /* copied from file-drop-zone.js, can factor if this is retained.  */
  /** View/Unview the blocks of the given dataset.
   * View is used to view a dataset added by sequence-sequence.
   * Unview is used when the datasets has been replaced by successful upload.
   * @param datasetName id
   * @param view  true for view, false for unview
   * @param blockNames  undefined or an array of names of blocks to affect.
   */
  viewDataset(datasetName, view, blockNames) {
    let
    server = this.get('apiServers').get('serverSelected'),
    store = server.get('store'),
    dataset = store.peekRecord('dataset', datasetName);
    /** If not found on primary then check the server selected in dataset
     * explorer.  Could do just this instad of checking primary - probably
     * viewDataset should be relative to serverSelected by default.
     * blast-results-view.js : resultParentBlocks() does the same.
     */
    if (! dataset) {
      let db = server.get('datasetsBlocks');
      dataset = db.findBy('name', datasetName);
    }
    if (dataset) {
      let
      blocksToChange = dataset.get('blocks').toArray()
        .filter((b) => (b.get('isViewed') !== view) &&
           (! blockNames || blockNames.indexOf(b.get('name')) !== -1) ),
      blockService = this.get('block'),
      blockIds = blocksToChange.map((b) => b.id);
      dLog('viewDataset', datasetName, view, blockIds);
      if (! view) {
        // unview the data blocks before the axis / reference block.
        blocksToChange.forEach((b) => b.unViewChildBlocks());
        blockService.setViewed(blockIds, view);
      } else {
        let loadBlock = this.actions.loadBlock.bind(this);
        blocksToChange.forEach((b) => loadBlock(b));
      }
    } else {
      dLog('viewDataset', datasetName, 'not found', view);
    }
  },


  /*--------------------------------------------------------------------------*/

  /** Filter out of .selectedFeatures[] features of un-viewed blocks.
   * Also : axis-menu-actions.js : blockVisible() and axisDelete() update .blocksFeatures and :
   * sendUpdatedSelectedFeatures() -> updatedSelectedFeatures() -> selectedBlocksFeaturesToArray()
   * which will remove the block's features from .selectedFeatures
   */
  removeUnviewedBlockFeaturesFromSelected() {
    const fnName = 'removeUnviewedBlockFeaturesFromSelected';
    // 'blockService.viewed'
    let f = this.selectedFeatures;
    dLog('removeUnviewedBlockFeaturesFromSelected', f?.length);
    this.selectedFeatures = this.selectedFeatures
      .filter((f) => {
        let isViewed = f.feature.get('blockId.isViewed');
        if (! isViewed) {
          let
          /** Could use axisFeatureCircles_selectOneInAxis() here, probably no benefit.
           * Related : axisFeatureCircles_selectUnviewed(), axisFeatureCircles_removeBlock().
           */
          circleS = axisFeatureCircles_selectOne(f.feature);
          circleS.remove();
        }
        return isViewed;
      });
  },

  /*--------------------------------------------------------------------------*/


  /** Provide a class for the div which wraps the right panel.
   *
   * The class indicates which of the tabs in the right panel is currently
   * selected/displayed.  paths-table css uses this to display:none the
   * components div;   the remainder of the template is disabled via {{#if
   * (compare layout.right.tab '===' 'paths')}} which wraps the whole component.
   */
  rightPanelClass : computed(
    'layout.right.tab',
    'userSettings.genotype.hideControls',
    function () {
      let tab = this.get('layout.right.tab');
      dLog('rightPanelClass', tab);
      let
      classNames = 'right-panel-' + tab,
      /** Add hideControls to classNames when .userSettings.genotype.hideControls is true.
       * This class could be omitted when tab is not genotype; the css selector is :
       * .right-panel-genotype.hideControls .panel-parent
       */
      rightPanelGenotype_hideControls = this.userSettings.genotype.hideControls;
      if (rightPanelGenotype_hideControls) {
        classNames += ' hideControls';
      }
      return classNames;
    }),

  enableGenotypeControlsDialog : alias('block.viewedVCFBlocks.length'),

});
