import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Component.extend({
  store: service(),

  filterOptions: {
    'all': {'formal': 'All', 'icon': 'plus'},
    'public': {'formal': 'Public', 'icon': 'eye-open'},
    'owner': {'formal': 'Mine', 'icon': 'user'}
  },
  filter: 'all',
  layout: {
  },
  data: Ember.computed('model.mapsDerived.availableMaps', 'filter', function() {
    let availableMaps = this.get('model.mapsDerived.availableMaps')
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    // let filtered = availableMaps //all
    if (filter == 'public') {
      let maps = availableMaps.filterBy('public', true)
      return maps.filterBy('chromosomes', 'public', true)
    } else if (filter == 'owner') {
      return availableMaps.filterBy('owner', true)
    } else {
      return this.get('model.mapsDerived.availableMaps')
    }
  }),
  dataEmpty: Ember.computed('data', function() {
    let availableMaps = this.get('data')
    if (availableMaps && availableMaps.length > 0) { return false; }
    else { return true; }
  }),
  actions: {
    refreshAvailable() {
      this.sendAction('updateModel')
    },
    selectChrom(chr) {
      this.sendAction('selectChrom', chr);
    },
    deleteChrom(chr) {
      this.sendAction('deleteChrom', chr.id);
    },
    changeFilter: function(f) {
      this.set('filter', f)
    }
  }
});
