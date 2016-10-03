import Ember from 'ember';

export default Ember.Controller.extend({
  queryParams: ['mapsToView'],
  mapsToView: [],
  availableMaps: [],
  mapData: [],

  selectedMaps: [],

  hasData: Ember.computed('mapData', function() {
    return this.mapData.length > 0;
  }),

});
