import Ember from 'ember';
const { inject: { service } } = Ember;

import { /* Block, Stacked, Stack,*/ stacks /*, xScaleExtend, axisRedrawText, axisId2Name*/ } from '../../utils/stacks';

/* global d3 */

export default Ember.Component.extend({
  block: service('data/block'),

  /** @return blocks which correspond to axes, i.e. are not child blocks.  */
  axesP : Ember.computed('block.viewed', function () {
    let blockService = this.get('block');
    let viewedBlocks = blockService.get('viewed');
    let axesPHash = this.get('axesP_initial');
    // console.log('viewedBlocks', viewedBlocks, axesPHash);
    let axesP = viewedBlocks.filter(function (block) {
      let blockId = block.get('id'),
      p = axesPHash[blockId];
      // console.log(block, blockId, p);
      return p !== undefined;
    });
    console.log(axesP);
    return axesP;
  }),

  /** This responds to change of drawMap.stacks but does not update for
   * additions to axesP{} because it is not an Ember.Object.
   */
  axesP_initial : Ember.computed('drawMap.stacks', 'drawMap.stacks.axesP', 'drawMap.stacks.axesP.[]', function () {
    let drawMap = this.get('drawMap'),
    stacks = this.get('drawMap.stacks'), axesP = stacks && stacks.axesP;
    console.log('stacks-view axesP', drawMap, stacks, axesP);
    return axesP;
  })

});

