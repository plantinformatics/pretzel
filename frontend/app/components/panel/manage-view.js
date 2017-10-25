import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  layout: {
    'remote': {
      'active': null // sigle id
      // 'active': Ember.A(['59cc7d33eea6df47e494b3cd']) // array of geneticmap ids
    }
  },
  showGeneticmap: function(geneticmap) {
    let active = this.get('layout.remote.active')
    return active.indexOf(geneticmap.id) > -1
  },
  actions: {
    selectChrom(chr) {
      this.sendAction('selectChrom', chr);
    },
    switchGeneticmap(geneticmap) {
      // intent is to switch to an array of map ids, as
      // this makes more sense for the interface. There are
      // issues in ember using conventional methods
      // console.log('switchGeneticmap')
      this.set('layout.remote.active', geneticmap.id)
      // let active = this.get('layout.remote.active')
      // let index = active.indexOf(geneticmap.id)
      // if (index > -1) {
      //   active.removeObject(geneticmap.id)
      // } else {
      //   active.pushObject(geneticmap.id)
      // }
      // console.log(active)
      // this.set('layout.remote.active', active)
    }
  }
});
