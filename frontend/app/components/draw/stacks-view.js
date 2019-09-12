import Ember from 'ember';
const { inject: { service } } = Ember;

import { /* Block, Stacked, Stack,*/ stacks /*, xScaleExtend, axisRedrawText, axisId2Name*/ } from '../../utils/stacks';

/* global d3 */

export default Ember.Component.extend({
  block: service('data/block'),
  previous : {},

  stacksCount : Ember.computed('stacks.stacksCount.count', 'block.viewed', function () {
    let count;
    if (! this.get('stacks') && stacks)
      Ember.run.later(() => {
        this.set('stacks', stacks);
      }); else {
        let previous = this.get('previous.stacks');
        count = this.get('stacks.stacksCount.count');
        console.log('stacks', count, stacks);
        console.log(stacks, stacks.axesPCount, 'stacksCount', stacks.stacksCount, this.get('stacks'), this.get('stacks.stacksCount'), this.get('stacks.stacksCount.count'));
        if (count != previous) {    // may not be needed
          this.set('previous.stacks', count);
          Ember.run.later(function () {
            stacks.oa.showResize(true, false); });
        }
      }
    return count;
  }),

  /** @return blocks which correspond to axes, i.e. are not child blocks.  */
  axesP : Ember.computed('block.viewed', function () {
    let blockService = this.get('block');
    let viewedBlocks = blockService.get('viewed');
    // console.log('viewedBlocks', viewedBlocks);
    let axesP = viewedBlocks.filter(function (block) {
      let blockId = block.get('id'),
      referenceBlock = block.get('referenceBlock');
      console.log('axesP', block, blockId, referenceBlock && referenceBlock.get('id'));
      return referenceBlock === undefined;
    });
    console.log('axesP', axesP, axesP.mapBy('_internalModel.__data'));
    return axesP;
  })

});

