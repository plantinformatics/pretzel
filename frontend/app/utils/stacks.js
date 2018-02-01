/*global d3 */

/*----------------------------------------------------------------------------*/

import { round_2, checkIsNumber} from '../utils/domCalcs';
import {  Axes, yAxisTextScale,  yAxisTicksScale,  yAxisBtnScale, eltId, axisEltId, highlightId  }  from './draw/axis';

/*----------------------------------------------------------------------------*/

const trace_stack = 1;
const trace_updatedStacks = true;

/** Each stack contains 1 or more Axis Pieces (APs).
 * stacks are numbered from 0 at the left.
 * stack[i] is an array of Stack, which contains an array of Stacked,
 * which contains apID & portion.
 */
var stacks = [];
//- can pass to init() just the required values, instead of oa : o, x, >
var oa;
/** Ownership of this may move to data component. */
var aps;

//- maybe change stacks to a class Stacks(), and instantiate wth new Stacks(oa)
/** also vc is copied to stacks.
*/
stacks.init = function (oa_)
{
  if (stacks.oa === undefined)
  {
    oa = stacks.oa = oa_;

    /** Give each Stack a unique id so that its <g> can be selected. */
    stacks.nextStackID = 0;

    aps =
      /** Reference to all (Stacked) APs by apName.
       */
      stacks.aps = {};
  }
}


/*----------------------------------------------------------------------------*/

function Stacked(apName, portion) {
  this.apName = apName;
  this.mapName = oa.cmName[apName].mapName;  // useful in devel trace.
  /** Portion of the Stack height which this AP axis occupies. */
  this.portion = portion;
  // The following are derived attributes.
  /** .position is accumulated from .portion.
   * .position is [start, end], relative to the same space as portion.
   * i.e. .portion = (end - start) / (sum of .portion for all APs in the same Stack).
   * Initially, each AP is in a Stack by itself, .portion === 1, so
   * .position is the whole axis [0, 1].
   */
  this.position = (portion === 1) ? [0, 1] : undefined;
  /** If flipped, the domain direction is reversed.  This affects the
   * domains of scales y and ys, and the axis brush extent.
   */
  this.flipped = false;
  /** If perpendicular, axis is rotated 90 degrees and paths are shown as dots (dot plot).
   */
  this.perpendicular = false;
  /** Reference to parent stack.  Set in Stack.prototype.{add,insert}(). */
  this.stack = undefined;
  /* AP objects persist through being dragged in and out of Stacks. */
  oa.aps[apName] = this;
};
Stacked.prototype.apName = undefined;
Stacked.prototype.portion = undefined;
function positionToString(p)
{
  return (p === undefined) ? ""
    : "[" + round_2(p[0]) + ", " + round_2(p[1]) + "]";
}
/** this function and positionToString() thrash the heap, so perhaps change to return
 * arrays of strings, just concat the arrays, and caller can join the strings. */
Stacked.prototype.toString = function ()
{
  let a =
    [ "{apName=", this.apName, ":", this.apName, ", portion=" + round_2(this.portion),
      positionToString(this.position) + this.stack.length, "}" ];
  return a.join("");
};
Stacked.prototype.log = function ()
{
  console.log
  ("{apName=", this.apName, ":", this.mapName, ", portion=", round_2(this.portion),
   positionToString(this.position), this.stack,  "}");
};
Stacked.apName_match =
  function (apName)
{ return function (s) { return s.apName === apName; };};
Stacked.prototype.yOffset = function ()
{
  let yRange = stacks.vc.yRange;
  let yOffset = yRange * this.position[0];
  if (Number.isNaN(yOffset))
  {
    console.log("Stacked#yOffset", yRange, this.position);
    debugger;
  }
  return yOffset;
};
Stacked.prototype.yRange = function ()
{
  return stacks.vc.yRange * this.portion;
};
/** Constructor for Stack type.
 * Construct a Stacked containing 1 AP (apName, portion),
 * and push onto this Stack.
 */
