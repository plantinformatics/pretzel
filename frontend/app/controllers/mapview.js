import Ember from 'ember';

console.log("controllers/mapview.js");

let trace_promise = 1;

export default Ember.Controller.extend({

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
        let queryParams = // this.get('queryParams');
          {'mapsToView' : mtv };
        console.log("queryParams", queryParams);
        this.transitionToRoute({'queryParams': queryParams });
      }
    },
    updateChrs : function(/*chrID*/) {
      let mdv=this.get('model.mapsDerived.content');
      if ((mdv === undefined) || (mdv === null))
        console.log("updateChrs", this.get('model'));
      else
      {
        let
      availableChrs = mdv.availableChrs,
      availableMaps = mdv.availableMaps,
      mtv = this.get('mapsToView'),
      extraChrs = availableChrs;
        if (trace_promise > 1)
      console.log("updateChrs", availableChrs, mtv); // , chrID
      this.set('extraChrs', extraChrs);
      // the above is draft replacement for the following.

      // copied (with some excisions) from routes/mapview model(); this needs to be reorganised - probably to a controllers/chromosome.js
      let selMaps = [];
      if (availableMaps) {
      // availableMaps.then(function(genmaps) );
      let genmaps = availableMaps;
      genmaps.forEach(function(map) {
        let chrs = map.get('chromosomes');
        chrs.forEach(function(chr) {
          var exChrs = [];
          chr.set('isSelected', false); // In case it has been de-selected.
          if (mtv) {
            for (var i=0; i < mtv.length; i++) {
              if (chr.get('id') != mtv[i]) {
                exChrs.push(mtv[i]);
              }
              else {
                chr.set('isSelected', true);
                selMaps.push(chr);
              }
            }
          }
          chr.set('extraChrs', exChrs);
        });
      });
      }
      this.set("selectedMaps", selMaps);
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

/*
  availableMaps: [],

  selectedMaps: [],
*/
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
     * that update the add-map and delete-map button sensitivities (extraChrs,
     * chrLink(), chrDeleteLink()), via : */
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
