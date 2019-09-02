import Ember from 'ember';

export default Ember.Component.extend({
  tagName: '',

  actions : {
    loadBlock(block) {
      console.log('entry-block-by-scope: loadBlock', block, arguments);
      this.sendAction('loadBlock', block);
    }
  }

});