function Stack(stackable) {
  console.log("new Stack", oa, stacks.nextStackID);
  this.stackID = stacks.nextStackID++;
  /** The AP object (Stacked) has a reference to its parent stack which is the inverse of this reference : 
   * aps{apName}.stack.aps[i] == aps{apName} for some i.
   */
  this.aps = [];
  Stack.prototype.add = Stack_add;
  this.add(stackable);
};
/**  Wrapper for new Stack() : implement a basic object re-use.
 *
 * The motive is that as a AP is dragged through a series of stacks, it is
 * removed from its source stack, inserted into a destination stack, then as
 * cursor drag may continue, removed from that stack, and may finally be
 * moved into a new (empty) stack (dropOut()).  The abandoned empty stacks
 * are not deleted until dragended(), to avoid affecting the x positions of
 * the non-dragged stacks.  These could be collected, but it is simple to
 * re-use them if/when the AP is dropped-out.  By this means, there is at
 * most 1 abandoned stack to be deleted at the end of the drag; this is
 * stacks.toDeleteAfterDrag.
 */
function new_Stack(stackable) {
  let s;
  if (stacks.toDeleteAfterDrag !== undefined)
  {
    s = stacks.toDeleteAfterDrag;
    stacks.toDeleteAfterDrag = undefined;
    s.add(stackable);
  }
  else
  {
    s = new Stack(stackable);
    stacks.append(s);
  }
  return s;
}
/** undefined, or references to the AP (Stacked) which is currently dropped
 * and the Stack which it is dropped into (dropIn) or out of (dropOut).
 * properties :
 * out : true for dropOut(), false for dropIn()
 * stack: the Stack which apName is dropped into / out of
 * 'apName': apName,
 * dropTime : Date.now() when dropOut() / dropIn() is done
 *
 * static
 */
Stack.currentDrop = undefined;
/** undefined, or name of the AP which is currently being dragged. */
Stack.currentDrag = undefined;
/** @return true if this.aps[] is empty. */
Stack.prototype.empty = function ()
{
  return this.aps.length === 0;
};
/** @return array of apIDs of this Stack */
Stack.prototype.apIDs = function ()
{
  let a =
    this.aps.map(function(s){return s.apName;});
  return a;
};
Stack.prototype.toString = function ()
{
  let a =
    [
      "{aps=[",
      this.aps.map(function(s){return s.toString();}),
      "] length=" + this.aps.length + "}"
    ];
  return a.join("");
};
Stack.prototype.log = function ()
{
  console.log("{stackID=", this.stackID, ", aps=[");
  this.aps.forEach(function(s){s.log();});
  console.log("] length=", this.aps.length, "}");
};
Stack.prototype.verify = function ()
{
  if (this.aps.length == 0)
  {
    this.log();
    /* breakPointEnable = 1;
     breakPoint(); */
  }
};
/** Attributes of the stacks object.
 *
 * stacks.toDeleteAfterDrag
 * stack left empty by dropOut(); not deleted until dragended(), to avoid
 * affecting the x positions of the non-dragged stacks.  @see new_Stack()
 *
 * stacks.changed
 * true when an axis and/or stack has been moved drag; this triggers
 * axisStackChanged() to be called to update the drawing.
 * The update is split in 2 because x locations of stacks do not update during the drag (@see dragended() ) :
 * 0x01 : drag has not finished - interim redraw;
 * 0x10 : drag has finished.  The final x locations of stacks have been calculated.
 * (would use 0b instead of 0x but 0b may not be supported on IE)
 * This will evolve into a signal published by the stacks component,
 * listened to by draw components such as syntenyBlocks.
 */
/** Log all stacks. static. */
stacks.log = 
  Stack.log = function()
{
    if (trace_stack < 2) return;
    console.log("{stacks=[");
    stacks.forEach(function(s){s.log();});
    console.log("] length=", stacks.length, "}");
  };
Stack.verify = function()
{
  stacks.forEach(function(s){s.verify();});
};
/** Append the given stack to stacks[]. */
stacks.append = function(stack)
{
  stacks.push(stack);
};
/** Insert the given stack into stacks[] at index i. */
stacks.insert = function(stack, i)
{
  stacks = stacks.insertAt(i, stack);
};
/** stackID is used as the domain of the X axis. */
stacks.stackIDs = function()
{
  let sis = stacks.map(
    function (s) {
      return s.stackID;
    });
  return sis;
};
/** Sort the stacks by the x position of their APs. */
stacks.sortLocation = function()
{
  stacks.sort(function(a, b) { return a.location() - b.location(); });
};
/** Return the x location of this stack.  Used for sorting after drag. */
Stack.prototype.location = function()
{
  let l = this.aps[0].location();
  checkIsNumber(l);
  return l;
};
/** Find this stack within stacks[] and return the index.
 * @return -1 or index of the parent stack of AP
 */
