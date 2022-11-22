import Evented from '@ember/object/evented';
import Component from '@ember/component';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';

import AxisEvents from '../../utils/draw/axis-events';

import { _internalModel_data,  blockInfo } from '../../utils/ember-devel';

/* global d3 */

import {
  axisFeatureCircles_removeBlock,
}  from '../../utils/draw/axis';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

/** AxisEvents is commented out here - not currently required because axis-1d.js
 * registers for events using AxisEvents, filtering by matching axisID.
 * Planning to use AxisEvents here and propagate to just those matching axes.
 */
export default Component.extend(Evented, /*AxisEvents,*/ {
  block : service('data/block'),
  selected : service('data/selected'),

  menuAxis : computed.alias('drawMap.menuAxis'),

  /*--------------------------------------------------------------------------*/

  init() {
    this._super(...arguments);

    this.get('block').set('axes1d', this);
    this.set('axis1dArray', Ember.A());

    const axisApi = this.drawMap.oa.axisApi;
    axisApi.selectedFeatures_removeAxis = this.selectedFeatures_removeAxis.bind(this);
    axisApi.selectedFeatures_removeBlock = this.selectedFeatures_removeBlock.bind(this);
  },

  /*--------------------------------------------------------------------------*/

  /** Maintain a list of child axis-1d components, .axis1dArray
   */
  axis1dExists(axis1d, exists) {
    const fnName = 'axis1dExists' + '(axesP)';
    let axis1dArray = this.get('axis1dArray');
    dLog(fnName, axis1d, axis1dArray);
    let i = axis1dArray.indexOf(axis1d);
    if (exists && (i === -1)) {
      /** since (i === -1) here we can use pushObject(); addObject() can be
       * used without checking indexOf().  */
      axis1dArray.pushObject(axis1d);
      dLog(fnName, ' pushed', axis1d, axis1dArray);
    } else if (! exists && (i !== -1)) {
      axis1dArray.removeAt(i, 1);
      dLog(fnName, ' removed', axis1d, i, axis1dArray);
    }
  },

  /** @return the axis-1d components, which are child components of this
   * component, distinguished by having a .axis attribute.  */
  axis1dArrayCP : computed('axesP.[]', function () {
    let axes1d = this.get('childViews')
        .filter((a1) => ! a1.isDestroying && a1.axis);
    dLog('axis1dArray', axes1d);
    return axes1d;
  }),

  /*--------------------------------------------------------------------------*/

  /** Match axis-1d using dataset name and scope; this can match with axes of
   * any server.
   * @param datasetId block.get('datasetId.id')
   * @param scope block.get('scope')
   * @return axis-1d
   */
  datasetIdScope2axis1d(datasetId, scope) {
    const fnName = 'datasetIdScope2axis1d';
    let 
    axis1d = this.axis1dArray.find((a1) => {
      let
      a1Block = a1.axis,
      match = (a1.axis.get('datasetId.id') === datasetId) && 
        (a1Block.get('scope') === scope);
      return match;
    });
    dLog(fnName, datasetId, scope, axis1d);
    return axis1d;
  },

  // ---------------------------------------------------------------------------

  /** axes-1d receives axisStackChanged from draw-map and
   * (todo) propagates it to its children
   */
  axisStackChanged : function() {
    dLog("axisStackChanged in components/axes-1d");
  },

  /** @param [axisID, t] */
  zoomedAxis : function(axisID_t) {
    dLog("zoomedAxis in components/axes-1d", axisID_t);
  },

  /*--------------------------------------------------------------------------*/

  blockValues : alias('block.blockValues'),
  viewed : alias('block.viewed'),

  // ---------------------------------------------------------------------------

  /** Extract from viewedBlocksByReferenceAndScope(), the viewed blocks, mapped by the id of their reference block.
   */
  axesBlocks : computed(
    // 'block.viewedBlocksByReferenceAndScopeUpdateCount',
    /* depending on blockValues.[] and .viewed[] seems to cause :
     * Uncaught TypeError: Cannot read property 'count' of undefined
     * at ChainNode.unchain (ember-metal.js:1976) ... removeDependentKeys()
     * So instead, depend on .viewedBlocksByReferenceAndScopeUpdateCount.
     */
    /* viewedBlocksByReferenceAndScope is a Map, and there is not currently a way to
     * depend on Map.@each, so depend on blockValues.[], which
     * viewedBlocksByReferenceAndScope and blocksByReferenceAndScope depend on,
     * and viewed.[] which viewedBlocksByReferenceAndScope depends on.
     * (same applies in @see viewedBlocksByReferenceAndScope()
     * It is possible that this could be called after a change in viewed, but
     * before viewedBlocksByReferenceAndScope is updated; if this is a problem
     * an update counter could be used as a dependency.
     */
    'block.viewedBlocksByReferenceAndScope', // .@each 'blockValues.[]', 'viewed.[]',
    function () {
    let mapByDataset = this.get('block.viewedBlocksByReferenceAndScope');
    let mapByReferenceBlock = {};
    if (mapByDataset)
      for (var [referenceName, mapByScope] of mapByDataset) {
        for (var [scope, blocks] of mapByScope) {
          /**  referenceBlock, undefined if the currently connected servers do
           *  not have a parent matching the child dataset's .parentName */
          if (blocks[0]) {
            /** as in viewedReferenceBlock(), filter out blocks which are not viewed.
             * As a more maintainable solution, planning to change the structure
             * of blocksByReferenceAndScope from blocks[] (with reference block
             * at block[0]) to {reference : [], data : [], both : []}; this is
             * driven by multiple servers enabling multiple reference blocks in
             * a single datasetName/scope/.
             * This is used by axesP() before the block is viewed,
             * so include reference which is not viewed.
             *
             * That may include both a local and secondary reference, where the
             * local reference is not viewed, so prefer the viewed reference
             * .id for mapByReferenceBlock[] index.
             */
            blocks = blocks.filter((b) => b.get('isViewed') || ! b.get('isData'));
            const
            referenceBlocks = blocks.filterBy('isReferenceForAxis', true)
              .sortBy('isViewed'),
            referenceBlock = referenceBlocks.length && referenceBlocks[referenceBlocks.length-1];
            mapByReferenceBlock[referenceBlock.id] = blocks;
            if (true /*trace*/ )
              dLog('axesBlocks', referenceName, scope, blocks.mapBy(_internalModel_data));
          }
        }
      }
    dLog('axesBlocks', '(axesP)', mapByDataset, mapByReferenceBlock);
    return mapByReferenceBlock;
  }),

  /** Map the keys (blockId) of axesBlocks to the primary or reference block of each axis.
   * @return  array of blocks (store Object)
   */
  axesP : computed('axesBlocks', 'stacks.axesPCount', 'viewed.[]', function () {
    /* dependency on axesBlocks.@each would be preferred if possible, but it is a hash not an array.
     * in lieu of that, use stacks.axesPCount
     */
    let axesBlocks = this.get('axesBlocks'),
    axisIDs = Object.keys(axesBlocks),
    axesP = axisIDs.map((axisID) => {
      let blocks = axesBlocks[axisID],
      block;
      if (blocks.length === 1) {
        /** Originally data blocks were shown on their own axis until their
         * reference block was viewed; this will cause an axis-1d to be created
         * briefly for them, which currently causes the block to not refer to an
         * axis-1d.  Instead just wait for the reference to be viewed; if viewed
         * via the GUI the reference is viewed first.
         * Now that 2-level parent is possible, e.g. QTL block -> markers -> assembly,
         * blocks[] may be a single block which is a reference and has a reference.
         */
        if (! blocks[0].referenceBlock) {
          block = blocks[0];
        }
      }
      else if (blocks.length > 1) {
        let original = blocks.filter((b) => !b.get('isCopy'));
        if (original.length) {
          block = original[0];
          if (original.length > 1) {
            let originalReferences = original.filter((b) => !b.get('isData'));
            if (originalReferences.length == 1) {
              block = originalReferences[0];
            } else if (originalReferences.length > 1) {  // not expected to happen
              const
              /** as in axesBlocks(), prefer the viewed reference */
              referenceBlocks = originalReferences.sortBy('isViewed'),
              referenceBlock = referenceBlocks.length && referenceBlocks[referenceBlocks.length-1];
              block = referenceBlock;
              dLog('axesP', axisID, 'choosing', block.id, 'from', originalReferences.map(blockInfo));
            } else {
              dLog('axesP', axisID, 'no original reference, choosing [0] from', original.map(blockInfo));
            }
          }
        }
        else {
          dLog('axesP', axisID, 'no original, choosing [0] from', blocks.map(blockInfo));
          block = blocks[0];
        }
      }
      return block;
    })
    .filter((b) => b);
    dLog('axesP2', axesP, axisIDs);
    return axesP;
  }),

  // ---------------------------------------------------------------------------



  /** When an axis is deleted, it is removed from selectedAxes and its features are removed from selectedFeatures.
   * Those features may be selected in another axis which is not deleted; in
   * which case they should not be deleted from selectedFeatures, but this is
   * quicker, and may be useful.
   * Possibly versions of the app did not update selectedAxes in some cases, e.g. when zooms are reset.
   */
  selectedFeatures_removeAxis(axisName, mapChrName)
  {
    const
    selectedAxes = this.get('selected.selectedAxes'),
    selectedFeatures = this.selected.selectedFeatures;
    selectedAxes.removeObject(axisName);
    axisFeatureCircles_removeBlock(selectedFeatures, mapChrName);
    let p = mapChrName; // based on brushHelper()
    delete selectedFeatures[p];
  },
  /** @param blockS stacks Block */
  selectedFeatures_removeBlock(blockS)
  {
    let
    selectedFeatures = this.selected.selectedFeatures,
    mapChrName = blockS?.block?.brushName;
    axisFeatureCircles_removeBlock(selectedFeatures, mapChrName);
    /** axisFeatureCircles_removeBlock() uses selectedFeatures[mapChrName], so
     * call it before the following which filters that.  */
    if (selectedFeatures[mapChrName]) {
      selectedFeatures[mapChrName] = selectedFeatures[mapChrName]
        .filter((f) => f.get('blockId.id') !== blockS.block.id);
    }
  }

  // ---------------------------------------------------------------------------


});
