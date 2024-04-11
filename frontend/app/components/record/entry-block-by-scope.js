import Component from '@ember/component';

export default Component.extend({
  tagName: '',

  actions : {
    loadBlock(block) {
      console.log('entry-block-by-scope: loadBlock', block, arguments, this.entry?.brushName);
      this.loadBlock(block);
    }
  }

});