Stack.prototype.stackIndex = function ()
{
  /** Could cache result in s; this function is often used; may not affect speed much. */
  let s = this, i = stacks.indexOf(s);
  return i;
};
/** Use the position of this stack within stacks[] to determine g.ap element classes.
 *
 * Use : the classes are used in css selectors to determine text-anchor.
 * If the stack is at the left or right edge of the diagram, then the titles
 * of APs in the stack will be displayed on the outside edge, so that paths
 * between APs (in .foreground) won't obscure the title.
 *
 * @return "leftmost" or "rightmost" or "" (just one class)
 */
Stack.prototype.sideClasses = function ()
{
  let i = this.stackIndex(), n = stacks.length;
  let classes = (i == 0) ? "leftmost" : ((i == n-1) ? "rightmost" : "");
  return classes;
};
/** Find stack of apID and return the index of that stack within stacks.
 * static
 * @param apID name of AP to find
 * @return -1 or index of found stack
 */
Stack.apStackIndex = function (apID)
{
  let ap = oa.aps[apID], s = ap.stack, i = s.stackIndex();
  return i;
};
/** Find stack of apID and return the index of that stack within stacks.
 * static
 * @param apID name of AP to find
 * @return undefined or
 *  {stackIndex: number, apIndex: number}.
 */
Stack.apStackIndex2 = function (apID)
{
  let ap = oa.aps[apID];
  if (ap === undefined)
    return undefined;
  else
  {
    let s = ap.stack, i = s.stackIndex();
    let j;
    if ((i === -1) || (stacks[i] !== s) || (j=s.aps.indexOf(ap), s.aps[j].apName != apID))
    {
      console.log("stackIndex", apID, i, ap, s, j, s.aps[j]);
      debugger;
    }
    return {stackIndex: i, apIndex: j};
  }
};

Stack.prototype.add = function(stackable)
{
  this.aps.push(stackable);
  stackable.stack = this;
  oa.aps[stackable.apName] = stackable;
};
Stack.prototype.addAp = function(apName, portion)
{
  let sd = new Stacked(apName, portion);
  this.add(sd);
};
/** Method of Stack.  @see Stack.prototype.add().
 * Add the given AP to this Stack.
 * @param sd  (stackable) Stacked / AP to add
 */
function Stack_add (sd)
{
  this.aps.push(sd);
  sd.stack = this;
};
/** Insert stacked into aps[] at i, moving i..aps.length up
 * @param i  same as param start of Array.splice()
 * @see {@link https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/splice | MDN Array Splice}
 */
Stack.prototype.insert = function (stacked, i)
{
  let len = this.aps.length;
  // this is supported via splice, and may be useful later, but initially it
  // would indicate an error.
  if ((i < 0) || (i > len))
    console.log("insert", stacked, i, len);

  this.aps = this.aps.insertAt(i, stacked);
  /* this did not work (in Chrome) : .splice(i, 0, stacked);
   * That is based on :
   * https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
   * Similarly in 2 other instances in this file, .removeAt() is used instead of .splice().
   */

  stacked.stack = this;
};
/** Find apName in this.aps[]. */
Stack.prototype.findIndex = function (apName)
{
  let mi = this.aps.findIndex(Stacked.apName_match(apName));
  return mi;
};
/** Find apName in this.aps[] and remove it.
 * @return the AP, or undefined if not found
 */
Stack.prototype.remove = function (apName)
{
  let si = this.findIndex(apName);
  if (si < 0)
  {
    console.log("Stack#remove named AP not in this stack", this, apName);
    return undefined;
  }
  else
  {
    let s = this.aps[si];
    this.aps = this.aps.removeAt(si, 1);
    // .splice(si, 1);
    return s;
  }
};
/** Remove the nominated AP (Stacked) from this Stack;
 * if this Stack is now empty, remove it from stacks[].
 * static
 * @param apName  name of AP to remove
 * @return undefined if not found, else -1, or stackID if the parent stack is also removed.
 * -1 indicates that the Stacked was removed OK and its parent was not removed because it has other children.
 */
