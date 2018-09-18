/*global d3 */

/*----------------------------------------------------------------------------*/

import  { dragTransitionEnd} from '../utils/stacks-drag';
import { round_2, checkIsNumber} from '../utils/domCalcs';
import {  Axes, yAxisTextScale,  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform, eltId, axisEltId, eltIdAll, highlightId  }  from './draw/axis';
import { variableBands } from '../utils/variableBands';
import { isOtherField } from '../utils/field_names';
import { Object_filter } from '../utils/Object_filter';
import { breakPoint, breakPointEnableSet } from '../utils/breakPoint';


/*----------------------------------------------------------------------------*/

Object.filter = Object_filter;

/*----------------------------------------------------------------------------*/

const trace_stack = 1;
const trace_updatedStacks = true;

/** Each stack contains 1 or more Axis Pieces (Axes).
 * stacks are numbered from 0 at the left.
 * stack[i] is an array of Stack, which contains an array of Stacked,
 * which contains axisID & portion.
 */
var stacks = [];
//- can pass to init() just the required values, instead of oa : o, x, >
var oa;
/** Ownership of this may move to data component. */
var axes;
var axesP;
let blocks;

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

    /** Reference to all parent axes by apName.
     * (currently if a block does not have a parent, then its axesP is itself)
     */
    axesP =
      stacks.axesP = {};

    blocks = stacks.blocks = {};

    axes =
      /** Reference to all (Stacked) Axes by axisName.
       * axes[x] is === either blocks[x] or axesP[x], not both.
       */
      stacks.axes = {};
  }
};


/*----------------------------------------------------------------------------*/

/** Block is the data type of Stacked.blocks[] and Stacked.referenceBlock.
 * @param block Ember Store record of block
 *
 * @param Attributes (not constructor params) :
 * @param axis  axis on which this block is displayed, or is the reference for.
 * @param parentName defined if the dataset of the block has a parent dataset,
 * in which case it will be displayed on the parent's axis.  This name is used
 * for matching if the parent block arrives after the child block.
 * It is equivalent to block.get('dataset').get('parent').get('name').
 * If parentName is undefined, then this block is the referenceBlock of its axis.
 * @param parent undefined, or the block matching .parentName; i.e. it is the
 * referenceBlock of the axis on which this block is displayed.
 * @param z this block's data block.get('features') is copied into oa.z[blockId];
 * this is a direct reference.
 */
function Block(block) {
  // provide .axisName for code in draw-map which may handle axes or blocks
  let axisName = block.get('id');
  this.axisName = axisName;
  stacks.axes[axisName] =
  stacks.blocks[axisName] = this;

  this.block = block;
  /** .visible indicates the features of this block will be included in axis brushes & paths.  */
  this.visible = true;
  console.log("Block()", this, block, axisName);
};
/** At some point .axisName will be renamed to .blockId; this function will make
 * that transparent, and avoid confusion with .getAxis().
 * @return blockId of this block, aka .axisName
 */
Block.prototype.getId = function()
{
  return this.axisName;
};
/** @return axis of this block or if it has a parent, its parent's axis */
Block.prototype.getAxis = function()
{
  return this.axis || (this.parent && this.parent.getAxis());
};
/** @return stack of this block's axis.
 * @see Block.prototype.getAxis()
 */
Block.prototype.getStack = function ()
{
  let axis;
  return (axis = this.getAxis()) && axis.stack;
};
Block.prototype.log = function() {
  console.log(
    this.axisName, this.block.get('name'),
    this.parentName,
    (this.parent && this.parent.mapName) ? "parent:" + this.parent.mapName : ''
    // this.parent.axisName
  );
};
Block.prototype.longName = function() {
  // .axisName is this.block.get('id')
  return this.axisName + ':' + this.block.get('name')
    + '/' + (this.parent ? this.parent.axisName : '');
};
/** @return undefined or .longName() of block if blockId is loaded.
 * (static)
 */
Block.longName = function (blockId) {
  let block = stacks.blocks[blockId];
  return block && block.longName();
}
/*----------------------------------------------------------------------------*/


function Stacked(axisName, portion) {
  this.axisName = axisName;
  this.mapName = oa.cmName[axisName].mapName;  // useful in devel trace.
  /** Portion of the Stack height which this axis axis occupies. */
  this.portion = portion;
  // The following are derived attributes.
  /** .position is accumulated from .portion.
   * .position is [start, end], relative to the same space as portion.
   * i.e. .portion = (end - start) / (sum of .portion for all Axes in the same Stack).
   * Initially, each axis is in a Stack by itself, .portion === 1, so
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
  /** data blocks */
  this.blocks = [];
  /* axis objects persist through being dragged in and out of Stacks. */
  axesP[axisName] =
  oa.axes[axisName] = this;
};
Stacked.prototype.referenceBlock = undefined;
Stacked.prototype.axisName = undefined;
Stacked.prototype.portion = undefined;
/** So far Stacked and axis are 1:1; they are different concepts - the Stacked is 
 * responsible for the interface with Stack (i.e. it is the thing which is
 * stacked), and the axis concept is responsible for rendering which happens
 * within the Stacked frame of reference; so it is a container / content
 * pattern. They are bundled into a single class Stacked, but we could split out
 * Axis as a separate class, either a mixin or a component, and in the latter
 * case this function would return a reference to the separate Axis component.
 * Both Block and Stacked implement getAxis(); this is used as an abstract
 * interface which is implemented by both the parent (reference) and child
 * blocks.  To refine further : Block could be split into Reference and Child
 * block facets; some blocks (e.g. genetic maps) have both; the axis would be an
 * attribute of the reference block.
  */
Stacked.prototype.getAxis = function()
{
  return this;
};
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
    [ "{axisName=", this.axisName, ":", this.axisName, ", portion=" + round_2(this.portion),
      positionToString(this.position) + this.stack.length, "}" ];
  return a.join("");
};
Stacked.prototype.log = function ()
{
  if (this.blocks.length && (this.blocks[0] === undefined))
  {
    console.log(this, this.blocks, '[0] is undefined');
    this.blocks.splice(0, 1);
  }
  console.log
  ("{axisName=", this.axisName, ":", this.mapName,
   (this.z && this.z.scope) ? "scope:" + this.z.scope : '',
   (this.referenceBlock && this.referenceBlock.get('name')),
   ", portion=", round_2(this.portion),
   positionToString(this.position), this.stack, 
   this.blocks.map(function (b) { return b.longName(); } ),
   "}");
  this.logElt();
};

Stacked.prototype.longName = function ()
{
  return this.axisName + ":" + this.mapName +
    ((this.z && this.z.scope) ? ":" + this.z.scope : '');
};

