import { later } from '@ember/runloop';
import EmberObject, { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { A as Ember_A } from '@ember/array';

import DrawStackModel from '../../models/draw/stack';

import {
  /* Block,
  Stacked,
  Stack,
  */ stacks /*,
  xScaleExtend,
  axisRedrawText,
  axisId2Name*/
} from '../../utils/stacks';

/* global d3 */

const dLog = console.debug;


export default Component.extend({
  block: service('data/block'),
  previous : {},

  stacksTemp : alias('block.viewed'),  // axis1dReferenceBlocks

  stacks : Ember_A(), // alias('stacksTemp'),  // stacksOld

  // ---------------------------------------------------------------------------

/*
  didRender() {
    this._super.apply(this, arguments);
  },
*/

  // ---------------------------------------------------------------------------

  axesViewedEffect : computed('block.axesViewedBlocks2', function() {
    this.updateStacksAxes();
    return this.stacks;
  }),

  // ---------------------------------------------------------------------------

  updateStacksAxes() {
    const fnName = 'updateStacksAxes';

    /** remove un-viewed axes, and then remove empty stacks. */
    let stacks = this.stacks;
    stacks.forEach((s) => this.removeUnViewedAxes(s.axes));
    this.stacks = stacks
      .filter((s) => s.axes.length);

    /** Add stacks for axis-1d which do not have .stack */
    /** check which of the viewed reference blocks have an axis-1d & stack-view. */
    const
    map = this.get('block.axesViewedBlocks2'),
    blocks = Array.from(map.keys())
    // .filter((b) => b.isViewed && ! b?.axis1d), // old : ?.axis
      .filter((b) => b.isViewed && ! b?.axis1dR?.stack),
    /* not : this.store.createRecord() because multi-store in axis.
     *   maybe move DrawStackModel to utils as extend EmberObject.  */
    newStacks = blocks.map((b) => this.createForReference(b));
    dLog(fnName, stacks, map, blocks, newStacks);
    this.stacks.pushObjects(newStacks);
  },
  /** Create a stack for a given reference block. */
  createForReference(block) {
    let s = EmberObject.create({axes : [block]});
    /** block.axis1d is currently a CP for stacks.js;  planning to replace with
     * this .axis1dR, which can then be renamed. */
    if (! block.axis1dR) {
      dLog('createForReference', 'no .axis1dR', block);
    } else {
      block.axis1dR.stack = s;
    }
    return s;
  },
  /** remove axes from the array which are no longer viewed.
   * The array is modified in-situ via .removeObjects().
   * @param axes  axis-1d[] from stack.axes
   * contains reference blocks
   */
  removeUnViewedAxes(axes) {
    const unviewed = axes.filter((b) => b.isDestroying || ! b?.isViewed);
    axes.removeObjects(unviewed);
  },

  // ---------------------------------------------------------------------------

    //dLog('stacks-view', this);
    /** mix-in selected functions from Stack:
     * (replace-regexp "\\(stacks.\\)\\(.+\\) = function.*" "  \\2 : \\1\\2,")
    */

  stacks_init : stacks.init,
  append : stacks.append,
  insert : stacks.insert,
  stackIDs : stacks.stackIDs,
  axisIDs : stacks.axisIDs,
  blockIDs : stacks.blockIDs,
  sortLocation : stacks.sortLocation,


  // ---------------------------------------------------------------------------

  axes1d : alias('block.axes1d'),
  /** Collate a mapping from stackID to its array of axis1d.
   * (using view.axis.stack is interim;  also record order of axes in a stack)
   */
  stacksAxis1d : computed('axes1d.axis1dArray.[]', function () {
    const
    a1a = this.axes1d.axis1dArray,
    sa = a1a.reduce((result, axis1d) => {
      let stackID = axis1d.get('axis.view.axis.stack.stackID');
      if (stackID !== undefined) {
        let a = result[stackID] || (result[stackID] = []);
        a.push(axis1d);
      }
      return result;
    }, {});
    return sa;
  }),



  // ---------------------------------------------------------------------------


  stacksCount : computed('block.stacksCount', 'block.viewed', 'axes2d.[]', 'axesP.length', function () {
    let count;
    let previous = this.get('previous.stacks');
    let axesP = this.get('axesP');
    count = this.get('block.stacksCount');
    dLog('stacks', count, stacks);
    dLog(stacks, stacks.axesPCount, 'stacksCount', stacks.stacksCount);
    if (count != previous) {    // may not be needed
      this.set('previous.stacks', count);
      later(function () {
        stacks.oa.showResize(true, false); });
      this.get('drawMap').draw({}, 'dataReceived');
      stacks.oa.axisApi.stacksAxesDomVerify();
    }
    return count;
  }),

  // ---------------------------------------------------------------------------

});

