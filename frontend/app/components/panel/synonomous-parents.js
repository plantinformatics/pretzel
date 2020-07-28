import Ember from 'ember';

const dLog = console.debug;

/**
 * @param blocks viewedSynonomousReferenceBlocks
 */
export default Ember.Component.extend({
  classNames : ['synonomous-parents'],

  actions : {
    clearBlocks : function() {
      dLog('clearBlocks', this.get('blocks'));
      this.set('blocks', []);
    }
  }

});
