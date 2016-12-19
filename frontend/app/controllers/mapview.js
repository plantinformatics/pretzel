import Ember from 'ember';

export default Ember.Controller.extend({

  actions: {
    updateSelectedMarkers: function(markers) {
      console.log("updateSelectedMarkers in mapview controller");
      this.set('selectedMarkers', markers);
    }
  },

  queryParams: ['mapsToView', 'chr'],
  mapsToView: [],
  chr: '',
  //availableChrs: ['1A', '2A', '3A', '4A', '5A', '6A', '7A',
  //                '1B', '2B', '3B', '4B', '5B', '6B', '7B',
  //                '1D', '2D', '3D', '4D', '5D', '6D', '7D'],
  availableChrs: [],
  availableMaps: [],

  selectedMaps: [],
  selectedMarkers: [],

  markersSelected: Ember.computed('selectedMarkers', function() {
    return this.selectedMarkers.length > 0;
  }),

  numMarkers: Ember.computed('selectedMarkers', function() {
    return this.selectedMarkers.length;
  }),

  hasChrs: Ember.computed('availableChrs', function() {
    return this.availableChrs.length > 0;
  }),

  hasData: Ember.computed('selectedMaps', function() {
    return this.selectedMaps.length > 0;
  }),

});
