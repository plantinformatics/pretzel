import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  layout: {
  },
  actions: {
    selectChrom(chr) {
      this.sendAction('selectChrom', chr);
    },
    deleteChrom(chr) {
      this.sendAction('deleteChrom', chr.id);
    }
  }
});
