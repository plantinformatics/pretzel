import Ember from 'ember';

const { computed : { readOnly } } = Ember;
const { inject: { service } } = Ember;

/* global d3 */

console.log("controllers/mapview.js");

let trace_dataflow = 1;
let trace_select = 1;

export default Ember.Controller.extend(Ember.Evented, {
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
      console.log('SELECT BLOCK mapview', block.get('name'), block.get('mapName'), block.id, block);
      this.set('selectedBlock', block);
      d3.selectAll("ul#maps_aligned > li").classed("selected", false);
      d3.select('ul#maps_aligned > li[data-chr-id="' + block.id + '"]').classed("selected", true);

      function dataIs(id) { return function (d) { return d == id; }; }; 
      d3.selectAll("g.axis-outer").classed("selected", dataIs(block.id));
      if (trace_select)
      d3.selectAll("g.axis-outer").each(function(d, i, g) { console.log(this); });
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
  blockTasks : readOnly('model.viewedBlocks.blockTasks'),
  // viewedBlocks : readOnly('model.viewedBlocks.viewedBlocks'),
  blockValues : // readOnly('block.blockValues'),
  Ember.computed('block.blockValues', function() {
    let block = this.get('block'),
    records = block.get('blockValues'),
    array = records.toArray();
    console.log('blockValues', block, records, array);
    return array;
  }),
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
    if (trace_dataflow)
    console.log("hasData", ! selectedMaps || selectedMaps.length, mapsToView.length);
    return (selectedMaps && selectedMaps.length > 0)
      || mapsToView.length > 0;
  })

});
