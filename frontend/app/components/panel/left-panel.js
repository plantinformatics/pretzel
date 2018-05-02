import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  style: 'height:100%',
  attributeBindings: ['style:style'],

  actions: {
    toggleLeftPanel() {
      $(".left-panel-shown").toggle();
      $(".left-panel-hidden").toggle();
    },
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    }
  }
});
