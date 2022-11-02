import Component from '@glimmer/component';

import {
  Block,
  Stacked,
  Stack,
  stacks,
  xScaleExtend,
  axisRedrawText,
  axisId2Name
} from '../../utils/stacks';


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



  constructor(axis1d) {
    super(...arguments);

    dLog('stack-view', this);

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

    this.stacks = this.stacksView.stacksNew;
    // parts of : Stack.apply(this, [axis1d]);
    this.stackID = stacks.nextStackID++;
    this.axes = [];
    this.add(axis1d);
  }
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

