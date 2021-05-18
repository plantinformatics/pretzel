import Component from '@ember/component';

const dLog = console.debug;

/**
 * @param blocks viewedSynonomousReferenceBlocks
 */
export default Component.extend({
  classNames : ['synonomous-parents'],

  actions : {
    clearBlocks : function() {
      dLog('clearBlocks', this.get('blocks'));
      this.set('blocks', []);
    }
  }

});
