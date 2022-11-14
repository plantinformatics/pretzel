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
    this.stackID = stacks.nextStackID-1;

    const cp = DrawStackViewComponent.prototype;
    copyGetter(this, cp, 'portions');
    copyGetter(this, cp, 'positions');
    this.axisIndex = cp.axisIndex;

    /** mix-in selected functions from Stack: */
    const p = Stack.prototype;
    this.calculatePositions = p.calculatePositions;

  }

  //----------------------------------------------------------------------------

  dropIn(axis1d, targetAxis1d, top) {
    const fnName = 'stack:dropIn' + '(axesP)';
    console.log(fnName, axis1d, targetAxis1d, top, this.axes.length);
    logAxis1d(fnName, axis1d);
    logAxis1d(fnName + ' target', targetAxis1d);
    const
    /** if ! top then insert after targetAxis1d */
    insertIndex = this.findIndex(targetAxis1d) + (top ? 0 : 1);
    if (targetAxis1d === -1) {
      console.log(fnName, axis1d, targetAxis1d, this.axes);
    } else {
      this.insert(insertIndex, axis1d);
      /** source stack */
      const stack = axis1d.stack;
      // or Ember_set() when upgrading to Ember 4.
      axis1d.set('stack', this);
      stack.axes.removeObject(axis1d);
      logAxis1d(fnName, axis1d);
      logAxis1d(fnName + ' target', targetAxis1d);
    }
  }
 
  dropOut(axis1d) {
    const fnName = 'stack:dropOut';
    console.log(fnName, axis1d, this.axes.length);
    logAxis1d(fnName, axis1d);
    this.axes.removeObject(axis1d);
    logAxis1d(fnName, axis1d);
    Ember_set(axis1d, 'stack', axis1d.createStackForAxis());
  }

  //----------------------------------------------------------------------------

  findIndex(axis1d) {
    /** or if .axes[] contains axis-1d instead of (reference) block : (a1) => a1 */
    let index = this.axes.findIndex((b) => b.axis1d === axis1d);
    return index;
  }
  remove(index) {
    this.axes = this.axes.removeAt(index, 1);
  }
  insert(insertIndex, axis1d) {
    this.axes.insertAt(insertIndex, axis1d);
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
