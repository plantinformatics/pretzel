import Ember from 'ember';

export default Ember.Controller.extend({
  queryParams: ['mapsToView'],
  mapsToView: [],
  availableMaps: [],

  selectedMaps: Ember.computed('mapsToView', function() {
    return this.get('mapsToView');
  }),

  init() {
    console.log("mapsToView =");
    console.log(this.get('mapsToView'));
    console.log("mapview controller init");
  }
});
