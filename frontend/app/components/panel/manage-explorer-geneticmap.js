import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  initSteps: function() {
    let layout = {
      'active': false
    }
    this.set('layout',layout);
  }.on('init'),
  data: Ember.computed('geneticmap.chromosomes', 'filter', function() {
    console.log('geneticmap explorer computed')
    let availableMaps = this.get('geneticmap.chromosomes')
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    // let filtered = availableMaps //all
    if (filter == 'public') {
      return availableMaps.filterBy('public', true)
      // return maps.filterBy('chromosomes', 'public', true)
    } else if (filter == 'owner') {
      return availableMaps.filterBy('owner', true)
    } else {
      return this.get('geneticmap.chromosomes')
    }
  }),
  dataEmpty: Ember.computed('data', function() {
    let availableMaps = this.get('data')
    if (availableMaps && availableMaps.length > 0) { return false; }
    else { return true; }
  }),
  actions: {
    selectChrom(chr) {
      this.sendAction('selectChrom', chr);
    },
    deleteChrom(chr) {
      this.sendAction('deleteChrom', chr.id);
    },
    switchGeneticmap(geneticmap) {
      console.log('switchGeneticmap')
      let active = this.get('layout.active')
      this.set('layout.active', !active)
    }
  }
});