Stacked.prototype.logBlocks = function ()
{
  for (let i=0; i < this.blocks.length; i++)
  {
    let b = this.blocks[i];
    console.log(i, b.axisName, b.block.get('id'));
  }
};
/** corresponds to svgContainer */
const selectPrefix = "div#holder > svg > g";
Stacked.prototype.logElt = function ()
{
  let a = d3.select(selectPrefix + "> g.stack > g#id" + this.axisName + ".axis-outer");
  console.log("logElt", a.node());
};
/** S for stacks Block, as distinct from the (ember store) block record.
 * @return the Block object corresponding to the block record .referenceBlock;
 */
Stacked.prototype.referenceBlockS = function ()
{
  // verification
  if (this.referenceBlock.view != this.blocks[0])
    breakPoint('referenceBlockS', this, this.referenceBlock && this.referenceBlock.view, this.blocks);
  return this.blocks[0];
};
Stacked.prototype.getStack = function ()
{
  return this.stack;
};
/** static */
Stacked.getAxis = function (axisID)
{
  let block,
  /** oa.axes[] contains Block-s also. Block implements getAxis() and getStack(). */
  axis =
    ((block = stacks.blocks[axisID]) && block.getAxis())
    ||
    oa.axes[axisID]
  ;
  return axis;
};
/** static */
Stacked.getStack = function (axisID)
{
  let axis = Stacked.getAxis(axisID),
  /** oa.axes[] contains Block-s also. Block implements getStack(). */
  s = axis && axis.getStack();
  return s;
};
/** static */
Stacked.longName = function (axisID)
{
  let axis, block, blockR, longName =
  ((axis = stacks.axesP[axisID]) && axis.longName()) ||
    ((block = stacks.blocks[axisID]) && (blockR = block.block) && (axisID + ':' + blockR.get('scope'))) ||
    axisID;
  return longName;
};
function axisId2Name(axisID)
{
  let axis = Stacked.getAxis(axisID);
  return axis && axis.mapName;
}

/** static */
Stacked.axisName_match =
  function (axisName)
{ return function (s) { return s.axisName === axisName; };};
/** If axisName has a parent, return its name, otherwise return undefined.
 * This is static; for non-static @see .parent attribute of Stacked.
 * This is useful where axisName is used in geometry calculations, which may
 * be factored into Stacked.prototype., bypassing this function.
 * @see Block.prototype.getAxis()
 */
Block.axisName_parent =
  function (axisName)
{ 
    let 
      a = oa.stacks.blocks[axisName],
    parent = a && a.parent,
    parentName = parent && parent.axisName;
    return parentName || axisName ;
  };

/** Remove a block from a Stacked (axis).
 * @param this target
 * @param blockIndex index of block to move
 */
Stacked.prototype.removeBlock = function(blockIndex)
{
  // copied from Stacked.prototype.move() - factor that function to use this.

  if (this.blocks.length <= blockIndex)
  {
    console.log('removeBlock(): expected blocks.length', this.blocks.length, ' to be >', blockIndex);
    this.log();
  }
  /** type is stacks:Block */
  let aBlock = this.blocks[blockIndex];
  /** delete blockIndex element of source.blocks[]; */
  let aBlockA = this.blocks.splice(blockIndex, 1);
  if (aBlockA[0] !== aBlock)  // verification
    breakPoint('removeBlock', aBlockA, '[0] !==', aBlock);
  // aBlock will probably become unreferenced and soon deleted.
  aBlock.axis = undefined;
  aBlock.parent = undefined;  // the .parent relationship is not really changed.
  return aBlock;
};
/** Remove blockId from this axis.
 * @return Block undefined if block is not in this.blocks[].
 */
Stacked.prototype.removeBlockByName = function(blockId)
{
  let block_ = stacks.blocks[blockId],
  blockIndex = block_ && this.blocks.indexOf(block_),
  block = (blockIndex < 0) ? undefined : this.removeBlock(blockIndex);
  // verification
  if (block && block.axisName != blockId)
    breakPoint('removeBlockByName', blockIndex, block.name, '!=', blockId);
  else
    console.log('removeBlockByName', blockId, blockIndex);
  return block;
};
/** Move a block from one Stacked (axis) to another.
 * @param this target
 * @param source  Stacked to move from
 * @param blockIndex index of block to move
 */
Stacked.prototype.move = function(source, blockIndex)
{
  if (source.blocks.length <= blockIndex)
  {
    console.log('move(): expected blocks.length', source.blocks.length, ' to be >', blockIndex);
    source.log();
  }
  /** type is stacks:Block */
  let aBlock = source.blocks[blockIndex];
  console.log('move() before delete source.blocks', source, source.blocks, blockIndex, aBlock);
  /** delete blockIndex element of source.blocks[]; */
  let aBlockA = source.blocks.splice(0, 1);
  if (aBlockA[0] !== aBlock)  // verification
    breakPoint('move', aBlockA, '[0] !==', aBlock);
  console.log('after delete', source.blocks);

  this.blocks.push(aBlock);
};

/** Defer to the axis or parent's axis to calculate yOffset. */
Block.prototype.yOffset = function ()
{
  let yOffset;
  if (this.axis)
  {
    // console.log("yOffset via axis", this, this.axis);
    yOffset = this.axis.yOffset();
  }
  else if (this.parent)
  {
    // console.log("yOffset via parent", this, this.parent);
    yOffset = this.parent.yOffset();
  }
  return yOffset;
};
/** y offset of this axis, calculated from position of axis in stack, and yRange
 * of stack. */
Stacked.prototype.yOffset = function ()
{
  let yRange = stacks.vc.yRange;
  let yOffset = yRange * this.position[0];
  if (Number.isNaN(yOffset))
  {
    console.log("Stacked#yOffset", yRange, this.position);
    breakPoint();
  }
  return yOffset;
};
/** @return length of the axis in pixels */
Stacked.prototype.yRange = function ()
{
  return stacks.vc.yRange * this.portion;
};
/** @return range of axis in pixels relative to 0 - the end of the stack */
Stacked.prototype.yRange2 = function ()
{
  let yRange = stacks.vc.yRange,
  range = this.position.map(function (p) { return yRange * p; });
  return range;
};
/** Calculate the domain of feature locations in the block named this.axisName.
 */
Block.prototype.domainCalc = function ()
{
  let d = this.axisName, features = oa.z[d],
  blockAttr = oa.cmName[d];
  function featureLocation(a)
  {
    return ! isOtherField[a] && features[a].location;
  }
  let
    domain =
    (blockAttr && blockAttr.range) ||
    d3.extent(Object.keys(features), featureLocation);
  // console.log("domainCalc", this, d, features, domain);
  if (! domain || ! domain.length)
    breakPoint();
  return domain;
};
/** Traverse the blocks displayed on this axis, and return a domain which spans
 * their domains.
 */
