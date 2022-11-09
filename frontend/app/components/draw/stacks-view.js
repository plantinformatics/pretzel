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

import ParentRefn from '../../utils/parent-refn';

/* global d3 */

//------------------------------------------------------------------------------

const dLog = console.debug;

/** identity function, same comment as in spreadsheet-read.js */
const I = (x) => x;

//------------------------------------------------------------------------------

/** Remove from array, objects which are .isDestroying().
 * @param array of Ember Objects, either classic or Octane
 */
function arrayRemoveDestroyingObjects(array) {
  const destroyingObjs = array.filter((o) => isDestroying(o));
  array.removeObjects(destroyingObjs);
}

/** Evaluate objects.isDestroying, which may be a function (classic) or boolean (Octane)
 * @param object Ember Object
 */
function isDestroying(object) {
  const yes = (typeof object.isDestroying === 'boolean') ? object.isDestroying : object.isDestroying();
  return yes;
}

//------------------------------------------------------------------------------

export default Component.extend({
  block: service('data/block'),
  previous : {},

  stacksTemp : alias('block.viewed'),  // axis1dReferenceBlocks

  stacks : Ember_A(), // alias('stacksTemp'),  // stacksOld
  stackViews : Ember_A(),

  // ---------------------------------------------------------------------------

/*
  didRender() {
    this._super.apply(this, arguments);
  },
*/

  // ---------------------------------------------------------------------------

  axesViewedEffect : computed(
    // /*'block.axesViewedBlocks2'*/'axes1d.axesP.[]',
    'stacks.[]', 'newStacks',
    function() {
      const fnName = 'axesViewedEffect' + ' (axesP)';
      this.updateStacksAxes();
      console.log(fnName, 'stacks', this.stacks .mapBy('axis1d.axis.scope'), this.newStacks .mapBy('axis1d.axis.scope'));
      let stacks = this.stacks.concat(this.newStacks || []);
      return stacks;
  }),

  // ---------------------------------------------------------------------------

  updateStacksAxes() {
    const fnName = 'updateStacksAxes';

    /** remove un-viewed axes, and then remove empty stacks. */
    let stacks = this.stacks;
    stacks.forEach((s) => this.removeUnViewedAxes(s.stackView.axes));
    // s.stackView.isDestroying() || 
    const emptyStacks = stacks
          .filter((s) => ! s.stackView.axes.length);
    if (emptyStacks.length) {
      console.log(fnName, emptyStacks, stacks);
    }
    this.stacks.removeObjects(emptyStacks);

    dLog(fnName, stacks, emptyStacks, 'newStacks', this.newStacks);
    // this.stacks.pushObjects(newStacks);

    arrayRemoveDestroyingObjects(this.stackViews);
  },
  newStacks : computed('newAxis1ds', function () {
    const fnName = 'newStacks';
    /** Add stacks for axis-1d which do not have .stack */
    
    const
    newAxis1ds = this.newAxis1ds,
    /* not : this.store.createRecord() because multi-store in axis.
     *   maybe move DrawStackModel to utils as extend EmberObject.  */
    newStacks = newAxis1ds.map((a1) => this.createForAxis(a1));
    dLog(fnName, '(axesP)', newAxis1ds, stacks, newStacks);
    return newStacks;
  }),
  newAxis1ds : computed('axes1d.axis1dArray.[]', function () {
    const fnName = 'newAxis1ds';
    let newAxis1ds = (this.get('axes1d.axis1dArray') ?? [])
      .filter((axis1d) => ! axis1d.stack);
    console.log(fnName, '(axesP)', newAxis1ds, this.get('axes1d.axis1dArray'));
    return newAxis1ds;
  }),
  /** Same purpose as newAxis1ds, but result lags, because block without
   * .axis1dR is filtered out.
   */
  newAxis1ds_late : computed( function () {
    const fnName = 'newAxis1ds_late';
    /** check which of the viewed reference blocks have an axis-1d & stack-view. */
    let blocks;

        if (false) {
    const
      map = this.get('block.axesViewedBlocks2');
    /** viewed blocks without stacks */
      blocks = Array.from(map.keys());
    } else {
      blocks = this.axes1d?.axesP ?? [];
    }
    const
    newAxis1ds = blocks
    // .filter((b) => b.isViewed && ! b?.axis1d), // old : ?.axis
      .filter((b) => b.isViewed && ! b?.axis1dR?.stack)
      .mapBy('axis1d')
      .filter(I);
      dLog(fnName, blocks);
    return newAxis1ds;
  }),


  // @action
  registerStackView(stackView, start) {
    // modify this.stacks[] after render because it is used in .hbs
    later(() => {
      const fnName = 'registerStackView';
      console.log(fnName, stackView, start);
      const stack = stackView.args.stack;
      if (! start && stackView.axes.length) {
        console.warn(fnName, start, stackView.axes.length);
      }
      const stackIndex = this.stackViews.indexOf(stackView);
      if (start !== (stackIndex === -1)) {
        console.warn(fnName, start, stackIndex, this.stackViews);
      }
      if (! start || ! stack.stackView) {
        const
        stackViews = this.stackViews,
        arrayObjectFn = start ? 'addObject' : 'removeObject';
        stackViews[arrayObjectFn](stackView);
        this.stacks[arrayObjectFn](stack);
        console.log(
          fnName, '(axesP)',
          stackView.args.stack.axis1d.axis.scope,
          this.stacks.length, stackViews.length,
          this.stacks.mapBy('axis1d.axis.scope'),
          stackViews.mapBy('args.stack') .mapBy('axis1d.axis.scope'),
          stackView, start);
        stack.stackView = stackView;
        stackView.stacksView = this;
      }
    });
  },
  /** Create a stack for a given reference block. */
  createForReference(block) {
    let s = EmberObject.create({block /*,axes : [block]*/});
    /** block.axis1d is currently a CP for stacks.js;  planning to replace with
     * this .axis1dR, which can then be renamed. */
    if (! block.axis1dR) {
      dLog('createForReference', 'no .axis1dR', block);
    } else {
      block.axis1dR.stack = s;
    }
    return s;
  },
  /** Create a stack for a given axis-1d. */
  createForAxis(axis1d) {
    let s = EmberObject.create({axis1d /*,axes : [axis1d]*/});
    axis1d.stack = s;
    return s;
  },
  /** remove axes from the array which are no longer viewed.
   * The array is modified in-situ via .removeObjects().
   * @param axes  axis-1d[] from stack.axes
   * contains reference blocks
   */
  removeUnViewedAxes(axes) {
    const fnName = 'removeUnViewedAxes';
    const unviewed = axes.filter((axis1d) => axis1d.isDestroying || ! axis1d.axis?.isViewed);
    if (unviewed.length) {
      console.log(fnName, unviewed, axes);
    }
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

