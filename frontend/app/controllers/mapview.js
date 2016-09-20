import Ember from 'ember';

export default Ember.Controller.extend({
  queryParams: ['mapsToView'],
  mapsToView: [],
  availableMaps: [],
  mapData: [],

  selectedMaps: Ember.computed('mapsToView', function() {
    return this.get('mapsToView');
  }),

  hasData: Ember.computed('mapData', function() {
    console.log("in hasData: mapData =" + this.mapData);
    for (var i=0; i<this.mapData.length; i++) {
      var retMapPromise = this.mapData[i].get('maps');
      retMapPromise.then(function(resolvedMap) {
        resolvedMap.forEach(function(map) {
          var mapName = map.get('name');
          var markerPromise = map.get('markermaplocations');
          markerPromise.then(function(resolvedMarkers) {
            resolvedMarkers.forEach(function(marker) {
              console.log(marker.get('location'));
            });
          });
        });
      });
    }
    return this.mapData.length > 0;
  }),

});
