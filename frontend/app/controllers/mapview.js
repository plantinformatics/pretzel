import Ember from 'ember';

export default Ember.Controller.extend({
  queryParams: ['mapsToView'],
  mapsToView: [],
  availableMaps: [],

  selectedMaps: [],

  hasData: Ember.computed('selectedMaps', function() {
    return this.selectedMaps.length > 0;
  }),

});
