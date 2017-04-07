import Ember from 'ember';

export default Ember.Controller.extend({

  actions: {
    updateSelectedMarkers: function(markers) {
      // console.log("updateSelectedMarkers in mapview controller");
      this.set('selectedMarkers', markers);
    },
    toggleShowUnique: function() {
      console.log("controllers/mapview:toggleShowUnique()", this);
      this.set('isShowUnique', ! this.get('isShowUnique'));
    }
    , isShowUnique: false
  },

  queryParams: ['mapsToView'],
  mapsToView: [],

  availableMaps: [],

  selectedMaps: [],
  selectedMarkers: [],

  markersSelected: Ember.computed('selectedMarkers', function() {
    return this.selectedMarkers.length > 0;
  }),

  numMarkers: Ember.computed('selectedMarkers', function() {
    return this.selectedMarkers.length;
  }),

  hasData: Ember.computed('selectedMaps', function() {
    return this.selectedMaps.length > 0;
  }),

});
