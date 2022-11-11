import Component from '@glimmer/component';

import { tracked } from '@glimmer/tracking';

import {
  Block,
  Stacked,
  Stack,
  stacks,
  xScaleExtend,
  axisRedrawText,
  axisId2Name
} from '../../utils/stacks';

import DrawStackObject from '../../utils/draw/stack';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default class DrawStackViewComponent extends Component {

  static currentDrop = undefined;
  /** example values :
   *    {out : false, stack: this, 'axisName': axisName, dropTime : Date.now(), x : dropX};
   *    {out : true, stack: this, 'axisName': axisName, dropTime : Date.now()};
  */
  static currentDrag = undefined;


  @tracked
  axes;

  constructor(app, args) {
    const axis1d = args.stack.axis1d;
    super(...arguments);

    dLog('stack-view', this);

    this.axes = [];

    /** mix-in selected functions from Stack:
     *  (replace-regexp "^\\([a-z].*\\)" "    this.\\1 = p.\\1;")
     *  (replace-string "Stacked.prototype" this)
     */
    const p = Stack.prototype;

    /*
    this.childAxisNames = p.childAxisNames;
    this.childAxisNamesGrouped = p.childAxisNamesGrouped;
    */
    this.childBlocks = p.childBlocks;
    this.dataBlocks = p.dataBlocks;
    this.dataBlocks0 = p.dataBlocks0;
    this.empty = p.empty;
    this.parentAxes = p.parentAxes;
    this.parentAxisIDs = p.parentAxisIDs;
    this.parentAxesCount = p.parentAxesCount;
    this.axisIDs = p.axisIDs;
    this.toString = p.toString;
    this.log = p.log;
    this.logElt = p.logElt;
    this.verify = p.verify;
    this.location = p.location;
    this.stackIndex = p.stackIndex;
    this.keyFunction = p.keyFunction;
    this.sideClasses = p.sideClasses;
    this.add = p.add;  // Stack_add;
    this.addAxis = p.addAxis;
    this.insert = p.insert;
    this.findIndex = p.findIndex;
    this.remove = p.remove;
    this.remove2 = p.remove2;
    this.removeStacked1 = p.removeStacked1;
    this.delete = p.delete;
    this.move = p.move;
    this.shift = p.shift;
    this.contains = p.contains;
    this.dropIn = p.dropIn;
    this.releasePortion = p.releasePortion;
    this.dropOut = p.dropOut;
    this.calculatePositions = p.calculatePositions;
    this.axisTransform = p.axisTransform;
    this.axisTransformO = p.axisTransformO;
    this.redraw = p.redraw;
    this.redrawAdjacencies = p.redrawAdjacencies;
    this.extendedWidth = p.extendedWidth;

    // this.stacks = this.args.stacksView.stacksNew;  // stacksTemp, stacksOld ?
    // parts of : Stack.apply(this, [axis1d]);
    this.stackID = stacks.nextStackID++;
    this.add(axis1d);

    const sp = DrawStackObject.prototype;
    this.dropIn = sp.dropIn;
    this.dropOut = sp.dropOut;
    this.findIndex = sp.findIndex;
    this.remove = sp.remove;
    this.insert = sp.insert;

    this.args.register?.(this, true);
    // this.stacksView.stackViews.addObject(this);
    /* in lieu of : onDestroy() { this.stacksView.stackViews.removeObject(this); }
     *   or 
     * stacks-view : updateStacksAxes() : arrayRemoveDestroyingObjects(this.stackViews)
     */
  }
  willDestroy() {
    console.log(
      'willDestroy', '(axesP)', this,
      this.args.stack.axis1d.axis.scope,
      // ['stacksView', 'stack', 'register']
      Array.from(Object.entries(this.args)).flat(),
      // ['axis1d', 'stackView']
      Array.from(Object.entries(this.args.stack)).flat() );
    this.args.register?.(this, false);
  }

  //----------------------------------------------------------------------------

  get portions() {
    const fnName = 'portions' + '(axesP)';
    const length = this.axes?.length;
    let portions = [];
    if (length) {
      const portion = 1 / length;          
    for (let i=0; i < length; i++) {
      portions[i] = portion;
      // used by  Stack.prototype.calculatePositions()
      // this.axes[i].portion = portion;
    }
    console.log(fnName, portions, this.axes.mapBy('axis.scope'));
    }
    return portions;
  }
  get positions() {
    /** used by calculatePositions() */
    const portions = this.portions;
    return this.calculatePositions();
  }

  axisIndex(axis1d) {
    let i = this.axes.indexOf(axis1d);
    return i;
  }

  //----------------------------------------------------------------------------
}

// from fgrep Stack $MMVp.A1/frontend/app/utils/stacks.js | fgrep -v .prototype
//  (replace-regexp "^Stack.\\(.+\\) = function (.*"  "    DrawStackViewComponent.\\1 = Stack.\\1;")
DrawStackViewComponent.log = Stack.log;
DrawStackViewComponent.verify = Stack.verify;
DrawStackViewComponent.axisStackIndex = Stack.axisStackIndex;
DrawStackViewComponent.axisStackIndex2 = Stack.axisStackIndex2;
DrawStackViewComponent.removeStacked = Stack.removeStacked;
DrawStackViewComponent.axisStack = Stack.axisStack;
DrawStackViewComponent.axisStackIndexAll = Stack.axisStackIndexAll;

