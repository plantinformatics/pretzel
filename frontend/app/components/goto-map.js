import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({

  actions: {
    selectBlock(block) {
      console.log("goto-map", "selectBlock", block);
      this.sendAction('selectBlock', block);
    },
    deleteBlock(block) {
      console.log("goto-map", "deleteBlock", block.id);
      this.sendAction('deleteBlock', block.id);
    }
  }
});