Stacked.prototype.domainCalc = function ()
{
  console.log('domainCalc', this, this.blocks);
  let blockDomains = 
    this.blocks.map(function (b) { return b.domain || (b.domain = b.domainCalc()); }),
  /** refn : https://github.com/d3/d3-array/issues/64#issuecomment-356348729 */
  domain = 
    [
      d3.min(blockDomains, array => d3.min(array)),
      d3.max(blockDomains, array => d3.max(array))
    ];
  if (trace_stack > 1)
  {
    console.log('domainCalc', this.axisName, this.blocks.length, blockDomains, domain);
    if ((trace_stack > 2) && ! domain[0] && ! domain[1])
      breakPoint();
  }
  return domain;
};
/** @return the interval of the .referenceBlock of this axis.
*/
Stacked.prototype.referenceDomain = function ()
{
  let domain = this.referenceBlock.get('range');
  return domain;
};
/** Calculate .domain if it is not calculated yet.
 * Try referenceDomain() first - it should be defined, failing that use
 * domainCalc().
 * @return .domain
 */
Stacked.prototype.getDomain = function ()
{
  return this.domain
    || (this.domain = this.referenceDomain())
    || (this.domain = this.domainCalc())
  ;
};


Stacked.prototype.verify = function ()
{
  let me = this;
  if (this.blocks.length == 0)
  {
    this.log();
  }
  else
  {
    /* traverse the axes of this stack. */
    this.blocks.forEach(
      function (b, index)
      {
        let block = stacks.blocks[b.axisName],
        /** true if the parent of axis a is stack me.  */
        v1 = block.axis === me,
        v2 = (block.parent === me.blocks[0]) || (block === me.blocks[0]);
        if (!v1 || !v2)
        {
          console.log("v1", v1, "v2", v2, me, block);
          me.log();
          block.log();
          breakPoint();
        }
      });
  }
};


/** Return an array of the blocks which are in this Stacked (axis).
 * @param includeSelf if true, append self name (i.e. the referenceBlock) to the result.
 * @param names true means return just the block names
 * @return an array of child blocks / names.
 */
Stacked.prototype.children = function (includeSelf, names)
{
  let children = this.blocks;
  if (names)
    children = children.map(function (a) { return a.block.get('name'); });
  if (trace_stack > 1)
    console.log("children", this, children);
  if (! includeSelf)
  {
    // delete [0] element of children[]
    if (names)
      children.splice(0, 1);
    else
      // if ! names, then children === this.blocks, so make a copy,  don't delete from this.blocks[]
      children = children.slice(1);
  }
  return children;
};
if (false)  // not required, possibly not up to date, replaced by .childBlocks(true)
  Stack.prototype.childAxisNames = function (includeSelf)
{
    let children =
      this.blocks.reduce(function (children, a) { return children.concat(a.children(includeSelf)); }, []);
    // console.log("childAxisNames", includeSelf, this, children);  this.log();
    return children;
  };
if (false)  // not required, possibly not up to date
  /** Result is grouped by axis, i.e. array of axes, each axis being an array of child names.  */
  Stack.prototype.childAxisNamesGrouped = function (includeSelf)
{
    let children = [].concat(
      // repeated scans of this.axes[] by Stacked.prototype.children(), maybe maintain a list of children (blocks).
      this.axes.map(function (a) { return a.children(includeSelf); })
    );
    // console.log("childAxisNamesGrouped", includeSelf, this, children);  this.log();
    return children;
  };
/** Return an array of the blocks which are in this stack.
 * (currently includes referenceBlock-s also).
 * @param names true means return just the block names
 */
Stack.prototype.childBlocks = function (names)
{
  let me = this,
  blocks  = d3.keys(stacks.blocks).filter(function (a) { return stacks.blocks[a].getStack() == me; } );
  if (! names)
    blocks = blocks.map(function (a) { return stacks.blocks[a]; } );
  return blocks;
};
/** @return all the blocks in this axis which are data blocks, not reference blocks.
 * Data blocks are recognised by having a .namespace;
 * @param visible if true then exclude blocks which are not visible
 */
Stacked.prototype.dataBlocks = function (visible)
{
  let db = this.blocks
    .filter(function (block) {
      //  -	also need to check if features.length > 0
      return (! visible || block.visible)
        && (block.block.get('namespace') || block.block.get('features')); });
  if (trace_stack > 1)
    console.log(
      'Stacked', 'blocks', visible, this.blocks.map(function (block) { return block.longName(); }),
      this.axisName, this.mapName, 'dataBlocks',
      db.map(function (block) { return block.longName(); }));
  return db;
};
/** @return all the blocks in this Stack which are data blocks, not reference blocks.
 * Data blocks are recognised by having a .namespace;
 * this is a different criteria to @see Stack.prototype.dataBlocks0().
 */
Stack.prototype.dataBlocks = function ()
{
  /** Currently only visible == true is used, but could make this a param.  */
  let visible = true;
  let axesDataBlocks = this.axes
    .map(function (stacked) { return stacked.dataBlocks(visible); } ),
  db = Array.prototype.concat.apply([], axesDataBlocks)
  ;
  // Stacked.longName() handles blocks also.
  if (trace_stack > 1)
    console.log(
      'Stack', this.stackID, 'axes', this.axes.map(Stacked.longName),
      'dataBlocks',
      db.map(function(block) { return block.longName(); })
  );
  return db;
};
/** @return all the blocks in this Stack, excluding parent blocks.
 * Axes with a single non-parent block are included.
 * This is a different criteria to @see Stack.prototype.dataBlocks();
 * this function is probably not yet used / debugged.
 */
Stack.prototype.dataBlocks0 = function ()
{
  /** set of all of this.axes, minus those which have a block referring to them as .parent */
  let blockSet = new WeakSet(this.axes),
  result;
  this.axes.reduce(
    function (result, a) {
      let aParent = a.parent;
      if (aParent && blockSet.has(aParent))
        blockSet.delete(aParent);
      return result;
    },
    blockSet);
  result = this.axes.filter(function (a) {
    return blockSet.has(a);
  });
  return result;
};
/** Passed to d3 .data() to identify the DOM element correlated with the axis. */
Stacked.prototype.keyFunction = function (axisID)
{
  return axisID;
};
/** Text used in axis title, for each of the blocks (parent / reference and child / data blocks).
 * This is the text shown in the <tspan>
 */
Block.prototype.titleText = function ()
{
  let axisName = this.block.get('id'),
  cmName = oa.cmName[axisName],
  shortName = cmName && cmName.dataset.get('meta.shortName'),
  name = shortName || cmName.mapName;
  // console.log('Block titleText', cmName, shortName, name, cmName.scope);
  return name + " : " + cmName.chrName;
};
/** @return maximum length of the titles of the viewed blocks. */
Block.titleTextMax = function (axisName)
{ 
  // later can use .get('blockService').get('viewed')
  let
    lengthMax = d3.keys(stacks.blocks).reduce(function (result, a) {
      let block = stacks.blocks[a],
      isViewed = block && block.block.get('isViewed'),
      title = isViewed && block.titleText(),
      length = title && title.length;
      // console.log('titleTextMax', result, a, block, isViewed, title, length);
      if (length > result)
        result = length;
      return result;
    }, 0);
  return lengthMax;
};

