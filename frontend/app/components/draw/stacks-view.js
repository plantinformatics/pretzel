import { later } from '@ember/runloop';
import EmberObject, { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { A as Ember_A } from '@ember/array';

import { isEqual } from 'lodash/lang';

//------------------------------------------------------------------------------

import {
  /* Block,
  Stacked,
  Stack,
  */ stacks,
  xScaleExtend,
 /*
  axisRedrawText,
  axisId2Name*/
} from '../../utils/stacks';

import DrawStackObject from '../../utils/draw/stack';
import AxisDraw from '../../utils/draw/axis-draw';

import ParentRefn from '../../utils/parent-refn';
import { breakPoint } from '../../utils/breakPoint';
import { checkIsNumber } from '../../utils/domCalcs';

/* global d3 */

//------------------------------------------------------------------------------

const dLog = console.debug;

/** identity function, same comment as in spreadsheet-read.js */
const I = (x) => x;

const trace_stack = 0;

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

/** See comment for blocksHandler().
 * Enclose stacksView with getter for stacks.blocks[]
 */
function blocksHandlerConfig(stacksView) {
  const handlerConfig = {
    /**
     * @return BlockAxisView / block-axis-view.js
     * @param prop axis1d or axisID     
     */
    get(obj, prop) {
      const
      fnName = 'blocksHandler';
      let blockView;
      if (typeof prop === 'string') {
        const
        blockId = prop,
        ab = stacksView.axesByBlockId[blockId],
        block = ab?.block;
        blockView = block.view;
      } else {
        const
        axis1d = prop,
        block = axis1d.axis; // stacksView.block.peekBlock(blockId),
        blockView = block.view;
      }
      // console.log(fnName, /*blockId,*/ prop, blockView);
      return blockView;
    },
  };
  return handlerConfig;
}

/** See comment for axesHandler().
 */
function axesHandlerConfig(stacksView) {
  const handlerConfig = {
    /**
     * @return axis-1d
     * @param prop axisID
     */
   get(obj, prop) {
    const
     fnName = 'axesHandler',
     axisID = prop,
     ab = stacksView.axesByBlockId[axisID],
     axis1d = ab.axis1d;
     // dLog(fnName, axisID, axis1d);
     return axis1d;
   },
  };
  return handlerConfig;
}


//------------------------------------------------------------------------------

export default Component.extend({
  block: service('data/block'),
  previous : {},

  stacksTemp : alias('block.viewed'),  // axis1dReferenceBlocks

  stacks : Ember_A(), // alias('stacksTemp'),  // stacksOld

  /** counter, incremented to signal changes in stacks[*].axes[]  */
  axisChanges : 0,

  nextStackID : 0,

  // ---------------------------------------------------------------------------

/*
  didRender() {
    this._super.apply(this, arguments);
  },
*/

  //----------------------------------------------------------------------------

  init() {
    this._super(...arguments);

    this.oa.stacks.axesP = new Proxy({}, this.axesHandler);
    this.stacks.blocks = new Proxy({}, this.blocksHandler);
    this.stacks.sortLocation = this.oa.stacks.sortLocation;
    this.stacks.log = this.oa.stacks.log;

    const axisApi = this.oa.axisApi;
    axisApi.stacksView = this;
    axisApi.collateO = () => this.collateO();
    axisApi.updateXScale = () => this.updateXScale();
  },

  //----------------------------------------------------------------------------

  /** Handle : stacks.blocks[axisID], after element data changes from axisID to axis1d.
   */
  blocksHandler : computed( function() {
    return blocksHandlerConfig(this);
  }),

  /** Maintain oa.axes[] as a facade, to smooth the transition away from draw_orig.
   */
  axesHandler : computed( function() {
    return axesHandlerConfig(this);
  }),

  // ---------------------------------------------------------------------------

  axisDraw : computed( function () {
    return new AxisDraw(this.oa, /*axis1d*/null, this.stacks, this);
  }),

  draw() {
    this.axisDraw.draw();
  },

  // ---------------------------------------------------------------------------

  stacks_orig : alias('oa.stacks'),

  axesViewedEffect : computed(
    // /*'block.axesViewedBlocks2'*/'axes1d.axesP.[]',
    'stacks.[]', 'newStacks', 'axisChanges',
    'stacks_orig.changed',
    function() {
      const fnName = 'axesViewedEffect' + ' (axesP)';
      this.updateStacksAxes();
      console.log(fnName, 'stacks', this.stacks .mapBy('axis1d.axis.scope'), this.newStacks .mapBy('axis1d.axis.scope'));
      let stacks = this.stacks;
      if (this.newStacks?.length) {
        /* not currently using .newStacks <Draw::StackView ... registerStackView >
         * so concat to .stacks here in lieu of
         *   registerStackView() : this.stacks[arrayObjectFn](stack);
         */
        stacks.addObjects(this.newStacks);
      }
      if (! this.xScaleContainsAxes()) {
        this.updateXScale();
      }
      this.collateO();
      // this.updateStacksAxes();
      if (this.yScalesAreDefined) {
        this.draw();
      } else {
        const {availableMapsTask /*datasetsTask*/, blocksLimitsTask} = this.model;
        (blocksLimitsTask || availableMapsTask).then(() => {
          if (this.yScalesAreDefined) {
            this.draw();
          } else {
            dLog(fnName, 'not yScalesAreDefined', 'blocksLimitsTask', blocksLimitsTask);
            later(() => this.draw(), 10000);
          } 
        });
      }
      return stacks;
  }),

  /** @return true if y scales of all axes are defined.
   */
  get yScalesAreDefined() {
    const
    yScales = this.axes().mapBy('yScaleIsDefined'),
    incomplete = yScales.any((y) => !y);
    return ! incomplete;
  },

  // ---------------------------------------------------------------------------

  /**
   * @param stack empty, i.e. stack.axes.length === 0
   */
  removeStack(stack) {
    this.stacks.removeObject(stack);
  },
  updateStacksAxes() {
    const fnName = 'updateStacksAxes';

    /** remove un-viewed axes, and then remove empty stacks. */
    let stacks = this.stacks;
    stacks.forEach((s) => this.removeUnViewedAxes(s.axes));
    // s.isDestroying() || 
    const emptyStacks = stacks
          .filter((s) => ! s.axes.length);
    if (emptyStacks.length) {
      console.log(fnName, emptyStacks, stacks);
    }
    this.stacks.removeObjects(emptyStacks);

    dLog(fnName, stacks, emptyStacks, 'newStacks', this.newStacks);
    // this.stacks.pushObjects(newStacks);

    /* .stackViews were created / destroyed via hbs, .stacks are not yet destroyed. */
    arrayRemoveDestroyingObjects(this.stacks);

    if (emptyStacks.length || this.newStacks.length) {
      this.stacksAdjust();
    }
  },
  stacksAdjust() {
      const axisApi = this.oa.axisApi;
      axisApi.stacksAdjust(true, /*t*/ undefined);
  },
  newStacks : computed('newAxis1ds', function () {
    const fnName = 'newStacks';
    /** Add stacks for axis-1d which do not have .stack */
    
    const
    newAxis1ds = this.newAxis1ds,
    /* not : this.store.createRecord() because multi-store in axis. */
    newStacks = newAxis1ds.map((a1) => a1.createStackForAxis());
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


  /** may use this as a library utility;
   * depends on :  stackViews : Ember_A(),
   * which is now removed from this component.
   */
  // @action
  registerStackView(stackView, start) {
    console.warn('registerStackView', 'not used');
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

  //----------------------------------------------------------------------------

  // not used
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

  /** Create a stack for axis1d. */
  createStackForAxis(axis1d) {
    const fnName = 'createStackForAxis' + ' (axesP)';
    const stackID = this.nextStackID++;
    let s = DrawStackObject.create({
      stackID,
      axes : [axis1d],
      stacksView : this,
      /* stacks, */
    });
    axis1d.set('stack', s); // or Ember_set()
    this.stacks.addObject(s);
    console.log(fnName, s);
    return s;
  },

  //----------------------------------------------------------------------------

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

  //----------------------------------------------------------------------------

  stackIndex(stack) {
    const stackIndex = this.stacks.indexOf(stack);
    return stackIndex;
  },

  //----------------------------------------------------------------------------

  /** [blockId or axisID] -> {axis1d, model:block}  */
  axesByBlockId : {},
  /** Record the most recent assignment of blocks to an axis1d.
   */
  blocksInAxis(axis1d, blocks) {
    const refId = axis1d.axisName;
    blocks?.forEach((block) => {
      this.axesByBlockId[block.id] = {axis1d, block};
    });
  },
  /** Possible replacement for Stacked.getAxis(axisID).
   * Install via : init() : Stacked.getAxis = this.getAxis;
   */
  getAxis(blockId) {
    let found = this.axesByBlockId[blockId];
    return found?.axis1d;
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
  blockIDs : stacks.blockIDs,
  sortLocation : stacks.sortLocation,
  x : stacks.x,

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

  axes() {
    return this.stacks.mapBy('axes').flat();
  },
  axisIDs() {
    return this.stacks.mapBy('axes').flat().mapBy('axisName');
  },

  xScaleContainsAxes() {
    const
    scaleDomain = this.oa.xScaleExtend?.domain(),
    axisIDs = this.axisIDs(),
    notContains = axisIDs.length && (
      ! scaleDomain ||
        (scaleDomain.length !== axisIDs.length) ||
        (axisIDs.find((aid) => ! scaleDomain.includes(aid))));
    return ! notContains;
  },

  /** For all Axes, store the x value of its axis, according to the current scale. */
  collateO() {
    const
    fnName = 'collateO',
    oa = this.oa,
    me = oa.eventBus,
    stacks = this.stacks,
    x = this.x;
    // if (me.isDestroying) { return; }
    dLog(fnName, stacks.length, stacks.mapBy('axes.length'), this.axisIDs());
    stacks.mapBy('axes').flat().forEach(function(axis){
      let o = oa.o;
      const
      d = axis.axisName,
      xa = x(axis);
      if (trace_stack > 1)
        console.log(d, axis.longName(), o[d], xa);
      if (xa === undefined) {
        // breakPoint(fnName);
      } else {
        checkIsNumber(xa);
        o[d] = xa;
      }
    });
    /** scaled x value of each axis, with its axisID. */
    let offsetArray = this.axisIDs().map((d) => ({axisId : d, xOffset : oa.o[d]}));
    let previous = me.get('xOffsets'),
        changed = ! isEqual(previous, offsetArray);
    if (changed) {
      me.set('xOffsets', offsetArray);
      me.incrementProperty('xOffsetsChangeCount');
    }
  },

  /** Update the X scale / horizontal layout of stacks
   */
  updateXScale()
  {
    // xScale() uses stacks.keys().
    this.oa.xScaleExtend = xScaleExtend(this.stacks); // or xScale();
  },

  //----------------------------------------------------------------------------


});

