import Ember from 'ember';
const { inject: { service } } = Ember;

import { /* Block, Stacked, Stack,*/ stacks /*, xScaleExtend, axisRedrawText, axisId2Name*/ } from '../../utils/stacks';

/* global d3 */

const dLog = console.debug;

export default Ember.Component.extend({
  block: service('data/block'),
  previous : {},

  /** Extract from viewedBlocksByReferenceAndScope(), the viewed blocks, mapped by the id of their reference block.
   */
  axesBlocks : Ember.computed(
    /* viewedBlocksByReferenceAndScope is a Map, and there is not currently a way to
     * depend on Map.@each, so depend on blockValues.[], which
     * viewedBlocksByReferenceAndScope and blocksByReferenceAndScope depend on,
     * and viewed.[] which viewedBlocksByReferenceAndScope depends on.
     * (same applies in @see viewedBlocksByReferenceAndScope()
     * It is possible that this could be called after a change in viewed, but
     * before viewedBlocksByReferenceAndScope is updated; if this is a problem
     * an update counter could be used as a dependency.
     */
    'block.viewedBlocksByReferenceAndScope.@each', 'blockValues.[]', 'viewed.[]',
    function () {
    let mapByDataset = this.get('block.viewedBlocksByReferenceAndScope');
    let mapByReferenceBlock = {};
    if (mapByDataset)
      for (var [referenceName, mapByScope] of mapByDataset) {
        for (var [scope, blocks] of mapByScope) {
          mapByReferenceBlock[blocks[0].id] = blocks;
          if (true /*trace*/ )
            dLog('axesBlocks', referenceName, scope, blocks.mapBy('_internalModel.__data'));
        }
      }
    dLog('axesBlocks', mapByDataset, mapByReferenceBlock);
    return mapByReferenceBlock;
  }),

  /** Map the keys (blockId) of axesBlocks to the primary or reference block of each axis.
   * @return  array of blocks (store Object)
   */
  axesP : Ember.computed('axesBlocks.@each', 'viewed.[]', function () {
    let axesBlocks = this.get('axesBlocks'),
    axisIDs = Object.keys(axesBlocks),
    axesP = axisIDs.map((axisID) => axesBlocks[axisID][0]);
    dLog('axesP2', axesP, axisIDs);
    return axesP;
  }),

  stacksCount : Ember.computed('block.stacksCount', 'block.viewed', 'axes2d.[]', 'axesP.length', function () {
    let count;
    let previous = this.get('previous.stacks');
    let axesP = this.get('axesP');
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
  axesP_unused : Ember.computed('block.viewed', function () {
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

