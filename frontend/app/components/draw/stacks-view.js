import Ember from 'ember';
const { inject: { service } } = Ember;

import { /* Block, Stacked, Stack,*/ stacks /*, xScaleExtend, axisRedrawText, axisId2Name*/ } from '../../utils/stacks';

/* global d3 */

const dLog = console.debug;

export default Ember.Component.extend({
  block: service('data/block'),
  previous : {},

  stacksCount : Ember.computed('block.stacksCount', 'block.viewed', 'axes2d.[]', function () {
    let count;
    let previous = this.get('previous.stacks');
    count = this.get('block.stacksCount');
    dLog('stacks', count, stacks);
    dLog(stacks, stacks.axesPCount, 'stacksCount', stacks.stacksCount);
    if (count != previous) {    // may not be needed
      this.set('previous.stacks', count);
      Ember.run.later(function () {
        stacks.oa.showResize(true, false); });
      this.get('drawMap').draw({}, 'dataReceived');
      stacks.oa.axisApi.stacksAxesDomVerify();
    }
    return count;
  }),

  /** @return blocks which correspond to axes, i.e. are not child blocks.  */
  axesP : Ember.computed('block.viewed', function () {
    let blockService = this.get('block');
    let viewedBlocks = blockService.get('viewed');
    // dLog('viewedBlocks', viewedBlocks);
    let axesP = viewedBlocks.filter(function (block) {
      let blockId = block.get('id'),
      referenceBlock = block.get('referenceBlock');
      dLog('axesP', block, blockId, referenceBlock && referenceBlock.get('id'));
      return referenceBlock === undefined;
    });
    dLog('axesP', axesP, axesP.mapBy('_internalModel.__data'));
    return axesP;
  })

});

