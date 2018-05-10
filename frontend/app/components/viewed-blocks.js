import Ember from 'ember';
const { inject: { service } } = Ember;
import { task } from 'ember-concurrency';

const { Component } = Ember;

export default Component.extend({
  block: service('data/block'),

  actions: {
    openBlock(blockId) {
      console.log("view-blocks", "openBlock", blockId);
      this.sendAction('openBlock', blockId);
    },
    closeBlock(block) {
      console.log("view-blocks", "closeBlock", block.id);
      this.sendAction('closeBlock', block.id);
    }
  },

  didInsertElement(e) {
    let
      model = this.get('model'),
    initialParams = this.get('model.params');
    console.log("view-blocks", "didInsertElement", this, initialParams, model, e);
    this.get('getInitialBlocks').apply(this);
  },

  getInitialBlocks() {
    let model = this.get('model'),
    params = this.get('model.params');
    let blockService = this.get('block');
    let taskGet = blockService.get('taskGet');

    console.log("getInitialBlocks", params.mapsToView);
    let blockTasks = params.mapsToView.map(
      function (id) {
        let blockTask = taskGet.perform(id);
        console.log("mapview model", id, blockTask);
        return blockTask;
      });
    /** This could be a count; it is only used to observe when a new block is received.
     */
    let blockIds = this.get('blockIds') || this.set('blockIds', []),
    viewedBlocks = this.get('viewedBlocks') || this.set('viewedBlocks', []);
    let blockValues = this.get('mapsToViewObj') || this.set('mapsToViewObj', {}),
    getValue = this.get('getBlock');
    blockTasks.map(
      function (task) {
        getValue.perform(task, viewedBlocks, blockValues, blockIds);
      });

    let
    result =
      {
        update : this,
        blockTasks : blockTasks,
        viewedBlocks : viewedBlocks,
        blockValues : blockValues,
        blockIds : blockIds
      };
    console.log("components/viewed-blocks.js getInitialBlocks() result", result);
    model.set('viewedBlocks', result);
  },

  getBlock : task(function * (blockTask, viewedBlocks, blockValues, blockIds) {
    let block = yield blockTask;
     console.log("getBlock", block.id, block);
    blockValues[block.id] = block;
    viewedBlocks.pushObject(block);
    blockIds.pushObject(block.id);
  })

});