/** Constructor for Stack type.
 * Construct a Stacked containing 1 axis (axisName, portion),
 * and push onto this Stack.
 */
function Stack(stackable) {
  console.log("new Stack", oa, stacks.nextStackID);
  this.stackID = stacks.nextStackID++;
  /** The axis object (Stacked) has a reference to its parent stack which is the inverse of this reference : 
   * axes{axisName}.stack.axes[i] == axes{axisName} for some i.
   */
  this.axes = [];
  Stack.prototype.add = Stack_add;
  this.add(stackable);
  console.log(this, stackable, ".stack", stackable.stack);
};
/**  Wrapper for new Stack() : implement a basic object re-use.
 *
 * The motive is that as a axis is dragged through a series of stacks, it is
 * removed from its source stack, inserted into a destination stack, then as
 * cursor drag may continue, removed from that stack, and may finally be
 * moved into a new (empty) stack (dropOut()).  The abandoned empty stacks
 * are not deleted until dragended(), to avoid affecting the x positions of
 * the non-dragged stacks.  These could be collected, but it is simple to
 * re-use them if/when the axis is dropped-out.  By this means, there is at
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
/** undefined, or references to the axis (Stacked) which is currently dropped
 * and the Stack which it is dropped into (dropIn) or out of (dropOut).
 * properties :
 * out : true for dropOut(), false for dropIn()
 * stack: the Stack which axisName is dropped into / out of
 * 'axisName': axisName,
 * dropTime : Date.now() when dropOut() / dropIn() is done
 *
 * static
 */
Stack.currentDrop = undefined;
/** undefined, or name of the axis which is currently being dragged. */
Stack.currentDrag = undefined;
/** @return true if this.axes[] is empty. */
Stack.prototype.empty = function ()
{
  return this.axes.length === 0;
};
/** @return axes of this Stack,
 * in an array.
 *
 * (This was more significant, then named .parentAxis(), before blocks[] were
 * split of of .axes[]; now .axes[*].referenceBlock is a parent; may have value
 * as an abstraction layer ?).
 */
Stack.prototype.parentAxes = function ()
{
  return this.axes;
};
/** @return parent axis IDs of this Stack,
 * in an array
 */
Stack.prototype.parentAxisIDs = function ()
{
  return this.parentAxes().map(function (s) { return s.axisName; });
};
/** @return count of parent axes in this Stack,
 */
Stack.prototype.parentAxesCount = function ()
{
  return this.axes.length;
};

/** @return array of axisIDs of this Stack */
Stack.prototype.axisIDs = function ()
{
  let a =
    this.axes.map(function(s){return s.axisName;});
  return a;
};
Stack.prototype.toString = function ()
{
  let a =
    [
      "{axes=[",
      this.axes.map(function(s){return s.toString();}),
      "] length=" + this.axes.length + "}"
    ];
  return a.join("");
};
Stack.prototype.log = function ()
{
  console.log("{stackID=", this.stackID, ", axes=[");
  this.axes.forEach(function(s){s.log();});
  console.log("] length=", this.axes.length, "}");
  this.logElt();
};
Stack.prototype.logElt = function ()
{
  let s = d3.select(selectPrefix + "> g#id" + this.stackID + ".stack");
  console.log("logElt", s.node());
};
Stack.prototype.verify = function ()
{
  let me = this;
  if (this.axes.length == 0)
  {
    this.log();
    /* breakPointEnableSet(1);
     breakPoint(); */
  }
  else
    /* traverse the axes of this stack. */
    this.axes.forEach(
      function (a, index)
      {
        let axis = oa.axes[a.axisName],
        /** true if the parent of axis a is stack me.  */
        v1 = a.stack === me,
        /** children (blocks) of axis a, not including parent. */
        c = a.children(false, false),
        /** clear v2 if stack me is not the stack of one of the children c.  */
        v2 =
          c.reduce(function (result, c1a) { return result && (c1a.getStack() === me); }, true );
        if (!v1 || !v2)
        {
          console.log("v1", v1, "v2", v2, axis, c);
          me.log();
          breakPoint();
        }
        /* this skips empty array elements anyway
         * a.blocks.map(function (b) { if (! b) breakPoint(a, a.blocks, b);});
         * so :
         */
        if (a.blocks.length && (a.blocks[0] === undefined))
        {
          console.log(a, a.blocks, '[0] is undefined');
          a.blocks.splice(0, 1);
        }
        a.verify();
      });
};
/** Attributes of the stacks object.
 *
 * stacks.toDeleteAfterDrag
 * stack left empty by dropOut(); not deleted until dragended(), to avoid
 * affecting the x positions of the non-dragged stacks.  @see new_Stack()
 *
 * stacks.changed
 * true when an axis and/or stack has been moved during this drag; this triggers
 * axisStackChanged() to be called to update the drawing.
 * The update is split in 2 because x locations of stacks do not update during the drag,
 * except the dragged axis,  (@see dragended() ) :
 *   0x01 : drag has not finished - interim redraw;
 *   0x10 : drag has finished.  The final x locations of stacks have been calculated.
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
  try {
    stacks.forEach(function(s){s.verify();});
  }
  catch (e)
  {
    breakPoint('Stack.verify', e, this);
  }
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
/** @return an array of the blockIds of the reference blocks of all axes (in all
 * stacks).  */
stacks.axisIDs = function()
{
  return d3.keys(this.axesP);
};
/** @return an array of the blockIds of the all the blocks of all axes (in all
 * stacks).  */
stacks.blockIDs = function()
{
  // this.axisIDs() are contained in this.blocks.
  let
    blockIDs = d3.values(this.blocks).reduce(function (result, b) {
      if (b.axis) result.push(b.axisName);
      return result; }, []);
  return blockIDs;
};

/** Sort the stacks by the x position of their Axes. */
stacks.sortLocation = function()
{
  stacks.sort(function(a, b) { return a.location() - b.location(); });
};
/** Return the x location of this stack.  Used for sorting after drag. */
Stack.prototype.location = function()
{
  let l = this.axes[0].location();
  checkIsNumber(l);
  return l;
};
/** Find this stack within stacks[] and return the index.
 * @return -1 or index of the parent stack of axis
 */
Stack.prototype.stackIndex = function ()
{
  /** Could cache result in s; this function is often used; may not affect speed much. */
  let s = this, i = stacks.indexOf(s);
  return i;
};
/** Passed to d3 .data() to identify the DOM element correlated with the Stack.
 * @param this  parent of g.stack, i.e. svgContainer
 */
