import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({

  actions: {
    selectChrom(chr) {
      console.log("goto-map", "selectChrom", chr);
      this.sendAction('selectChrom', chr);
    },
    deleteChrom(chr) {
      console.log("goto-map", "deleteChrom", chr.id);
      this.sendAction('deleteChrom', chr.id);
    }
  }
});
