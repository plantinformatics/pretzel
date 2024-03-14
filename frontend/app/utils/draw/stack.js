import EmberObject, { set as Ember_set } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import DrawStackViewComponent from '../../components/draw/stack-view';

import {
  Stack,
  stacks,
} from '../../utils/stacks';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

    /** copy getter from source to target object. */
function copyGetter(target, source, propertyName) {
  Object.defineProperty(target, propertyName, {
    get: function() { return Object.getOwnPropertyDescriptor(source, propertyName).get.call(this); }
  });
}

// -----------------------------------------------------------------------------


/**
 * @param axes  [axis-1d, ...]
 * @desc
 * Caller axis-1d : createStackForAxis() sets axis1d.stack to the created object (DrawStackObject - draw/stack).
 */
export default class DrawStackObject extends EmberObject {
  @tracked
  axes;

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    /* createForAxis() passes {axes} to DrawStackObject.create().
     * .get portions (stack-view.js) may be called on this before
     * system/core_object : create() does initialize(instance, props)
     */
    this.axes = [];
    // nextStackID has already been incremented.
    // this.stackID = stacks.nextStackID-1;

    const cp = DrawStackViewComponent.prototype;
    copyGetter(this, cp, 'portions');
    copyGetter(this, cp, 'positions');
    this.axisIndex = cp.axisIndex;

    /** mix-in selected functions from Stack: */
    const p = Stack.prototype;
    this.calculatePositions = p.calculatePositions;
    this.extendedWidth = p.extendedWidth;
    this.sideClasses = p.sideClasses;
    this.location = p.location;
    this.redraw = p.redraw;
    this.redrawAdjacencies = p.redrawAdjacencies;
    this.dataBlocks = p.dataBlocks;
  }

  //----------------------------------------------------------------------------

  /** @param axis1d
   * @return true if this Stack contains axis1d
   * @desc
   * based on Stack.prototype.contains(axisName)
   */
  contains(axis1d) {
    return axis1d.stack === this;
  }


  //----------------------------------------------------------------------------

  log() {
    /**  [] containing string IDs of reference blocks of axes of the Stack.
     * equivalent : stack_axisIDs(this)
     */
    const axisIDs = this.axes.mapBy('referenceBlock.id'); // i.e. axis.id
    console.log(this.stackID, this.stackID, this.stackIndex(), axisIDs);
  }

  //----------------------------------------------------------------------------

  dropIn(event, axis1d, targetAxis1d, top) {
    const fnName = 'stack:dropIn' + '(axesP)';
    dLog(fnName, event.x, axis1d, targetAxis1d, top, this.axes.length);
    logAxis1d(fnName, axis1d);
    logAxis1d(fnName + ' target', targetAxis1d);

    // setup of currentDrop is copied from stacks.js : drop{In,Out}().
    /** Store both the cursor x and the stack x; the latter is used, and seems
     * to give the right feel. */
    const
    oa = this.stacksView.oa,
    o = oa.o,
    anAxisName = targetAxis1d.axisName,
    axisName = axis1d.axisName,
    /** dropX.stack is current / original X position of target stack / targetAxis1d */
    dropX = {event: event.x, stack: oa.o[anAxisName]};
    Stack.currentDrop = {out : false, stack: this, 'axisName': axisName, dropTime : Date.now(), x : dropX};

    const
    /** if ! top then insert after targetAxis1d */
    insertIndex = this.findIndex(targetAxis1d) + (top ? 0 : 1);
    if (targetAxis1d === -1) {
      console.log(fnName, axis1d, targetAxis1d, this.axes);
    } else {
      this.insert(insertIndex, axis1d);
      /** source stack */
      const sourceStack = axis1d.stack;
      // or Ember_set() when upgrading to Ember 4.
      axis1d.set('stack', this);
      sourceStack.removeAxis(axis1d);
      logAxis1d(fnName, axis1d);
      logAxis1d(fnName + ' target', targetAxis1d);
    }
  }
 
  dropOut(axis1d) {
    const fnName = 'stack:dropOut';
    console.log(fnName, axis1d, this.axes.length);
    logAxis1d(fnName, axis1d);

    const
    axisName = axis1d.axisName;
    Stack.currentDrop = {out : true, stack: this, 'axisName': axisName, dropTime : Date.now()};

    this.axes.removeObject(axis1d);
    logAxis1d(fnName, axis1d);
    Ember_set(axis1d, 'stack', axis1d.createStackForAxis());
    this.axisChangesSignal();
  }

  //----------------------------------------------------------------------------

  /** @return .axes[], with .isDestroying components filtered out.
   */
  get liveAxes() {
    return this.axes.filter((a) => ! a.isDestroying);
  }

  stackIndex() {
    return this.stacksView.stackIndex(this);
  }

  /** equivalent : stack-view:axisIndex()
   */
  findIndex(axis1d) {
    /** now .axes[] contains axis-1d instead of (reference) block */
    let index = this.axes.findIndex((axis1d) => axis1d === axis1d);
    return index;
  }
  axisChangesSignal() {
    this.stacksView.incrementProperty('axisChanges');
  }
  remove(index) {
    this.axes.removeAt(index, 1);
    this.axisChangesSignal();
  }
  insert(insertIndex, axis1d) {
    this.axes.insertAt(insertIndex, axis1d);
    this.axisChangesSignal();
  }
  removeAxis(axis1d) {
    this.axes.removeObject(axis1d);
    this.axisChangesSignal();
    // or :
    if (this.axes.length === 0) {
      this.stacksView.removeStack(this);
    }
  }

  //----------------------------------------------------------------------------

}

/**  log the axis scope and scope of siblings on stack */
function logAxis1d(label, axis1d) {
  console.log(
    label,
    axis1d.axis.scope,
    axis1d.stack.axes?.mapBy('axis.scope'));
}