Stack.removeStacked = function (apName)
{
  let result;
  console.log("removeStacked", apName);
  let ap = oa.aps[apName];
  if (ap === undefined)
  {
    console.log("removeStacked", apName, "not in", aps);
    result = undefined; // just for clarity. result is already undefined
  }
  else
  {
    let stack = ap.stack;
    result = stack.removeStacked1(apName);
    if (result === undefined)
      result = -1; // OK
  }
  if (trace_stack)
    console.log("removeStacked", apName, result);
  return result;
};
/** Remove the nominated AP (Stacked) from this Stack;
 * if this Stack is now empty, remove it from stacks[].
 *
 * @param apName  name of AP to remove
 * @return this.stackID if this is delete()-d, otherwise undefined
 * @see Stack.removeStacked(), which calls this.
 */
Stack.prototype.removeStacked1 = function (apName)
{
  let result;
  let ap = oa.aps[apName],
  removedAp = this.remove(apName);
  if (removedAp === undefined)
    console.log("removeStacked", apName);
  else
    delete oa.aps[apName];
  if (this.empty())
  {
    result = this.stackID;
    if (! this.delete())
    {
      console.log("removeStacked", this, "not found for delete");
    }
    else if (trace_stack)
      Stack.log();
  }
  else
  {
    console.log("removeStacked", this);
    // copied from .dropOut()
    let released = ap.portion;
    ap.portion = 1;
    this.releasePortion(released);
    // result is already undefined
  }
  return result;
};
/** Remove this Stack from stacks[].
 * @return false if not found, otherwise it is removed
 */
Stack.prototype.delete = function ()
{
  let si = stacks.indexOf(this);
  let ok = false;
  if (si < 0)
    console.log("Stack#delete program error: not found", this, stacks);
  else if (this !== stacks[si])
    console.log("Stack#delete program error: found value doesn't match",
                this, stacks, si, stacks[si]);
  else
  {
    stacks = stacks.removeAt(si, 1);
    // .splice(si, 1);
    ok = true;
  }
  return ok;
};
/**
 * Move named AP from one stack to another.
 * `this` is the source stack.
 * If first stack becomes empty - delete it.
 * If 2nd stack (destination) is new - create it (gui ? drag outside of top/bottom drop zones.)
 * @param apName name of AP to move
 * @param toStack undefined, or Stack to move AP to
 * @param insertIndex  index in toStack.aps[] to insert
 *
 * if toStack is undefined, create a new Stack to move the AP into;
 * The position in stacks[] to insert the new Stack is not given via params,
 * instead dragged() assigns x location to new Stack and sorts the stacks in x order.
 *
 * @return undefined if not found, or an array.
 * If `this` is empty after the move, it is deleted, otherwise the result
 * array contains `this`; this is so that the caller can call
 * .calculatePositions().
 */
Stack.prototype.move = function (apName, toStack, insertIndex)
{
  let result = undefined;
  let s = this.remove(apName);
  // if apName is not in this.aps[], do nothing
  let ok = s !== undefined;
  if (ok)
  {
    if (toStack === undefined)
    {
      toStack = new_Stack(s);
      /* Need to call .calculatePositions() for this and toStack;
       * That responsibility is left with the caller, except that
       * caller doesn't have toStack, so .move() looks after it.
       * No : ap.position and .portion are updated after .move()
       * so caller has to call .calculatePositions().
       toStack.calculatePositions();
       */
    }
    else
      toStack.insert(s, insertIndex);
    result = [];
    if (this.empty())
    {
      // this.delete();
      /* Defer delete because when it is deleted :
       * If source stack has only 1 AP, then dropOut() deletes the stack
       * and stacks to its right shift left in the array to fill the gap;
       * That causes : destination stack moves to x of source stack when
       * dragging to the right, iff the source stack has only 1 AP.
       * That behaviour should occur after dragended, not during.
       */
      stacks.toDeleteAfterDrag = this;
    }
    else
      result.push(this);
    if (trace_updatedStacks)
      //- pass action bus to init()
      oa.eventBus.send('updatedStacks', stacks);
  }
  return result;
};
/** Shift named AP to a different position within this Stack.
 * Portions will be unchanged, positions will be re-calculated.
 * Find apName in this.aps[] and move it.

 * @param apName name of AP to move
 * @param insertIndex  index in toStack.aps[] to insert
 * @return the AP, or undefined if not found
 */
