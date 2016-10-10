import Ember from 'ember';

export default Ember.Controller.extend({
  queryParams: ['mapsToView', 'chr'],
  mapsToView: [],
  chr: '1A',
  availableChrs: ['1A', '2A', '3A', '4A', '5A', '6A', '7A',
                  '1B', '2B', '3B', '4B', '5B', '6B', '7B',
                  '1D', '2D', '3D', '4D', '5D', '6D', '7D'],
  availableMaps: [],

  selectedMaps: [],

  hasData: Ember.computed('selectedMaps', function() {
    return this.selectedMaps.length > 0;
  }),

});
