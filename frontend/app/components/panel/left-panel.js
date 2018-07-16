import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  style: 'height:100%',
  attributeBindings: ['style:style'],
  view: 'mapview',

  actions: {
    toggleLeftPanel() {
      $(".left-panel-shown").toggle();
      $(".left-panel-hidden").toggle();
    },
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    },
    changeTab(tab) {
      $('.nav-tabs a[href="#left-panel-' + tab + '"]').tab('show');
    },
    selectBlock(block) {
      this.sendAction('selectBlock', block);
    },
    removeBlock(block) {
      this.sendAction('removeBlock', block);
    }
  }
});