Stack.prototype.shift = function (apName, insertIndex)
{
  let si = this.findIndex(apName);
  if (si < 0)
  {
    console.log("Stack#remove named AP not in this stack", this, apName);
    return undefined;
  }
  else
  {
    let s = this.aps[si];
    console.log("shift(), before removeAt()", this, apName, insertIndex, this.aps.length, s);
    this.log();
    this.aps = this.aps.removeAt(si, 1);
    let len = this.aps.length;
    this.log();
    if (insertIndex >= len)
      console.log("shift()", this, apName, insertIndex, " >= ", len, s);
    let insertIndexPos = (insertIndex < 0) ? len + insertIndex : insertIndex;
    // splice() supports insertIndex<0; if we support that, this condition need
    if (si < insertIndexPos)
      insertIndexPos--;
    this.aps = this.aps.insertAt(insertIndexPos, s);
    console.log("shift(), after insertAt()", insertIndexPos, this.aps.length);
    this.log();
    return s;
  }
};
/** @return true if this Stack contains apName
 */
Stack.prototype.contains = function (apName)
{
  return this === oa.aps[apName].stack;
};
/** Insert the named AP into this.aps[] at insertIndex (before if top, after
 * if ! top).
 * Preserve the sum of this.aps[*].portion (which is designed to be 1).
 * Give the new AP a portion of 1/n, where n == this.aps.length after insertion.
 *
 * share yRange among APs in stack
 * (retain ratio among existing APs in stack)
 *
 * @param apName name of AP to move
 * @param insertIndex position in stack to insert at.
 * @param true for the DropTarget at the top of the axis, false for bottom.
 * @param transition  make changes within this transition
 */
Stack.prototype.dropIn = function (apName, insertIndex, top, transition)
{
  let aps = oa.aps;
  console.log("dropIn", this, apName, insertIndex, top);
  let fromStack = aps[apName].stack;
  /* It is valid to drop a AP into the stack it is in, e.g. to re-order the APs.
   * No change to portion, recalc position.
   */
  if (this === fromStack)
  {
    console.log("Stack dropIn() AP ", apName, " is already in this stack");
    this.shift(apName, insertIndex);
    return;
  }
  /** Any AP in the stack should have the same x position; use the first
   * since it must have at least 1. */
  let anApName = this.aps[0].apName,
  /** Store both the cursor x and the stack x; the latter is used, and seems
   * to give the right feel. */
  dropX = {event: d3.event.x, stack: oa.o[anApName]};
  Stack.currentDrop = {out : false, stack: this, 'apName': apName, dropTime : Date.now(), x : dropX};
  if (! top)
    insertIndex++;
  let okStacks =
    fromStack.move(apName, this, insertIndex);
  // okStacks === undefined means apName not found in fromStack
  if (okStacks)
  {
    // if fromStack is now empty, it will be deleted, and okStacks will be empty.
    // if fromStack is not deleted, call fromStack.calculatePositions()
    let ap = aps[apName],
    released = ap.portion;
    console.log("dropIn", released, okStacks);
    okStacks.forEach(function(s) { 
      s.releasePortion(released);
      s.calculatePositions();
      s.redraw(transition); });

    // For all APs in this (the destination stack), adjust portions, then calculatePositions().
    /** the inserted AP */
    let inserted = this.aps[insertIndex];
    inserted.stack = this;
    // apart from the inserted AP,
    // reduce this.aps[*].portion by factor (n-1)/n
    let n = this.aps.length,
    factor = (n-1)/n;
    inserted.portion = 1/n;
    this.aps.forEach(
      function (a, index) { if (index !== insertIndex) a.portion *= factor; });
    this.calculatePositions();
    stacks.changed = 0x11;
  }
};
/** Used when a AP is dragged out of a Stack.
 * re-allocate portions among remaining APs in stack
 * (retain ratio among existing APs in stack)
 * This is used from both dropIn() and dropOut(), for the Stack which the
 * AP is dragged out of.
 * @param released  the portion of the AP which is dragged out
 */
