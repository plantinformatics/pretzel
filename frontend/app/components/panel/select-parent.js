import Ember from 'ember';

const { inject: { service }, Component } = Ember;

const dLog = console.debug;

/**
 * @param block blockWithoutParentOnPrimary
 */
export default Ember.Component.extend({
  classNames : ['select-parent'],

  actions : {
    loadBlock(block) {
      console.log('select-parent: loadBlock', block, arguments);
      this.sendAction('loadBlock', block);
    },
    clearBlock : function() {
      dLog('clearBlock', this.get('block.id'));
      this.set('block', null);
    }
  },

  /** parentsOnSecondaries */
  referenceBlocks : Ember.computed.alias('block.referenceBlocks'),

  /** The above referenceBlocks() passes original=true, which filters out
   * copies; this function filters out originals, showing just the copies; might
   * be useful to advise the user where they can get the reference; if they have
   * viewed it from a secondary server previously, then a copy of it will be
   * here.
   */
  referenceBlocksCopies : Ember.computed('block.referenceBlocks', function () {
    let block = this.get('block'),
    blocks = ! block ? [] : block.referenceBlocksAllServers(false)
      .filter((block) => block.get('isCopy'));
    dLog('referenceBlocksCopies', blocks, this.get('block.id'));
    return blocks;
  })

});
