import Ember from 'ember';

console.log("controllers/mapview.js");


export default Ember.Controller.extend({

  actions: {
    updateSelectedMarkers: function(markers) {
	// console.log("updateSelectedMarkers in mapview controller", markers.length);
      this.set('selectedMarkers', markers);
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
  }//.observes('mapsToView')

});
