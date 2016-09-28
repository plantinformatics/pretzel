import Ember from 'ember';

export default Ember.Controller.extend({
  queryParams: ['mapsToView'],
  mapsToView: [],
  availableMaps: [],
  mapData: [],

  selectedMaps: [],
  //selectedMaps: Ember.computed('mapsToView', function() {
  //  console.log("in selectedMaps");
  //  return this.get('mapsToView');
  //}),

  hasData: Ember.computed('mapData', function() {
    return this.mapData.length > 0;
  }),

});
