import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  initSteps: function() {
    let layout = {
      'active': false
    }
    this.set('layout',layout);
  }.on('init'),
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