Stack.prototype.releasePortion = function (released)
{
  let
    factor = 1 / (1-released);
  this.aps.forEach(
    function (a, index) { a.portion *= factor; });
  this.calculatePositions();
};
/** Drag the named AP out of this Stack.
 * Create a new Stack containing just the AP.
 *
 * re-allocate portions among remaining APs in stack
 * (retain ratio among existing APs in stack)
 *
 * .dropIn() and .dropOut() both affect 2 stacks : the AP is dragged from
 * one stack (the term 'source' stack is used in comments to refer this) to
 * another (call this the 'destination' stack). .dropOut() may create a new
 * stack for the destination.
 *
 * @param apName name of AP to move
 */
Stack.prototype.dropOut = function (apName)
{
  console.log("dropOut", this, apName);
  Stack.currentDrop = {out : true, stack: this, 'apName': apName, dropTime : Date.now()};

  /* passing toStack===undefined to signify moving AP out into a new Stack,
   * and hence insertIndex is also undefined (not used since extracted AP is only AP
   * in newly-created Stack).
   */
  let okStacks =
    this.move(apName, undefined, undefined);
  /* move() will create a new Stack for the AP which was moved out, and
   * add that to Stacks.  dragged() will assign it a location and sort.
   */

  // Guard against the case that `this` became  empty and was deleted.
  // That shouldn't happen because dropOut() would not be called if `this` contains only 1 AP.
  if (okStacks && (okStacks[0] == this))
  {
    // apName goes to full height. other APs in the stack take up the released height proportionately
    let ap = oa.aps[apName],
    released = ap.portion;
    ap.portion = 1;
    this.releasePortion(released);
    let toStack = ap.stack;
    toStack.calculatePositions();
    stacks.changed = 0x11;
  }
};
/** Calculate the positions of the APs in this stack
 * Position is a proportion of yRange.
 *
 * Call updateRange() to update ys[apName] for each AP in the stack.
 */
Stack.prototype.calculatePositions = function ()
{
  // console.log("calculatePositions", this.stackID, this.aps.length);
  let sumPortion = 0;
  this.aps.forEach(
    function (a, index)
    {
      a.position = [sumPortion,  sumPortion += a.portion];
      //- axis          updateRange(a);
    });
};
/** find / lookup Stack of given AP.
 * This is now replaced by aps[apName]; could be used as a data structure
 * validation check.
 * static
 */
Stack.apStack = function (apName)
{
  // could use a cached structure such as apStack[apName].
  // can now use : aps{apName}->stack
  let as = stacks.filter(
    function (s) {
      let i = s.findIndex(apName);
      return i >= 0;
    });
  if (as.length != 1)
    console.log("apStack()", apName, as, as.length);
  return as[0];
};
/** find / lookup Stack of given AP.
 * static
 * @return undefined or
 *  {stackIndex: number, apIndex: number}.
 *
 * See also above alternative apStackIndex().
 * This version accumulates an array (because reduce() doesn't stop at 1).
 * It will only accumulate the first match (apIndex) in each stack,
 * but by design there should be just 1 match across all stacks.
 * Only the first result in the array is returned, and a warning is given if
 * there are !== 1 results
 * Probably drop this version - not needed;  could be used as a data structure
 * validation check, e.g. in testing.
 */
Stack.apStackIndexAll = function (apName)
{
  /** called by stacks.reduce() */
  function findIndex_apName
  (accumulator, currentValue, currentIndex /*,array*/)
  {
    let i = currentValue.findIndex(apName);
    if (i >= 0)
      accumulator.push({stackIndex: currentIndex, apIndex: i});
    return accumulator;
  };
  let as = stacks.reduce(findIndex_apName, []);
  if (as.length != 1)
  {
    console.log("apStackIndexAll()", apName, as, as.length);
  }
  return as[0];
};
/** @return transform : translation, calculated from AP position within stack.
 */
Stacked.prototype.apTransform = function ()
{
  let yRange = stacks.vc.yRange;
  if (this.position === undefined || yRange === undefined)
  {
    console.log("apTransform()", this.apName, this, yRange);
    debugger;
  }
  let yOffset = this.yOffset(),
  yOffsetText = Number.isNaN(yOffset) ? "" : "," + this.yOffset();
  let scale = this.portion,
  scaleText = Number.isNaN(scale) ? "" : " scale(" + scale + ")";
  /** Will be undefined when AP is dragged out to form a new Stack, which
   * is not allocated an x position (via xScale()) until dragended().  */
  let xVal = x(this.apName);
  if (xVal === undefined)
    xVal = oa.o[this.apName];
  checkIsNumber(xVal);
  xVal = Math.round(xVal);
  let transform =
    [
      "translate(" + xVal, yOffsetText, ")",
      scaleText
    ].join("");
  console.log("apTransform", this, transform);
  return transform;
};
/** Get stack of AP, return transform. */
Stack.prototype.apTransform = function (apName)
{
  let a = oa.aps[apName];
  return a.apTransform();
};
/** Get stack of AP, return transform. */
Stack.prototype.apTransformO = function (apName)
{
  let a = oa.aps[apName];
  return a.apTransformO();
};
/** For each AP in this Stack, redraw axis, brush, foreground paths.
 * @param t transition in which to make changes
 */
