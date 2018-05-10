import Ember from 'ember';

const { computed : { readOnly } } = Ember;

console.log("controllers/mapview.js");

let trace_promise = 1;

export default Ember.Controller.extend(Ember.Evented, {

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
    },

    /**  add mapName to this.get('mapsToView') and update URL
     * (named map for consistency, but mapsToView really means block, and "name" is db ID)
     */
    addMap : function(mapName) {
      let mtv = this.get('mapsToView');
      console.log("controller/mapview", "addMap", mapName, mtv, this.target.currentURL);
      mtv.pushObject(mapName);
       let queryParams =
        {'mapsToView' : mtv,
         // chr : '', highlightFeature : ''
         /* The URL is only updated if some extra params are given; chr and
          * highlightFeature will be included in the URL if given, whereas 'abc'
          * will not.
          * Single-stepping into transitionToRoute() when 'abc' is omitted,
          * at this line oldState.queryParams is the same newState.queryParams,
          * which seems odd :
          * function getTransitionByIntent(intent, isIntermediate) {
          *     ... var queryParamChangelist = getChangelist(oldState.queryParams, newState.queryParams);
          */
         'abc' : 'def'
        };
      this.transitionToRoute({'queryParams': queryParams });  
    },
    /**  remove mapName from this.get('mapsToView') and update URL
     */
    removeMap : function(mapName) {
      let mtv = this.get('mapsToView');
      console.log("controller/mapview", "removeMap", mapName, mtv);
      let di;
      for (di = mtv.length; di >= 0; di--) {
        if (mtv[di] == mapName) {
          console.log("removeMap", "found", mapName, "at", di, mtv.length);
          break;
        }
      }
      if (di >= 0) {
        mtv.removeAt(di, 1);
        console.log("removeMap", "deleted", mapName, "at", di, mtv.length, mtv);
        console.log("removeMap", "mapsToView:", this.get('mapsToView'));
        let queryParams = // this.get('queryParams');
          {'mapsToView' : mtv
           , 'abc' : 'def'  // see comment re. queryParams in addMap() above.
          };
        console.log("queryParams", queryParams);
        this.transitionToRoute({'queryParams': queryParams });
      }
    },
    updateChrs : function() {
      console.log("updateChrs TODO get datasets", this.get('model'));      
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
    selectBlock: function(block) {
      console.log('SELECT BLOCK mapview', block)
      this.set('selectedBlock', block);
      d3.selectAll("ul#maps_aligned > li").classed("selected", false);
      d3.select('ul#maps_aligned > li[data-chr-id="' + block.id + '"]').classed("selected", true);
      d3.selectAll("g.axis-outer").classed("selected", false);
      d3.select("g#id" + block.id).classed("selected", true);
    },
    selectBlockById: function(blockId) {
      let store = this.get('store'),
      selectedBlock = store.peekRecord('block', blockId);
      /* Previous version traversed all blocks of selectedMaps to find one
       * matching blockId. */
      this.send('selectBlock', selectedBlock)
    },
    /** 
     * This function is a copy of the code in the routes/mapview.js file without the references to params
     * so that it can be called after initial load to refresh the model variables.
     */
    updateModel: function() {
      // Get all available maps.

      // console.log("routes/mapview: model() result", result);
      if (true)  // -  do in next commit.  Factor routes/mapview.js:model()
        console.log('TODO : updateModel()');
        else
      this.set('model', result);
      // return result;
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

  queryParams: ['mapsToView'],
  mapsToView: [],

  selectedFeatures: [],

  dataReceived : Ember.ArrayProxy.create({ content: Ember.A() }),

  scaffolds: undefined,
  scaffoldFeatures: undefined,
  showScaffoldFeatures : false,
  showAsymmetricAliases : false,


  currentURLDidChange: function () {
    console.log('currentURLDidChange', this.get('target.currentURL'));
  }.observes('target.currentURL'),

  selectedMaps: readOnly('model.viewedBlocks.viewedBlocks'),
/*
   Ember.computed('model.blockValues.@each', 'model.blockIds.[]', function() {
     let blockValues = this.get('model.blockValues');
     console.log('selectedMaps', blockValues);
     return blockValues;
  }),
*/

  viewedBlockIds : Ember.computed('mapsToView', 'model.blockTasks.@each.isRunning', 'model.blockValues.@each', 'model.blockIds.[]', function() {
    let mapsToView = this.get('mapsToView'),
    blockValues = this.get('model.blockValues'),
    /** may as well use blockIds in place of selectedMaps */
    blockIds = this.get('model.blockIds'),
    store = this.get('store'),
    /** filter against block ids of datasets from taskGetList() result */
    validBlockIds = mapsToView.filter(function (blockId) {
      let block = store.peekRecord('block', blockId);
      return !!block;
    });
    console.log('viewedBlockIds', mapsToView, validBlockIds, blockValues, blockIds);
    return validBlockIds;
  }),
  blockTasks : readOnly('model.viewedBlocks.blockTasks'),
  // viewedBlocks : readOnly('model.viewedBlocks.viewedBlocks'),
  blockValues : readOnly('model.viewedBlocks.blockValues'),
  blockIds : readOnly('model.viewedBlocks.blockIds'),


  /** Used by the template to indicate when & whether any data is loaded for the graph.
   *
   * Retaining for the moment mapsToView, but selectedMaps is a subset of
   * mapsToView - just those which are loaded, whereas mapsToView is the
   * requested block ids, which may be invalid, or the blocks may not yet be
   * received, so it seems that mapsToView should be omitted here.
   *
   */
  hasData: Ember.computed('selectedMaps', 'mapsToView', function() {
    let selectedMaps = this.get('selectedMaps');
    let mapsToView = this.get('mapsToView');
    if (trace_promise)
    console.log("hasData", ! selectedMaps || selectedMaps.length, mapsToView.length);
    return (selectedMaps && selectedMaps.length > 0)
      || mapsToView.length > 0;
  }),

  mapsToViewChanged: function (a, b, c) {
    /* initial mapsToView via URL sets model; maps are added or deleted after
     * that update the add-map and delete-map button sensitivities (extraBlocks,
     * blockLink(), blockDeleteLink()), via : */
    if (this.get('model.content'))
    {
      if (trace_promise > 1)
      console.log('mapsToViewChanged() -> updateChrs()');
      this.send('updateChrs');
    }
  }.observes('mapsToView.length')


});