Stack.prototype.keyFunction = function (stack, i, group)
{
  /** keyFunction is called with `this` being the parent group nodes, then the selected elements.
   * Different values are passed for group in those 2 cases, where p = group.__proto__ :
   * `this` is :
   *  g.stack :  p === NodeList.prototype;
   *  the group argument :  p === Array.prototype, or p.isPrototypeOf(Array())
   */
  let thisIsParent = group.__proto__ === Array.prototype;
  if (trace_stack > 1)
    console.log(thisIsParent ? '' : this, stack.stackID, i);
  return stack.stackID;
};
/** Use the position of this stack within stacks[] to determine g.axis-outer element classes.
 *
 * Use : the classes are used in css selectors to determine text-anchor.
 * If the stack is at the left or right edge of the diagram, then the titles
 * of Axes in the stack will be displayed on the outside edge, so that paths
 * between Axes (in .foreground) won't obscure the title.
 *
 * @return "leftmost" or "rightmost" or "" (just one class)
 */
Stack.prototype.sideClasses = function ()
{
  let i = this.stackIndex(), n = stacks.length;
  let classes = (i == 0) ? "leftmost" : ((i == n-1) ? "rightmost" : "");
  return classes;
};
/** Find stack of axisID and return the index of that stack within stacks.
 * static
 * @param axisID name of axis to find
 * @return -1 or index of found stack
 */
Stack.axisStackIndex = function (axisID)
{
  let s = Stacked.getStack(axisID), i = s  ? s.stackIndex() : -1;
  if (i == -1)
  {
    breakPoint('Stack.axisStackIndex', axisID);
  }
  return i;
};
/** Find stack of axisID and return the index of that stack within stacks.
 * Similar logic to axisStackIndex(); this also returns apIndex
 * (i.e. result is a hash of 2 values).
 * static
 * @param axisID name of axis to find
 * @return undefined or
 *  {stackIndex: number, axisIndex: number}.
 * @see axisStackIndex()
 */
Stack.axisStackIndex2 = function (axisID)
{
  /** can use instead :  s = Stacked.getStack(axisID) */
  let axis = oa.axes[axisID];
  if (axis === undefined)
    return undefined;
  else
  {
    let s = axis.getStack();
    if (! s)
      return undefined;
    let i = s.stackIndex();
    /** data structure check */
    let j;
    if ((i === -1) || (stacks[i] !== s) || (j=s.axes.indexOf(axis), s.axes[j].axisName != axisID))
    {
      console.log("stackIndex", axisID, i, axis, s, j, s.axes[j]);
      breakPoint('axisStackIndex2');
    }
    return {stackIndex: i, axisIndex: j};
  }
};

if (false)  /** not used - @see Stack_add()  */
  Stack.prototype.add = function(stackable)
{
    this.axes.push(stackable);
    stackable.stack = this;
    oa.axes[stackable.axisName] = stackable;
    console.log("Stack.prototype.add", this, stackable);
  };
/** not used */
Stack.prototype.addAxis = function(axisName, portion)
{
  console.log("Stack.prototype.addAxis", axisName, portion);
  let sd = new Stacked(axisName, portion);
  this.add(sd);
};
/** Method of Stack.  @see Stack.prototype.add().
 * Add the given axis to this Stack.
 * @param sd  (stackable) Stacked / axis to add
 */
function Stack_add (sd)
{
  console.log("Stack_add", this, sd);
  this.axes.push(sd);
  sd.stack = this;
};
/** Insert stacked into axes[] at i, moving i..axes.length up
 * @param i  same as param start of Array.splice()
 * @see {@link https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/splice | MDN Array Splice}
 */
Stack.prototype.insert = function (stacked, i)
{
  let len = this.axes.length;
  // this is supported via splice, and may be useful later, but initially it
  // would indicate an error.
  if ((i < 0) || (i > len))
    console.log("insert", stacked, i, len);

  this.axes = this.axes.insertAt(i, stacked);
  /* this did not work (in Chrome) : .splice(i, 0, stacked);
   * That is based on :
   * https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
   * Similarly in 2 other instances in this file, .removeAt() is used instead of .splice().
   */

  stacked.stack = this;
};
/** Find axisName in this.axes[]. */
Stack.prototype.findIndex = function (axisName)
{
  let fi = this.axes.findIndex(Stacked.axisName_match(axisName));
  return fi;
};
/** Find axisName in this.axes[] and remove it.
 * @return the axis, or undefined if not found
 */
Stack.prototype.remove = function (axisName)
{
  let si = this.findIndex(axisName);
  if (si < 0)
  {
    console.log("Stack#remove named axis not in this stack", this, axisName);
    return undefined;
  }
  else
  {
    let s = this.axes[si];
    this.axes = this.axes.removeAt(si, 1);
    // .splice(si, 1);
    return s;
  }
};
/** Similar to @see Stack.prototype.remove(), a different signature.
 * @param axis reference to Stacked (axis) object
 */
Stack.prototype.remove2 = function (axis)
{
  let si = this.axes.indexOf(axis);
  if (si < 0)
  {
    console.log("Stack#remove axis not in this stack", this, axis.longName());
  }
  else
  {
    this.axes = this.axes.removeAt(si, 1);
  }
};
/** Remove the nominated axis (Stacked) from this Stack;
 * if this Stack is now empty, remove it from stacks[].
 * static
 * @param axisName  name of axis to remove
 * @return undefined if not found, else -1, or stackID if the parent stack is also removed.
 * -1 indicates that the Stacked was removed OK and its parent was not removed because it has other children.
 */
Stack.removeStacked = function (axisName)
{
  let result;
  console.log("removeStacked", axisName);
  let axis = oa.axes[axisName];
  if (axis === undefined)
  {
    console.log("removeStacked", axisName, "not in", axes);
    result = undefined; // just for clarity. result is already undefined
  }
  else
  {
    let stack = axis.stack;
    result = stack.removeStacked1(axisName);
    if (result === undefined)
      result = -1; // OK
  }
  if (trace_stack)
    console.log("removeStacked", axisName, result);
  return result;
};
/** Remove the nominated axis (Stacked) from this Stack;
 * if this Stack is now empty, remove it from stacks[].
 *
 * @param axisName  name of axis to remove
 * @return this.stackID if this is delete()-d, otherwise undefined
 * @see Stack.removeStacked(), which calls this.
 */