Stack.prototype.redraw = function (t)
{
  const trace_stack_redraw = 0;
  /* Currently redraw() is used just after dropIn,Out(), and hence is
   * particular to the drag transition, but the transition object t and
   * dragTransition() could be factored out of redraw() and passed in as an
   * arg.
   */
  /* tried "end", "start", "end.Dav127".  only "start" works.  refn:
   * https://github.com/d3/d3-transition/blob/master/README.md#transition_on
   */
  t.on("end interrupt", dragTransitionEnd);
  /** to make this work, would have to reparent the APs - what's the benefit
   * let ts = 
   *   t.selectAll("g.stack#" + eltId(this.stackID) + " > .ap");
   */
  console.log("redraw() stackID:", this.stackID);
  let this_Stack = this;  // only used in trace

  this.aps.forEach(
    function (a, index)
    {
      /** Don't use a transition for the AP/axis which is currently being
       * dragged.  Instead the dragged object will closely track the cursor;
       * may later use a slight / short transition to smooth noise in
       * cursor.  */
      let t_ = (Stack.currentDrag == a.apName) ? d3 : t;
      // console.log("redraw", Stack.currentDrag, a.apName, Stack.currentDrag == a.apName);
      let ts = 
        t_.selectAll(".ap#" + eltId(a.apName));
      (trace_stack_redraw > 0) &&
        (((ts._groups.length === 1) && console.log(ts._groups[0], ts._groups[0][0]))
         || ((trace_stack_redraw > 1) && console.log("redraw", this_Stack, a, index, a.apName)));
      // console.log("redraw", a.apName);
      // args passed to fn are data, index, group;  `this` is node (SVGGElement)
      ts.attr("transform", Stack.prototype.apTransformO);
      apRedrawText(a);
    });

  this.redrawAdjacencies();
};

function apRedrawText(a)
{
  let svgContainer = oa.svgContainer;
  let axisTS = svgContainer.selectAll("g.ap#" + eltId(a.apName) + " > text");
  axisTS.attr("transform", yAxisTextScale);
  let axisGS = svgContainer.selectAll("g.axis#" + axisEltId(a.apName) + " > g.tick > text");
  axisGS.attr("transform", yAxisTicksScale);
  let axisBS = svgContainer.selectAll("g.axis#" + axisEltId(a.apName) + " > g.btn > text");
  axisBS.attr("transform", yAxisBtnScale);
}

/** For each AP in this Stack, redraw axis title.
 * The title position is affected by stack adjacencies.
 * Dragging a stack can affect the rendering of stacks on either side of its start and end position.
 */
Stack.prototype.redrawAdjacencies = function ()
{
  let stackClass = this.sideClasses();

  this.aps.forEach(
    function (a, index)
    {
      /** transition does not (yet) support .classed() */
      let as = oa.svgContainer.selectAll(".ap#" + eltId(a.apName));
      as.classed("leftmost", stackClass == "leftmost");
      as.classed("rightmost", stackClass == "rightmost");
      as.classed("not_top", index > 0);
    });
};
//-    import {} from "../utils/axis.js";

//-    import {} from "../components/stacks.js";
//-    import {} from "../utils/stacks.js";

/*------------------------------------------------------------------------*/

/** width of the AP.  either 0 or .extended (current width of extension) */
Stacked.prototype.extendedWidth = function()
{
  // console.log("Stacked extendedWidth()", this, this.extended);
  return this.extended || 0;
};

