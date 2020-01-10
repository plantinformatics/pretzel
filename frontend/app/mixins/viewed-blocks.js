import Ember from 'ember';
const { inject: { service } } = Ember;
import { task } from 'ember-concurrency';

const { Mixin } = Ember;

export default Mixin.create({
  // already injected in controllers/mapview
  // block: service('data/block'),

/*
  actions: {
    setViewed(blockId, viewed) {
      this.get('setViewed').apply(this, blockId, viewed);
    },
    openBlock(blockId) {
      console.log("view-blocks", "openBlock", blockId);
      this.sendAction('openBlock', blockId);
    },
    closeBlock(block) {
      console.log("view-blocks", "closeBlock", block.id);
      this.sendAction('closeBlock', block.id);
    }
  },
*/

  getInitialBlocksForParams() {
  // didInsertElement(e) {
    let
      model = this.get('model'),
    initialParams = this.get('model.params');
    console.log("view-blocks", "didInsertElement", this, initialParams, model);
    this.get('getInitialBlocks').apply(this);
  },

  /** Set the isViewed flag of the block identified by id.
   * Get record into store if it is not yet loaded.
   * If setting isViewed=false then there is no point loading the record, but most likely it is already loaded.
   * Alternative : services/data/block.js @see setViewedTask()
   */
  setViewed0(id, viewed) {
    console.log("setViewed", id, viewed);
    let blockService = this.get('block');
    let taskGet = blockService.get('taskGet');
    let blockTask = taskGet.perform(id)
      .then(function (block) {
        console.log("setViewed", id, block.get('id'), block.get('isViewed'), ' -> ', viewed,  block);
        block.set('isViewed', viewed);
      });
  },
  /** Replaces setViewed0() above; this version passes unviewChildren==true to
   * setViewTask(). */
  setViewed(id, viewed) {
    console.log("setViewed", id, viewed);
    let blockService = this.get('block');
    let setViewedTask = blockService.get('setViewedTask');
    let blockTask = setViewedTask.perform(id, viewed, /*unviewChildren*/true);
  },
  /** Set the .isViewed flag of blocks of the given blockIds */
  setViewedOnly(blockIds, viewed) {
    let store = this.get('store'),
    blocks = blockIds.map((blockId) => store.peekRecord('block', blockId))
      .filter((block) => block);
    console.log("setViewed", blockIds, viewed, blocks);
    this.beginPropertyChanges();
    blocks.forEach((block) => block.set('isViewed', viewed));
    this.endPropertyChanges();
  },

  getInitialBlocks() {
    let model = this.get('model'),
    params = this.get('model.params');
    let result =
      this.get('getBlocks').apply(this, [params.mapsToView]);
    model.set('viewedBlocks', result);
  }

});