Stack.prototype.removeStacked1 = function (axisName)
{
  let result;
  let axis = oa.axes[axisName],
  removedAxis = this.remove(axisName);
  if (removedAxis === undefined)
    console.log("removeStacked", axisName);
  else
  {
    delete oa.axes[axisName];  // or delete axis['axis']
    delete axesP[axisName];
  }
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
    let released = axis.portion;
    axis.portion = 1;
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
 * Move named axis from one stack to another.
 * `this` is the source stack.
 * If first stack becomes empty - delete it.
 * If 2nd stack (destination) is new - create it (gui ? drag outside of top/bottom drop zones.)
 * @param axisName name of axis to move
 * @param toStack undefined, or Stack to move axis to
 * @param insertIndex  index in toStack.axes[] to insert
 *
 * if toStack is undefined, create a new Stack to move the axis into;
 * The position in stacks[] to insert the new Stack is not given via params,
 * instead dragged() assigns x location to new Stack and sorts the stacks in x order.
 *
 * @return undefined if not found, or an array.
 * If `this` is empty after the move, it is deleted, otherwise the result
 * array contains `this`; this is so that the caller can call
 * .calculatePositions().
 */
Stack.prototype.move = function (axisName, toStack, insertIndex)
{
  let result = undefined;
  let s = this.remove(axisName);
  // if axisName is not in this.axes[], do nothing
  let ok = s !== undefined;
  if (ok)
  {
    if (toStack === undefined)
    {
      toStack = new_Stack(s);
      /* Need to call .calculatePositions() for this and toStack;
       * That responsibility is left with the caller, except that
       * caller doesn't have toStack, so .move() looks after it.
       * No : axis.position and .portion are updated after .move()
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
       * If source stack has only 1 axis, then dropOut() deletes the stack
       * and stacks to its right shift left in the array to fill the gap;
       * That causes : destination stack moves to x of source stack when
       * dragging to the right, iff the source stack has only 1 axis.
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
/** Shift named axis to a different position within this Stack.
 * Portions will be unchanged, positions will be re-calculated.
 * Find axisName in this.axes[] and move it.

 * @param axisName name of axis to move
 * @param insertIndex  index in toStack.axes[] to insert
 * @return the axis, or undefined if not found
 */
Stack.prototype.shift = function (axisName, insertIndex)
{
  let si = this.findIndex(axisName);
  if (si < 0)
  {
    console.log("Stack#remove named axis not in this stack", this, axisName);
    return undefined;
  }
  else
  {
    let s = this.axes[si];
    console.log("shift(), before removeAt()", this, axisName, insertIndex, this.axes.length, s);
    this.log();
    this.axes = this.axes.removeAt(si, 1);
    let len = this.axes.length;
    this.log();
    if (insertIndex >= len)
      console.log("shift()", this, axisName, insertIndex, " >= ", len, s);
    let insertIndexPos = (insertIndex < 0) ? len + insertIndex : insertIndex;
    // splice() supports insertIndex<0; if we support that, this condition need
    if (si < insertIndexPos)
      insertIndexPos--;
    this.axes = this.axes.insertAt(insertIndexPos, s);
    console.log("shift(), after insertAt()", insertIndexPos, this.axes.length);
    this.log();
    return s;
  }
};
/** @param axisName may be a blockId, @see featureStackAxes()
 * @return true if this Stack contains axisName
 */
Stack.prototype.contains = function (axisName)
{
  let stack = Stacked.getStack(axisName);
  /** or  
   let axis = axesP[axisName] || oa.axes[axisName].parent,
   stack = axis.stack;
   */
  if (! stack)
    console.log("contains", axisName, axesP[axisName], oa.axes[axisName].parent);
  return this === stack;
};
/** Insert the named axis into this.axes[] at insertIndex (before if top, after
 * if ! top).
 * Preserve the sum of this.axes[*].portion (which is designed to be 1).
 * Give the new axis a portion of 1/n, where n == this.axes.length after insertion.
 *
 * share yRange among Axes in stack
 * (retain ratio among existing Axes in stack)
 *
 * @param axisName name of axis to move
 * @param insertIndex position in stack to insert at.
 * @param true for the DropTarget at the top of the axis, false for bottom.
 * @param transition  make changes within this transition
 */
Stack.prototype.dropIn = function (axisName, insertIndex, top, transition)
{
  let axes = oa.axes;
  console.log("dropIn", this, axisName, insertIndex, top);
  let fromStack = axes[axisName].stack;
  /* It is valid to drop a axis into the stack it is in, e.g. to re-order the Axes.
   * No change to portion, recalc position.
   */
  if (this === fromStack)
  {
    console.log("Stack dropIn() axis ", axisName, " is already in this stack");
    this.shift(axisName, insertIndex);
    return;
  }
  /** Any axis in the stack should have the same x position; use the first
   * since it must have at least 1. */
  let anAxisName = this.axes[0].axisName,
  /** Store both the cursor x and the stack x; the latter is used, and seems
   * to give the right feel. */
  dropX = {event: d3.event.x, stack: oa.o[anAxisName]};
  Stack.currentDrop = {out : false, stack: this, 'axisName': axisName, dropTime : Date.now(), x : dropX};
  if (! top)
    insertIndex++;
  let okStacks =
    fromStack.move(axisName, this, insertIndex);
  // okStacks === undefined means axisName not found in fromStack
  if (okStacks)
  {
    // if fromStack is now empty, it will be deleted, and okStacks will be empty.
    // if fromStack is not deleted, call fromStack.calculatePositions()
    let axis = axes[axisName],
    released = axis.portion;
    console.log("dropIn", released, okStacks);
    okStacks.forEach(function(s) { 
      s.releasePortion(released);
      s.calculatePositions();
      s.redraw(transition); });

    // For all Axes in this (the destination stack), adjust portions, then calculatePositions().
    /** the inserted axis */
    let inserted = this.axes[insertIndex];
    inserted.stack = this;
    // apart from the inserted axis,
    // reduce this.axes[*].portion by factor (n-1)/n
    if (this.axes.length == 0)
    {
      stacks.log();
      breakPoint();
    }
    let n = this.parentAxesCount(),
    factor = (n-1)/n;
    inserted.portion = 1/n;
    this.axes.forEach(
      function (a, index) { if (index !== insertIndex) a.portion *= factor; });
    this.calculatePositions();
    stacks.changed = 0x11;
  }
};
/** Used when a axis is dragged out of a Stack.
 * re-allocate portions among remaining Axes in stack
 * (retain ratio among existing Axes in stack)
 * This is used from both dropIn() and dropOut(), for the Stack which the
 * axis is dragged out of.
 * @param released  the portion of the axis which is dragged out
 */
Stack.prototype.releasePortion = function (released)
{
  let
    factor = 1 / (1-released);
  this.axes.forEach(
    function (a, index) { a.portion *= factor; });
  this.calculatePositions();
};
/** Drag the named axis out of this Stack.
 * Create a new Stack containing just the axis.
 *
 * re-allocate portions among remaining Axes in stack
 * (retain ratio among existing Axes in stack)
 *
 * .dropIn() and .dropOut() both affect 2 stacks : the axis is dragged from
 * one stack (the term 'source' stack is used in comments to refer this) to
 * another (call this the 'destination' stack). .dropOut() may create a new
 * stack for the destination.
 *
 * @param axisName name of axis to move
 */
Stack.prototype.dropOut = function (axisName)
{
  console.log("dropOut", this, axisName);
  Stack.currentDrop = {out : true, stack: this, 'axisName': axisName, dropTime : Date.now()};

  /* passing toStack===undefined to signify moving axis out into a new Stack,
   * and hence insertIndex is also undefined (not used since extracted axis is only axis
   * in newly-created Stack).
   */
  let okStacks =
    this.move(axisName, undefined, undefined);
  /* move() will create a new Stack for the axis which was moved out, and
   * add that to Stacks.  dragged() will assign it a location and sort.
   */

  // Guard against the case that `this` became  empty and was deleted.
  // That shouldn't happen because dropOut() would not be called if `this` contains only 1 axis.
  if (okStacks && (okStacks[0] == this))
  {
    // axisName goes to full height. other Axes in the stack take up the released height proportionately
    let axis = oa.axes[axisName],
    released = axis.portion;
    axis.portion = 1;
    this.releasePortion(released);
    let toStack = axis.stack;
    toStack.calculatePositions();
    stacks.changed = 0x11;
  }
};
/** Calculate the positions of the Axes in this stack
 * Position is a proportion of yRange.
 *
 * Call updateRange() to update ys[axisName] for each axis in the stack.
 */
Stack.prototype.calculatePositions = function ()
{
  // console.log("calculatePositions", this.stackID, this.axes.length);
  let sumPortion = 0;
  this.axes.forEach(
    function (a, index)
    {
      a.position = [sumPortion,  sumPortion += a.portion];
    });
  oa.eventBus.send('stackPositionsChanged', this);
};
/** find / lookup Stack of given axis.
 * This is now replaced by axes[axisName]; could be used as a data structure
 * validation check.
 * static
 */
Stack.axisStack = function (axisName)
{
  // could use a cached structure such as axisStack[axisName].
  // can now use : axes{axisName}->stack
  let as = stacks.filter(
    function (s) {
      let i = s.findIndex(axisName);
      return i >= 0;
    });
  if (as.length != 1)
    console.log("axisStack()", axisName, as, as.length);
  return as[0];
};
/** find / lookup Stack of given axis.
 * static
 * @return undefined or
 *  {stackIndex: number, axisIndex: number}.
 *
 * See also above alternative axisStackIndex().
 * This version accumulates an array (because reduce() doesn't stop at 1).
 * It will only accumulate the first match (axisIndex) in each stack,
 * but by design there should be just 1 match across all stacks.
 * Only the first result in the array is returned, and a warning is given if
 * there are !== 1 results
 * Probably drop this version - not needed;  could be used as a data structure
 * validation check, e.g. in testing.
 */
Stack.axisStackIndexAll = function (axisName)
{
  /** called by stacks.reduce() */
  function findIndex_axisName
  (accumulator, currentValue, currentIndex /*,array*/)
  {
    let i = currentValue.findIndex(axisName);
    if (i >= 0)
      accumulator.push({stackIndex: currentIndex, axisIndex: i});
    return accumulator;
  };
  let as = stacks.reduce(findIndex_axisName, []);
  if (as.length != 1)
  {
    console.log("axisStackIndexAll()", axisName, as, as.length);
  }
  return as[0];
};
if (false)  // replaced by axisTransformO
  /** @return transform : translation, calculated from axis position within stack.
   */
  Stacked.prototype.axisTransform = function ()
{
    if (this.parent)
    {
      console.log("axisTransform", this, this.parent);
      return this.parent.axisTransform();
    }
    let yRange = stacks.vc.yRange;
    if (this.position === undefined || yRange === undefined)
    {
      console.log("axisTransform()", this.axisName, this, yRange);
      breakPoint();
    }
    let yOffset = this.yOffset(),
    yOffsetText = Number.isNaN(yOffset) ? "" : "," + this.yOffset();
    let scale = this.portion,
    scaleText = Number.isNaN(scale) ? "" : " scale(" + scale + ")";
    /** Will be undefined when axis is dragged out to form a new Stack, which
     * is not allocated an x position (via xScale()) until dragended().  */
    let xVal = x(this.axisName);
    if (xVal === undefined)
      xVal = oa.o[this.axisName];
    checkIsNumber(xVal);
    xVal = Math.round(xVal);
    let transform =
      [
        "translate(" + xVal, yOffsetText, ")",
        scaleText
      ].join("");
    console.log("axisTransform", this, transform);
    return transform;
  };
if (false)  // replaced by axisTransformO
  /** Get stack of axis, return transform. */
  Stack.prototype.axisTransform = function (axisName)
{
    let a = oa.axes[axisName];
    return a.axisTransform();
  };
/** Get stack of axis, return transform. */
Stack.prototype.axisTransformO = function (axisName)
{
  let 
    /* or : ((block = stacks.blocks[axisName]) && block.axisTransformO())
     * || ((axis = axes[axisName]) && axis.axisTransformO())
     */
    a = axes[axisName],
  axis = a.getAxis();
  return axis.axisTransformO();
};
/** For each axis in this Stack, redraw axis, brush, foreground paths.
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
  /** to make this work, would have to reparent the Axes - what's the benefit
   * let ts = 
   *   t.selectAll("g.stack#" + eltId(this.stackID) + " > .axis-outer");
   */
  console.log("redraw() stackID:", this.stackID);
  let this_Stack = this;  // only used in trace

  this.axes.forEach(
    function (a, index)
    {
      /** Don't use a transition for the axis/axis which is currently being
       * dragged.  Instead the dragged object will closely track the cursor;
       * may later use a slight / short transition to smooth noise in
       * cursor.  */
      let t_ = (Stack.currentDrag == a.axisName) ? d3 : t;
      // console.log("redraw", Stack.currentDrag, a.axisName, Stack.currentDrag == a.axisName);
      let ts = 
        t_.selectAll(".axis-outer#" + eltId(a.axisName));
      (trace_stack_redraw > 0) &&
        (((ts._groups.length === 1) && console.log(ts._groups[0], ts._groups[0][0]))
         || ((trace_stack_redraw > 1) && console.log("redraw", this_Stack, a, index, a.axisName)));
      // console.log("redraw", a.axisName);
      // args passed to fn are data, index, group;  `this` is node (SVGGElement)
      ts.attr("transform", Stack.prototype.axisTransformO);
      axisRedrawText(a);
    });

  this.redrawAdjacencies();
};

function axisRedrawText(a)
{
  let svgContainer = oa.svgContainer,
  g_axisall_id = "g.axis-all#" + eltIdAll(a.axisName);
  let axisTS = svgContainer.selectAll(g_axisall_id + " > text");
  // console.log('axisRedrawText', g_axisall_id, axisTS.nodes(), axisTS.node());
  axisTS.attr("transform", yAxisTitleTransform(oa.axisTitleLayout));
  let axisGS = svgContainer.selectAll("g.axis#" + axisEltId(a.axisName) + " > g.tick > text");
  axisGS.attr("transform", yAxisTicksScale);
  let axisBS = svgContainer.selectAll("g.axis#" + axisEltId(a.axisName) + " > g.btn > text");
  axisBS.attr("transform", yAxisBtnScale);
}

/** For each axis in this Stack, redraw axis title.
 * The title position is affected by stack adjacencies.
 * Dragging a stack can affect the rendering of stacks on either side of its start and end position.
 */
Stack.prototype.redrawAdjacencies = function ()
{
  let stackClass = this.sideClasses();

  this.axes.forEach(
    function (a, index)
    {
      /** transition does not (yet) support .classed() */
      let as = oa.svgContainer.selectAll(".axis-outer#" + eltId(a.axisName));
      as.classed("leftmost", stackClass == "leftmost");
      as.classed("rightmost", stackClass == "rightmost");
      as.classed("not_top", index > 0);
    });
};
//-    import {} from "../utils/axis.js";

//-    import {} from "../components/stacks.js";
//-    import {} from "../utils/stacks.js";

/*------------------------------------------------------------------------*/

/** width of the axis.  either 0 or .extended (current width of extension) */
Stacked.prototype.extendedWidth = function()
{
  // console.log("Stacked extendedWidth()", this, this.extended);
  return this.extended || 0;
};

/** @return range of widths, [min, max] of the Axes in this stack */
Stack.prototype.extendedWidth = function()
{
  let range = [undefined, undefined];
  this.axes.forEach(
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
 * sum of stacks, constant inter-space,  within each stack use max of .extendedWidth().
 * (combine) 2 scales - map stack key to domain space, then to range.
 * Sum the stack widths, use .range() to span the free space remaining, and add
 * a cumulative amount for the stack widths to the left of a given stack.
 * Replaces @see xScale() when axes may be split - .extended
 */
function xScaleExtend()
{
  /* .extended is measured in the range space (pixels),
   * so calculate space between axes.
   */
  /** parallel to stacks[]. */
  let widthRanges = stacks.map(
    function(s){ let widthRange = s.extendedWidth(); return widthRange;}
  );
  if (trace_stack > 1)
    stacks.map(function(s) { console.log(s.axes[0].mapName, s.axes[0].extended); });
  let widths = widthRanges.map(
    function(widthRange){ return widthRange[1];}
  ),
  widthsSum = widths.reduce(
    function(sum, width){ return sum + width;}, 0
  );

  let axisXRange = stacks.vc.axisXRange.copy(false); // shallow copy
  axisXRange[1] -= widthsSum;
  // 40 allows for width of axis ticks / text,  etc and a bit of padding
  stacks.axisXRangeMargin = axisXRange[1] - stacks.length * 40;
  let stackDomain = Array.from(stacks.keys()); // was axisIDs

  console.log("xScaleExtend", widthRanges, widths, widthsSum, stacks.vc.axisXRange, axisXRange, stackDomain);
  let v = variableBands,  CombinedScale = v();
  // let gapScale = // d3.scaleOrdinal()
  CombinedScale
    .domain(stackDomain)
  ;
  CombinedScale
    .range(axisXRange)
  ;
  CombinedScale.scale
    .widths(widths)
  ;

  return CombinedScale;
  // .unknown(axisXRange*0.98) ?
}



/*------------------------------------------------------------------------*/

/** x scale which maps from axisIDs[] to equidistant points in axisXRange
 */
//d3 v4 scalePoint replace the rangePoint
//let x = d3.scaleOrdinal().domain(axisIDs).range([0, w]);
function xScale() {
  let stackDomain = Array.from(stacks.keys()); // was axisIDs
  console.log("xScale()", stackDomain);
  return d3.scalePoint().domain(stackDomain).range(stacks.vc.axisXRange);
}

/** @return the scale of Axis axisID.  */
//- param axisID seems unnecessary - check this
function x(axisID)
{
  let i = Stack.axisStackIndex(axisID);
  if (oa.xScaleExtend.domain().length === 2)
    console.log("x()", axisID, i, oa.xScaleExtend(i), oa.xScaleExtend.domain(), oa.xScaleExtend.range());
  if (i === -1) { console.log("x()", axisID, i); breakPoint(); }
  return oa.xScaleExtend(i);
}
stacks.x = x;


Stacked.prototype.location = function() { return checkIsNumber(oa.o[this.axisName]); };
Block.prototype.axisTransformO = function ()
{
  let transform;
  if (this.parent)
    transform = this.parent.axisTransformO();
  else
    breakPoint("axisTransformO", this, this.parent);
  return transform;
};
/** Same as .axisTransform(), but use o[d] instead of x(d)
 * If this works, then the 2 can be factored.
 * @return transform : translation, calculated from axis position within stack.
 */
Stacked.prototype.axisTransformO = function ()
{
  let yRange = stacks.vc.yRange;
  if (this.position === undefined || yRange === undefined)
  {
    console.log("axisTransformO()", this.axisName, this, yRange);
    breakPoint();
  }
  let yOffset = this.yOffset(),
  yOffsetText =  Number.isNaN(yOffset) ? "" : "," + this.yOffset();
  /** x scale doesn't matter because x is 0; use 1 for clarity.
   * no need for scale when this.portion === 1
   */
  let scale = this.portion,
  scaleText = Number.isNaN(scale) || (scale === 1) ? "" : " scale(1," + scale + ")";
  let xVal = checkIsNumber(oa.o[this.axisName]);
  xVal = Math.round(xVal);
  let rotateText = "", axis = oa.axes[this.axisName];
  if (! axis)
  {
    /* If the __data of g.axis* has not been updated during adoption of an axis,
     * handle it here with some trace.
     * This is equivalent to axis = Stacked.getAxis(this.axisName), plus some
     * trace. */
    let block;
    if ((axis = oa.stacks.axes[this.axisName]))
      console.log('axisTransformO', 'use axes[]', this.axisName, axis);
    else if ((block = oa.stacks.blocks[this.axisName]) && block.axis)
    {
      axis = block.getAxis();
      console.log('axisTransformO', 'use blocks[] .axis', this.axisName, axis);
    }
  }
  if (axis.perpendicular)
  {
    /** shift to centre of axis for rotation. */
    let shift = -yRange/2;
    rotateText =
      "rotate(90)"
      +  " translate(0," + shift + ")";
    let a = d3.select("g#id" + this.axisName + ".axis-outer");
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
    console.log("axisTransformO", this, transform);
  return transform;
};

/*----------------------------------------------------------------------------*/

export  { Block, Stacked, Stack, stacks, xScaleExtend, axisRedrawText,
          axisId2Name
        } ;