/** @return range of widths, [min, max] of the APs in this stack */
Stack.prototype.extendedWidth = function()
{
  let range = [undefined, undefined];
  this.aps.forEach(
    function (a, index)
    {
      let w = a.extendedWidth();
      if ((range[0] === undefined) || (range[0] > w))
        range[0] = w;
      if ((range[1] === undefined) || (range[1] < w))
        range[1] = w;
    });
  // console.log("Stack extendedWidth()", this, range);
  return range;
};

/*------------------------------------------------------------------------*/

/** Scale to map axis names to x position of axes.
 * sum of stacks, constant inter-space, use max of .extendedWidth().
 * (combine) 2 scales - map stack key to domain space, then to range.
 * Replaces @see xScale() when axes may be split - .extended
 */
function xScaleExtend()
{
  /* .extended is measured in the range space (pixels),
   * so calculate space between axes.
   */
  let count = 0, widthSum = 0;
  stacks.forEach(
    function(s){count++; let widthRange = s.extendedWidth(); widthSum += widthRange[1];}
  );
  let widths = stacks.map(
    function(s){ let widthRange = s.extendedWidth(); return widthRange[1];}
  );

  let axisXRange = stacks.vc.axisXRange;
  if (axisXRange === undefined)
    console.log("xScaleExtend axisXRange undefined", oa);
  let rangeWidth = axisXRange[1] - axisXRange[0],
  paddingInner = rangeWidth*0.10, paddingOuter = rangeWidth*0.05;
  let gap = (rangeWidth - paddingOuter*2) - widthSum; // total gap
  if (count > 1)
    gap =  gap / (count - 1);

  let stackDomain = Array.from(stacks.keys()); // was apIDs
  let outputs = [], cursor = axisXRange[0];
  count = 0;
  stacks.forEach(
    function(s){
      count++; let widthRange = s.extendedWidth(); let width = widthRange[1];
      outputs.push(cursor);
      cursor += width + gap;
    }
  );
  console.log("xScaleExtend", widths, count, widthSum, axisXRange, paddingInner, paddingOuter, gap, stackDomain, outputs, cursor);
  return d3.scaleOrdinal().domain(stackDomain).range(outputs);
  // .unknown(axisXRange*0.98) ?
}

/*------------------------------------------------------------------------*/

/** x scale which maps from apIDs[] to equidistant points in axisXRange
 */
//d3 v4 scalePoint replace the rangePoint
//let x = d3.scaleOrdinal().domain(apIDs).range([0, w]);
function xScale() {
  let stackDomain = Array.from(stacks.keys()); // was apIDs
  console.log("xScale()", stackDomain);
  return d3.scalePoint().domain(stackDomain).range(stacks.vc.axisXRange);
}

Stacked.prototype.location = function() { return checkIsNumber(oa.o[this.apName]); };
/** Same as .apTransform(), but use o[d] instead of x(d)
 * If this works, then the 2 can be factored.
 * @return transform : translation, calculated from AP position within stack.
 */
Stacked.prototype.apTransformO = function ()
{
  let yRange = stacks.vc.yRange;
  if (this.position === undefined || yRange === undefined)
  {
    console.log("apTransformO()", this.apName, this, yRange);
    debugger;
  }
  let yOffset = this.yOffset(),
  yOffsetText =  Number.isNaN(yOffset) ? "" : "," + this.yOffset();
  /** x scale doesn't matter because x is 0; use 1 for clarity.
   * no need for scale when this.portion === 1
   */
  let scale = this.portion,
  scaleText = Number.isNaN(scale) || (scale === 1) ? "" : " scale(1," + scale + ")";
  let xVal = checkIsNumber(oa.o[this.apName]);
  xVal = Math.round(xVal);
  let rotateText = "", ap = oa.aps[this.apName];
  if (ap.perpendicular)
  {
    /** shift to centre of axis for rotation. */
    let shift = -yRange/2;
    rotateText =
      "rotate(90)"
      +  " translate(0," + shift + ")";
    let a = d3.select("g#id" + this.apName + ".ap");
    if (trace_stack > 1)
      console.log("perpendicular", shift, rotateText, a.node());
  }
  let transform =
    [
      " translate(" + xVal, yOffsetText, ")",
      rotateText,
      scaleText
    ].join("");
  if (trace_stack > 1)
    console.log("apTransformO", this, transform);
  return transform;
};

/*----------------------------------------------------------------------------*/

export  { Stacked, Stack, stacks, xScaleExtend } ;
