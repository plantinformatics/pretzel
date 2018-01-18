import Ember from 'ember';

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
          {'mapsToView' : mtv };
        console.log("queryParams", queryParams);
        this.transitionToRoute({'queryParams': queryParams });
      }
    },
    updateChrs : function(/*chrID*/) {
      let mdv = this.get('model.mapsDerived.content');
      if ((mdv === undefined) || (mdv === null)) {
        console.log("updateChrs", this.get('model'));
      } else {
        let availableBlocks = mdv.availableChrs
        let availableDatasets = mdv.availableMaps
        let mtv = this.get('mapsToView')
        // let extraBlocks = availableBlocks;
        
        if (trace_promise > 1) console.log("updateChrs", availableBlocks, mtv); // , chrID
        
        this.set('extraBlocks', availableBlocks);
        // the above is draft replacement for the following.

        // copied (with some excisions) from routes/mapview model();
        // this needs to be reorganised - probably to a controllers/chromosome.js
        let selectedDatasets = [];
        if (availableDatasets) {
        // availableDatasets.then(function(datasets) );
        // let datasets = availableDatasets;
        availableDatasets.forEach(function(dataset) {
          let blocks = dataset.get('blocks');
          blocks.forEach(function(block) {
            var exblocks = [];
            block.set('isSelected', false); // In case it has been de-selected.
            if (mtv) {
              for (var i=0; i < mtv.length; i++) {
                if (block.get('id') != mtv[i]) {
                  exblocks.push(mtv[i]);
                }
                else {
                  block.set('isSelected', true);
                  selectedDatasets.push(block);
                }
              }
            }
            block.set('extraBlocks', exblocks);
          });
        });
        }
        this.set("selectedMaps", selectedDatasets);
      }
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
      d3.selectAll("g.ap").classed("selected", false);
      d3.select("g#id" + block.id).classed("selected", true);
    },
    selectBlockById: function(blockId) {
      let selectedMaps = this.get('selectedMaps')
      let selectedBlock = null;
      selectedMaps.forEach(function(block) {
        if (block.id == blockId) {
          selectedBlock = block;
        }
      })
      this.send('selectBlock', selectedBlock)
    },
    /** 
     * This function is a copy of the code in the routes/mapview.js file without the references to params
     * so that it can be called after initial load to refresh the model variables.
     */
    updateModel: function() {
      // Get all available maps.
      let selMaps = [];
      let that = this;
      let result;
      /** collation of all chrs of all maps.  value is currently true, could be a refn to parent map. */
      let availableChrs = {}; // or new Set();
      /** These values are calculated from the list of available maps when maps promise resolves.
       availableChrs : availableChrs,
       selectedMaps: selMaps;
       */
      let mapsDerivedValue = {availableChrs: availableChrs, selectedMaps: selMaps};
  
      let seenChrs = new Set();
      var maps = that.get('store').query('dataset',
        {
          filter: {'include': 'blocks'}
        }
      )
      .then(function(datasets) {
        mapsDerivedValue.availableMaps = datasets.toArray();
        if (trace_promise > 1)
          console.log("datasets.toArray()", mapsDerivedValue.availableMaps);
        datasets.forEach(function(map) {
          let chrs = map.get('blocks');
          chrs.forEach(function(chr) {
            var exChrs = [];
            mapsDerivedValue.availableChrs[chr.get('id')] = map.get('name'); // or true; // could be map or map.get('id');
            chr.set('isSelected', false); // In case it has been de-selected.
            // console.log(chr, map);
            chr.set('map', map);  // reference to parent map
            chr.set('extraBlocks', exChrs);
          });
        });
        return Promise.resolve(mapsDerivedValue);
      },
        function(reason) {
          console.log("findAll geneticmap", reason);
        }
      );
      let promises = {};
  
      if (trace_promise > 1)
        maps.then(function (result) { console.log("maps result", result, maps._result); });
  
      let ObjectPromiseProxy = Ember.ObjectProxy.extend(Ember.PromiseProxyMixin);
      if (trace_promise > 1)
      {
        let a= ObjectPromiseProxy.create({promise: maps});
        a.then(function (result) { console.log("maps result 2", result, "availableChrs", result.availableChrs, "availableMaps", result.availableMaps); });
      }
      result = {
        chrPromises: promises,
        mapsToView : [],
        mapsDerived : ObjectPromiseProxy.create({promise: maps}),
        mapsPromise : maps,
        highlightMarker: false
      };
      // console.log("routes/mapview: model() result", result);
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

/*
  availableMaps: [],

  selectedMaps: [],
*/
  selectedFeatures: [],

  dataReceived : Ember.ArrayProxy.create({ content: Ember.A() }),

  scaffolds: undefined,
  scaffoldMarkers: undefined,
  showScaffoldMarkers : false,
  showAsymmetricAliases : false,

  hasData: Ember.computed('model.mapsDerived.content.selectedMaps', 'mapsToView', function() {
    let selectedMaps = this.get('model.mapsDerived.content.selectedMaps');
    if (trace_promise)
    console.log("hasData", ! selectedMaps || selectedMaps.length, this.mapsToView.length);
    return (selectedMaps && selectedMaps.length > 0)
      || this.mapsToView.length > 0;
  }),

  mapsToViewChanged: function (a, b, c) {
    let mtv = this.get('mapsToView'), i=mtv.length;
    if (i)
    {
      let m=mtv[i-1], im, exists;
      console.log("mapsToViewChanged", mtv.length, mtv, i, m, a, b, c);

      let mapsDerived = this.get('model.mapsDerived');
      let me = this;
      if ((trace_promise > 1) && mapsDerived)
      mapsDerived.then(function (value) {
        console.log("mapsDerived isPending", mapsDerived.get('isPending'), mapsDerived.get('content'), me.get('hasData'));
      });

      // console.log(this.get('model.availableMaps'.length), this.get('model.availableMaps'));
      if (trace_promise > 1)
      console.log(a.mapsToView.length, a.mapsToView);
      if (true)
      {
        let dataReceived = this.get('dataReceived');
        if (dataReceived)
          dataReceived.pushObject(mtv);
        else
          console.log(this);
      }
    }
    /* initial mapsToView via URL sets model; maps are added or deleted after
     * that update the add-map and delete-map button sensitivities (extraBlocks,
     * blockLink(), blockDeleteLink()), via : */
    if (this.get('model.mapsDerived.content'))
    {
      if (trace_promise > 1)
      console.log('mapsToViewChanged() -> updateChrs()');
      this.send('updateChrs');
    }
  }.observes('mapsToView.length'),

  chrsChanged: function () {
    this.send('updateChrs');
  }.observes('model.mapsDerived.content')


});
