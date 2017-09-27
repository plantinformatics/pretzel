import Ember from 'ember';

console.log("controllers/mapview.js");


export default Ember.Controller.extend({

  actions: {
    // layout configuration
    setVisibility: function(side) {
      console.log("setVisibility", side);
      let visibility = this.get(`layout.${side}.visible`)
      this.set(`layout.${side}.visible`, !visibility);
    },
    setTab: function(side, tab) {
      console.log("setTab", side, tab);
      this.set(`layout.${side}.tab`, tab);
    },

    updateSelectedMarkers: function(markers) {
	// console.log("updateSelectedMarkers in mapview controller", markers.length);
      this.set('selectedMarkers', markers);
    },

    /**  remove mapName from this.get('mapsToView') and update URL
     */
    mapsToViewDelete : function(mapName)
    {
      let mtv = this.get('mapsToView');
      console.log("controller/mapview", "mapsToViewDelete", mapName, mtv);
      let di;
      for (di = mtv.length; di >= 0; di--)
      {
        if (mtv[di] == mapName)
        {
          console.log("mapsToViewDelete", "found", mapName, "at", di, mtv.length);
          break;
        }
      }
      if (di >= 0)
      {
        mtv.removeAt(di, 1);
        console.log("mapsToViewDelete", "deleted", mapName, "at", di, mtv.length, mtv);
        console.log("mapsToViewDelete", "mapsToView:", this.get('mapsToView'));
        let queryParams = this.get('queryParams');
        console.log("queryParams", queryParams);
        this.transitionToRoute({'queryParams': queryParams });
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
    , pathColourScale: true
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

  availableMaps: [],

  selectedMaps: [],
  selectedMarkers: [],

  dataReceived : Ember.ArrayProxy.create({ content: Ember.A() }),

  scaffolds: undefined,
  scaffoldMarkers: undefined,
  showScaffoldMarkers : false,
  showAsymmetricAliases : false,

  markersSelected: Ember.computed('selectedMarkers', function() {
    return this.selectedMarkers.length > 0;
  }),

  numMarkers: Ember.computed('selectedMarkers', function() {
    return this.selectedMarkers.length;
  }),

  hasData: Ember.computed('selectedMaps', 'mapsToView', function() {
    return this.selectedMaps.length > 0
			|| this.mapsToView.length > 0;
  }),

  mapsToViewChanged: function (a, b, c) {
    let mtv = this.get('mapsToView'), i=mtv.length;
    if (i)
    {
      let m=mtv[i-1], im, exists;
      console.log("mapsToViewChanged", mtv.length, mtv, i, m, a, b, c);
      console.log(this.get('selectedMaps').length, this.get('selectedMaps'), this.get('hasData'));
      // console.log(this.get('availableMaps'.length), this.get('availableMaps'));
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
  }.observes('mapsToView')

});
