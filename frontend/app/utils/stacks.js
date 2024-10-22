// for VLinePosition :
import { assert } from '@ember/debug';

import { later, bind } from '@ember/runloop';
import EmberObject, { get, set as Ember_set } from '@ember/object';

import { isEqual } from 'lodash/lang';


/*global d3 */

/*----------------------------------------------------------------------------*/

import  { dragTransitionEnd } from '../utils/stacks-drag';
import { round_2, checkIsNumber } from '../utils/domCalcs';
import {
  Axes,
  noDomain,
  yAxisTextScale,
  yAxisTicksScale,
  axisConfig,
  yAxisBtnScale,
  yAxisTitleTransform,
  eltId,
  axisEltId,
  eltIdAll,
  highlightId,
  axisTitleColour
} from './draw/axis';
import { variableBands } from '../utils/variableBands';
import { isOtherField } from '../utils/field_names';
import { Object_filter } from '../utils/Object_filter';
import { breakPoint, breakPointEnableSet } from '../utils/breakPoint';
import { dLog } from './common/log';

/*
import DrawStackObject from '../utils/draw/stack';
 causes module load order to make Stack undefined in :
DrawStackViewComponent.log = Stack.log;
*/

/*----------------------------------------------------------------------------*/

Object.filter = Object_filter;

/*----------------------------------------------------------------------------*/

const trace_stack = 0;
const trace_updatedStacks = true;

/** px vertical gap between axes in a stack.
 * This can be made an attribute of Stack, and reduce it when
 * yRange / Stack.axes.length is not much larger than axisGap.
 */
const axisGap = 20;

/** same as @see draw-map.js */
const axisTitle_dataBlocks = false;


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
/** draw/axis-1d components, indexed by blockId of the parent / reference block.
 * This will likely not be needed after axis-1d is more closely integrated with
 * Stacked, e.g. the Stacked would be created by the axis-1d init().
 */
var axes1d;
let blocks;

//- maybe change stacks to a class Stacks(), and instantiate wth new Stacks(oa)
/** also vc is copied to stacks.
*/
stacks.init = function (oa_)
{
  let initData = stacks.nextStackID === undefined;
  oa = oa_;
  /** initialised in controllers/mapview.js : init() */
  if (stacks.oa !== oa_) {
    dLog('stacks.init', stacks, 'oa', oa_);
  }
  if (initData)
  {
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

    axes1d = stacks.axes1d = {};
    stacks.axesPCount = EmberObject.create({ count: 0 });
    /* Counts which are used as ComputedProperty dependencies, so that stacks.js
     * classes imperative actions can feed into CP data flows.
     * This can merge with axesPCount as .counts.{axesP,stacks} */
    stacks.stacksCount = EmberObject.create({ count: 0 });

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
  dLog("Block()", this, block, axisName);
}
/** At some point .axisName will be renamed to .blockId; this function will make
 * that transparent, and avoid confusion with .getAxis().
 * @return blockId of this block, aka .axisName
 */
Block.prototype.getId = function()
{
  return this.axisName;
};
/** Set .axis
 *
 * Because .axis is used as a dependent key in a ComputedProperty, treat value as final.
 * @param a axis (Stacked)
 */
Block.prototype.setAxis = function(a)
{
  if (trace_stack) {
    dLog('setAxis', !!this.block.set, a);  this.log();
  }
  Ember_set(this, 'axis', a);

  if (false)
  /* The block-adj CP axes depends on .axislater, setting this field triggers a
   * render, so without run.later the code following the call to setAxis() would
   * be skipped.
   * .axislater has the same value as .axis, but setting it is deferred until
   * the end of the current run loop, for this reason.  This is a work-around;
   * planning to see the stacks / axes as part of the model and update them
   * before render.
   */
    later(() => {
      if (this.set)
        this.set('axislater', a);
      else
        this.axislater = a;
    });
};
/** @return axis of this block or if it has a parent, its parent's axis */
Block.prototype.getAxis = function()
{
  if (this.isDestroying || this.axis?.isDestroying) {
    return undefined;
  }
  let axis = this.axis;
  /* This guards against this.axis being a former axis of `this` (may have been
   * retired during adoption), which seems to happen but perhaps should not.
   */
  if (! axis || (axis.blocks.length === 0)) {
    if (axis)
    { dLog('Block:getAxis', axis); axis.log(); }
    axis = (this.parent && this.parent.getAxis());    
  }
  return axis;
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
  dLog(
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
/** @return true if this Block is a reference, not data block.
 * A genetic map block is a data block and has no reference block; for the purpose of stacks it is the reference.
 * Also @see isData()
 */
Block.prototype.isReference = function() {
  let axis = this.getAxis(),
  blockR = this.block,
  isReference =
    (axis.referenceBlock === blockR);
  return isReference;
};
/** @return truthy if the dataset of this Block has a parent.
 * A genetic map block is a data block and has no reference block; for the purpose of stacks it is the reference.
 * @return e.g. null if (dp is a promise and) no parent
 * @see isData()
 * @see isReference()
 */
Block.prototype.datasetHasParent = function() {
  let dataset = this.block.get('datasetId'),
  dp = dataset.get('parent'),
  hasParent = dp && (dp.isPending ? dp.get('content') : dp);
  dLog('datasetHasParent', dataset, dp, hasParent); this.log();
  return hasParent;  
};
/** @return true if this Block is a data block, not the reference block.
 */
Block.prototype.isData = function(showPaths) {
  let
  blockR = this.block,
  /** The most significant check here is blockR.get('featureCount'); now that we
   * have this information readily information in the frontend that is the best
   * way to distinguish a data block, and the other checks can be retired.
   *
   * The .namespace check may identify GMs, but some
   * (e.g. Quraishi_2017_consensus) being a consensus of data from multiple
   * namespaces don't have a .namespace.
   *
   * The check on features.length is fine if the features are loaded into the
   * frontend - catch 22 because isData() is used by dataBlocks() which is used
   * in populating the blocks parameter of getBlockFeaturesInterval().
   * (checking if features is defined and features.length > 0)
   */
  isData = blockR.get('isData');
    // (blockR.get('namespace') || blockR.get('isChartable') || blockR.get('features.length') || blockR.get('featureCount') || ! this.isReference());
  if (showPaths) {
    isData &&= blockR.get('showPaths');
  }
  return isData;
};


/** @return undefined or .longName() of block if blockId is loaded.
 * (static)
 */
Block.longName = function (blockId) {
  let block = stacks.blocks[blockId];
  return block && block.longName();
};
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
  /* Pick up the reference to the corresponding axis-1d component, in the case
   * that it was created before this Stacked.  */
  this.getAxis1d();
  /* axis objects persist through being dragged in and out of Stacks. */
  axesP[axisName] =
  oa.axes[axisName] = this;
  stacks.axesPCount.incrementProperty('count');
}
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
/** Enable axis-1d to correlate with blockId.
 * axesP[axisName].axis1d is also set to axis1dComponent, but axesP[axisName] may not have been created yet.
 */
Stacked.axis1dAdd = function (axisName, axis1dComponent) {
  axes1d[axisName] = axis1dComponent;
};
Stacked.axis1dRemove = function (axisName, axis1dComponent) {
  if (axes1d[axisName] !== axis1dComponent)
    assert('axis1dRemove', axes1d, axisName, axis1dComponent);
  else
    delete axes1d[axisName];
};
Stacked.prototype.getAxis1d = function () {
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
  let s = this.stack,
  stackLength = (s ? s.length : ''),
  /** don't evaluate CP when destroying */
  portion = this.isDestroying ? 'isDestroying' : round_2(this.portion),
  a =
    [ "{axisName=", this.axisName, ":", this.axisName, ", portion=" + portion,
      positionToString(this.position) + stackLength, "}" ];
  return a.join("");
};
Stacked.prototype.log = function ()
{
  if (this.blocks.length && (this.blocks[0] === undefined))
  {
    dLog(this, this.blocks, '[0] is undefined');
    this.blocks.splice(0, 1);
  }
  dLog
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
    dLog(i, b.axisName, b.block.get('id'));
  }
};
/** corresponds to svgContainer */
const selectPrefix = "div#holder > svg > g";
Stacked.prototype.logElt = function ()
{
  let a = d3.select(selectPrefix + "> g.stack > g#id" + this.axisName + ".axis-outer");
  dLog("logElt", a.node());
};
/** S for stacks Block, as distinct from the (ember store) block record.
 * @return the Block object corresponding to the block record .referenceBlock;
 */
Stacked.prototype.referenceBlockS = function ()
{
  // verification
  let blockS = this.referenceBlock && this.referenceBlock.view;
  /** check if this axis still exists - may be just a child Block now. */
  if (! axesP[this.axisName]) {
    breakPoint('referenceBlockS', this, blockS, this.axisName);
  }
  else if (! this.blocks.length) {
    breakPoint('referenceBlockS', this, blockS, this.blocks);
  }
  else
  if (blockS != this.blocks[0])
    breakPoint('referenceBlockS', this, blockS, this.blocks);
  return this.blocks[0];
};
Stacked.prototype.getStack = function ()
{
  return this.stack;
};
/** static */
Stacked.getAxis = function (axisID)
{
  let axis;
  // during transition axisID may be blockId or axis-1d
  if (typeof axisID === 'string') {
    let blockService = oa.eventBus.blockService;
    const block = blockService.peekBlock(axisID);
    axis = block.axis1d;
  } else {
    // axis._debugContainerKey === 'component:draw/axis-1d'
    axis = axisID;
  }
  return axis;
};
Stacked.getAxis_orig = function (axisID)
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
/** From the datasetName and scope extracted from selectedFeatures.Chromosome,
 * find the corresponding axis.
 * (static)
 */
Stacked.axisOfDatasetAndScope = function axisOfDatasetAndScope(isReference, datasetName, scope) {
  /** blockId is the primary block of the axis (i.e. reference or GM). */
  let blockId, axis;
  for (blockId in axesP) {
    axis = axesP[blockId];
    if (axis.axisName !== blockId)
      breakPoint('axisOfDatasetAndScope', blockId, axis, axesP);
    let referenceBlock = axis.referenceBlock,
    aScope = referenceBlock.get('scope'),
    // equivalent to : axis.mapName
    referenceName = referenceBlock.get('datasetId.id'),
    matchName = isReference ? (referenceName === datasetName) :
    axis.blocks.find((b) => b.block.get('datasetId.id') === datasetName);
    if (matchName && (scope === aScope))
      break;
    else
      axis = undefined;
  }
  console.log('axisOfDatasetAndScope', isReference, datasetName, blockId, axis, scope);
  return axis;
},
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
    dLog('removeBlock(): expected blocks.length', this.blocks.length, ' to be >', blockIndex);
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
  else if (trace_stack)
    dLog('removeBlockByName', blockId, blockIndex);
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
    dLog('move(): expected blocks.length', source.blocks.length, ' to be >', blockIndex);
    source.log();
  }
  /** type is stacks:Block */
  let aBlock = source.blocks[blockIndex];
  dLog('move() before delete source.blocks', source, source.blocks, blockIndex, aBlock);
  /** delete blockIndex element of source.blocks[]; */
  let aBlockA = source.blocks.splice(0, 1);
  if (aBlockA[0] !== aBlock)  // verification
    breakPoint('move', aBlockA, '[0] !==', aBlock);
  dLog('after delete', source.blocks);

  this.blocks.push(aBlock);
};

/** Defer to the axis or parent's axis to calculate yOffset. */
Block.prototype.yOffset = function ()
{
  let yOffset;
  if (this.axis)
  {
    // dLog("yOffset via axis", this, this.axis);
    yOffset = this.axis.yOffset();
  }
  else if (this.parent)
  {
    // dLog("yOffset via parent", this, this.parent);
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
    dLog("Stacked#yOffset", yRange, this.position);
    breakPoint();
  }
  return yOffset;
};
/** @return length of the axis in pixels */
Stacked.prototype.yRange = function ()
{
  // dLog('yRange', stacks.vc.yRange, this.portion,  axisGap);
  return (stacks.vc.yRange - axisGap) * this.portion;
};
/** @return range of axis in pixels relative to 0 - the end of the stack */
Stacked.prototype.yRange2 = function ()
{
  let yRange = stacks.vc.yRange,
  position = this.position || [0, 1],
  range = position.map(function (p) { return yRange * p; });
  return range;
};
/** Access the features hash of this block.
 * The hash (currently) contains some additional block attributes, .dataset and
 * .scope, which are ignored using isOtherField[].
 */
Block.prototype.features = function ()
{
  // this function abstracts access to .z so that it can be re-structured.
  let d = this.axisName,
  /** this.z should have the value oa.z[d]. */
  z = this.z || oa.z[d];
  return z;
}
/** Calculate the domain of feature locations in the block named this.axisName.
 */
Block.prototype.domainCalc = function ()
{
  let d = this.axisName, features = this.features(),
  blockAttr = oa.cmName[d];
  function featureLocation(a)
  {
    return ! isOtherField[a] && features[a].location;
  }
  let
    domain =
    (blockAttr && blockAttr.range) ||
    (features &&
      d3.extent(Object.keys(features), featureLocation));
  if (trace_stack)
   dLog("domainCalc", this, d, features, domain);
  if (! domain || ! domain.length)
    breakPoint();
  return domain;
};
/** If the Block domain has not been calculated, then calculate it.
 * The domain should be re-calculated after features are added.
 * @return  domain, same result as .domainCalc()
 */
Block.prototype.maybeDomainCalc = function ()
{
  let d = this.domain,
  features = this.features();
  if (! d || (d.length === 2 && d[0] === false && d[1] === false))
    this.domain = this.domainCalc();
  return this.domain;
};
/** Traverse the blocks displayed on this axis, and return a domain which spans
 * their domains.
 */
Stacked.prototype.domainCalc = function ()
{
  if (trace_stack)
    dLog('domainCalc', this, this.blocks);
  let blockDomains = 
    this.blocks.map(function (b) { return b.maybeDomainCalc(); })
    .filter((domain) => domain),
  /** refn : https://github.com/d3/d3-array/issues/64#issuecomment-356348729 */
  domain = 
    blockDomains.length &&
    [
      d3.min(blockDomains, array => d3.min(array)),
      d3.max(blockDomains, array => d3.max(array))
    ];
  if (trace_stack > 1)
  {
    dLog('domainCalc', this.axisName, this.blocks.length, blockDomains, domain);
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
  let domain = this.domain
    || (this.domain = this.referenceDomain())
    || (this.domain = this.domainCalc())
  ;
  if (noDomain(domain)) {
    domain = [];
    /* shifting the responsibility of domain calculation from Stacks to blocks.js and axis-1d.
     * domainCalc() should be equivalent to axis1d.blocksDomain, but
     * resetZooms() was setting the domains to [0, 0] so possibly there has been
     * a loss of connection between the Block and it's features.
     * Also this.domain above is not recalculated after additional features are received,
     * whereas blocksDomain has the necessary dependency.
     */
    let axis1d = this.getAxis1d();
    let blocksDomain = axis1d && axis1d.get('blocksDomain');
    if (blocksDomain && blocksDomain.length) {
      dLog('getDomain()', this.axisName, domain, blocksDomain);
      /* domain.concat() is not needed, can ignore domain because noDomain() is true,
       * i.e. just d3.extent(blocksDomain)
       */
      domain = d3.extent(domain.concat(blocksDomain));
    }
  }
  return domain;
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
    /* traverse the blocks of this axis. */
    this.blocks.forEach(
      function (b, index)
      {
        let block = stacks.blocks[b.axisName],
        /** true if the parent of axis a is stack me.  */
        v1 = block.axis === me,
        v2 = (block.parent === me.blocks[0]) || (block === me.blocks[0]);
        if (!v1 || !v2)
        {
          dLog("v1", v1, "v2", v2, me, block);
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
    dLog("children", this, children);
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
    // dLog("childAxisNames", includeSelf, this, children);  this.log();
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
    // dLog("childAxisNamesGrouped", includeSelf, this, children);  this.log();
    return children;
  };
/** Return an array of the blocks which are in this stack.
 * (currently includes referenceBlock-s also).
 * @param names true means return just the block names
 */
Stack.prototype.childBlocks = function (names)
{
  let me = this,
  blocks  = Object.keys(stacks.blocks).filter(function (a) { return stacks.blocks[a].getStack() == me; } );
  if (! names)
    blocks = blocks.map(function (a) { return stacks.blocks[a]; } );
  return blocks;
};
/** @return all the blocks in this axis which are data blocks, not reference blocks.
 * Data blocks are recognised by having a .namespace;
 * @param visible if true then exclude blocks which are not visible
 * @param showPaths if true then exclude blocks which are not for paths alignment
 */
Stacked.prototype.dataBlocks = function (visible, showPaths)
{
  // draw_orig : .blocks[] was Block, equivalent is block.view for .visible, .isData()
  let db = this.blocks
    .filter(function (block) {
      return (! visible || block.view.visible)
        && block.view.isData(showPaths); });
  // if (trace_stack > 1)
    dLog(
      'Stacked', 'blocks', visible, showPaths, this.blocks.map(block_longName),
      this.axisName, this.mapName, 'dataBlocks',
      db.map(block_longName));
  return db;
};
/** @param block model:block */
function block_longName(block) { return block.view.longName(); }
/** @param blockView BlockAxisView / block-axis-view  */
function blockView_longName(blockView) { return blockView.longName(); }

/** @return all the blocks in this Stack which are data blocks, not reference blocks.
 * Data blocks are recognised by having a .namespace;
 * this is a different criteria to @see Stack.prototype.dataBlocks0().
 * @param showPaths if true then exclude blocks which are not for paths alignment
 */
Stack.prototype.dataBlocks = function (showPaths)
{
  /** Currently only visible == true is used, but could make this a param.  */
  let visible = true;
  let axesDataBlocks = this.axes
    // draw_orig : was stacked.dataBlocks(...)
    .map(function (stacked) { return stacked.dataBlockViewsFiltered(visible, showPaths); } ),
  db = Array.prototype.concat.apply([], axesDataBlocks)
  ;
  // Stacked.longName() handles blocks also.
  if (trace_stack > 1)
    dLog(
      'Stack', this.stackID, 'axes', this.axes.map(Stacked.longName),
      'dataBlocks',
      db.map(blockView_longName)
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
Stacked.prototype.keyFunction = function (axis1d)
{
  return axis1d;
};
/** Text used in axis title, for each of the blocks (parent / reference and child / data blocks).
 * This is the text shown in the <tspan.blockTitle>
 */
Block.prototype.titleText = function ()
{
  let
  axis1d = this.block.get('axis1d'), // || this.axis.getAxis1d(), // this.axis is axis-1d
  /** use '' if .axis1d not defined yet. */
  name = axis1d ? axis1d.get('axisTitleText') : '';
  if (axisTitle_dataBlocks) {
    let
    featureCount = this.block && this.block.get('featureCount'),
    featureCountLoaded = this.block.get('featuresLength'),
    featureCountText = (featureCount || featureCountLoaded) ? ' : ' + featureCountLoaded + ' / ' + featureCount : '';
    name += featureCountText;
  }
  // dLog('Block titleText', cmName, shortName, name, cmName.scope);
  return name;
};
/** @return maximum length of the titles of the viewed blocks. */
Block.titleTextMax = function (axisName)
{ 
  // later can use .get('blockService').get('viewed')
  const
  stacksView = stacks.oa.axisApi.stacksView,
  axes = stacksView.axes(),
  blockViews = axes.mapBy('blocks').flat(),
  lengthMax = blockViews.reduce(function (result, blockView) {
    const
    isViewed = blockView && blockView.block.get('isViewed'),
    /** during axisDelete() -> removeAxisMaybeStack(), updateAxisTitleSize()
     * is called, and the block being un-viewed is ignored here via ! block.axis */
    title = isViewed && blockView.axis && blockView.titleText(),
    length = title && title.length;
    // dLog('titleTextMax', result, blockView, isViewed, title, length);
    if (length > result)
      result = length;
    return result;
  }, 0);
  return lengthMax;
};

/** Use axis1d.blockIndexes() and wrap utils/draw/axis.js:axisTitleColour()
 * @param this block-axis-view
 */
Block.prototype.axisTitleColour = function ()
{
  let
  colour,
  block = this.block,
  axis1d = block.axis1d; // || this.axis; // .axis is axis-1d
  if (axis1d && ! axis1d.isDestroyed) {
    let
    blockId = this.getId(),
    blockIndexes = axis1d.get('blockIndexes'),
    /** blockIndex is not used, except to distinguish the reference block.
     * blockIndex could instead be calculated using the index of this in this.axis.blocks[]. */
    blockIndex = blockIndexes[blockId];
    /** axis1d:blockIndexes contains only the viewed data blocks, not the reference block.
     * This is logic is analogous to axis-tracks:blockTrackColourI().
     */
    /* axisTitleColour() blockIndex counts from 1; 0 is for the reference block (may have been undefined in earlier versions),
     * which gets colour undefined - no need to call axisTitleColour().
     * i.e. blockIndex===undefined -> colour === undefined
     * blockIndex===0 is the first data block; its colour is axisTitleColour(blockId, 0+1)
     */
    colour = (blockIndex === undefined) ? undefined : axisTitleColour(this, blockIndex+1);
    if (trace_stack)
      dLog('axisTitleColour', this, blockId, blockIndexes, blockIndex, colour);
  }
  return colour;
};
/** Use Block:axisTitleColour(), which uses axis.js:axisTitleColour().
 *
 * static; signature matches that required by d3 (this is element, args are (datum,index,group)).
 * @param block (g.axis-all > text > tspan.blockTitle) or blockId (g.axis-use > g.tracks)
 */
Block.axisTitleColour = function (block)
{
  let colour = block.axisTitleColour();
  if (trace_stack)
    dLog('axisTitleColour', colour, block, this);
  return colour;
};


/** Constructor for Stack type.
 * Construct a Stacked containing 1 axis (axisName, portion),
 * and push onto this Stack.
 */
function Stack(stackable) {
  dLog("new Stack", oa, stacks.nextStackID);
  this.stackID = stacks.nextStackID++;
  /** The axis object (Stacked) has a reference to its parent stack which is the inverse of this reference : 
   * axes{axisName}.stack.axes[i] == axes{axisName} for some i.
   */
  this.axes = [];
  Stack.prototype.add = Stack_add;
  this.add(stackable);
  dLog(this, stackable, ".stack", stackable.stack);
  setCount('Stack() stacksCount');
}
/** Update stacks.stacksCount.count */
function setCount(label) {
  let newCount = stacks.length - (stacks.toDeleteAfterDrag ? 1 : 0);
  dLog(label, ' : stacksCount', stacks.stacksCount.get('count'), newCount);
  /* if the value is not changed then this .set will not trigger CPs which
   * depend on stacksCount.count.
   * stacksCount.count is used as a dependency by resizeEffect(), so change its
   * value at the end of the run loop using .later() to avoid : assertion
   * ... modified "resizeEffect" twice on component:draw-map ... in a single
   * render
   */
  later(function () {
    stacks.stacksCount.set('count', newCount);
  });
}
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
  setCount('new_Stack');
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
  dLog("{stackID=", this.stackID, ", axes=[");
  this.axes.forEach(function(s){s.log();});
  dLog("] length=", this.axes.length, "}");
  this.logElt();
};
Stack.prototype.logElt = function ()
{
  let s = d3.select(selectPrefix + "> g#id" + this.stackID + ".stack");
  dLog("logElt", s.node());
};
Stack.prototype.verify = function ()
{
  let me = this;
  if (this.axes.length == 0)
  {
    this.log();
    /* breakPointEnableSet(1);
     breakPoint(); */
    /* verify() is called at a point between creating an axis and 'add a new stack for it',
     * so don't break in this case.
     */
    dLog('Stack:verify() 0 axes', this);
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
          dLog("v1", v1, "v2", v2, axis, c);
          me.log();
          breakPoint();
        }
        /* this skips empty array elements anyway
         * a.blocks.map(function (b) { if (! b) breakPoint(a, a.blocks, b);});
         * so :
         */
        if (a.blocks.length && (a.blocks[0] === undefined))
        {
          dLog(a, a.blocks, '[0] is undefined');
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
    dLog("{stacks=[");
    stacks.forEach(function(s){s.log();});
    dLog("] length=", stacks.length, "}");
  };
Stack.verify = function()
{
  try {
    stacks.forEach(function(s){s.verify();});

    // all stacks : .axes is not empty
    stacks.mapBy('axes').mapBy('length').forEach(function (length, i) { if (!length) { dLog(i); stacks[i].log(); } });
    if (stacks.blocks) {
      // all blocks : .axis has a .stack.
      let b1 = Object.entries(stacks.blocks).mapBy('1');
      b1.mapBy('axis').forEach(function (a, i) { if (a && !a.stack) { dLog(i); a.log();  } });
    }
  }
  catch (e)
  {
    breakPoint('Stack.verify', e, this);
  }
};
/** Append the given stack to stacks[]. */
stacks.append = function(stack)
{
  this.push(stack);
};
/** Insert the given stack into stacks[] at index i. */
stacks.insert = function(stack, i)
{
  this.insertAt(i, stack);
};
/** stackID is used as the domain of the X axis. */
stacks.stackIDs = function()
{
  let sis = this.map(
    function (s) {
      return s.stackID;
    });
  return sis;
};
/** @return an array of the blockIds of the reference blocks of all axes (in all
 * stacks).  */
stacks.axisIDs = function()
{
  return Object.keys(this.axesP);
};
/** @return an array of the blockIds of the all the blocks of all axes (in all
 * stacks).  */
stacks.blockIDs = function()
{
  // this.axisIDs() are contained in this.blocks.
  let
    blockIDs = Object.values(this.blocks).reduce(function (result, b) {
      if (b.axis) result.push(b.axisName);
      return result; }, []);
  return blockIDs;
};

/** Sort the stacks by the x position of their Axes. */
stacks.sortLocation = function()
{
  this.sort(function(a, b) { return a.location() - b.location(); });
};
/** Return the x location of this stack.  Used for sorting after drag. */
Stack.prototype.location = function()
{
  let l = this.axes[0].location();
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
    dLog(thisIsParent ? '' : this, stack.stackID, i);
  return stack.stackID;
};
/** Use the position of this stack within stacks[] to determine g.axis-outer element classes.
 *
 * Use : the classes are used in css selectors to determine text-anchor.
 * If the stack is at the left or right edge of the diagram, then the titles
 * of Axes in the stack will be displayed on the outside edge, so that paths
 * between Axes (in .foreground) won't obscure the title and axis ticks.
 * With the addition of QTL display (on the right of the axis by default), it is
 * sometimes preferred to place all axis ticks on the left, so this is enabled
 * by GUI checkbox axisTicksOutside.
 *
 * @return "leftmost" or "rightmost" or "" (just one class)
 */
Stack.prototype.sideClasses = function ()
{
  if (this.isDestroying || ! this.axes.length) {
    return '';
  }
  const stacks = this.axes[0].stacksView.stacks;
  let i = this.stackIndex(), n = stacks.length;
  const
  controlsView = oa.axisApi.drawMap.controls.view,
  axisTicksOutside = controlsView.axisTicksOutside;
  let classes = (i == 0) || ! axisTicksOutside ? "leftmost" : ((i == n-1) ? "rightmost" : "");
  return classes;
};
/** @return a d3 axis for this axis, either d3. axisRight or axisLeft depending
 * on the axis position on the page, to place the ticks on the outside of the
 * graph area.
 * Configure the axis tickFormat to suit scale.domain().
 */
Stacked.prototype.axisSide = function (scale) {
  /** this.stack should be defined, but sideClasses is non-critical;
   * (saw undefined when refresh of secondary server and network had
   * disconnected, possibly after switching to groups page and back to
   * mapview).
   */
  if (! this.stack) {
    dLog('axisSide', this);
    this.log();
  }
  const
  stackClass = this.stack ? this.stack.sideClasses() : '',
  extended = this.extended,
  /** use of d3.axisLeft() / axisRight() does not seem to update
   * text-anchor="start" on the axis group element g.axis, so for now this is
   * augmented by CSS rules re. .leftmost / .rightmost which ensure the intended
   * value of text-anchor; can re-evaluate after d3 update. */
  right = ((stackClass === 'rightmost') && ! extended),
  axisFn = right ? d3.axisRight : d3.axisLeft;
  dLog('axisSide', stackClass, extended, right, this);

  let axis = axisFn(scale);
  axisConfig(axis, scale);
  // possibly move this config into here (or axisConfig) : .ticks(axisTicks * axisS.portion)
  return axis;
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
Stack.axisStackIndex2 = function (axis1d)
{
  const axisID = axis1d.axisName;
  /** can use instead :  s = Stacked.getStack(axisID) */
  let axis = axis1d;
  if (axis === undefined)
    return undefined;
  else
  {
    let s = axis.stack; // getStack();
    if (! s)
      return undefined;
    let i = s.stackIndex();
    /** data structure check */
    let j;
    const stacks = axis.stacksView.stacks;
    if ((i === -1) || (stacks[i] !== s) || (j=s.axes.indexOf(axis), s.axes[j].axisName != axisID))
    {
      dLog("stackIndex", axisID, i, axis, s, j, s.axes[j]);
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
    dLog("Stack.prototype.add", this, stackable);
  };
/** not used */
Stack.prototype.addAxis = function(axisName, portion)
{
  dLog("Stack.prototype.addAxis", axisName, portion);
  let sd = new Stacked(axisName, portion);
  this.add(sd);
};
/** Method of Stack.  @see Stack.prototype.add().
 * Add the given axis to this Stack.
 * @param sd  (stackable) Stacked / axis to add
 */
function Stack_add (sd)
{
  dLog("Stack_add", this, sd);
  this.axes.push(sd);
  Ember_set(sd, 'stack', this);
}
Stack.prototype.add = Stack_add;
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
    dLog("insert", stacked, i, len);

  this.axes.insertAt(i, stacked);
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
    dLog("Stack#remove named axis not in this stack", this, axisName);
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
    dLog("Stack#remove axis not in this stack", this, axis.longName());
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
  dLog("removeStacked", axisName);
  let axis = oa.axes[axisName];
  if (axis === undefined)
  {
    dLog("removeStacked", axisName, "not in", axes);
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
    dLog("removeStacked", axisName, result);
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
  let axis = oa.axes[axisName];
  axis.unviewBlocks();
  let
  removedAxis = this.remove(axisName);
  if (removedAxis === undefined)
    dLog("removeStacked", axisName);
  else
  {
    delete oa.axes[axisName];  // or delete axis['axis']
    delete axesP[axisName];
    stacks.axesPCount.decrementProperty('count');
  }
  if (this.empty())
  {
    result = this.stackID;
    if (! this.delete())
    {
      dLog("removeStacked", this, "not found for delete");
    }
    else if (trace_stack)
      Stack.log();
  }
  else
  {
    dLog("removeStacked", this);
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
    dLog("Stack#delete program error: not found", this, stacks);
  else if (this !== stacks[si])
    dLog("Stack#delete program error: found value doesn't match",
                this, stacks, si, stacks[si]);
  else
  {
    stacks = stacks.removeAt(si, 1);
    // .splice(si, 1);
    ok = true;
    setCount('delete');
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
      if (! oa.eventBus.isDestroying) {
        oa.eventBus.send('updatedStacks', stacks);
      }
  }
  setCount('move');
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
    dLog("Stack#remove named axis not in this stack", this, axisName);
    return undefined;
  }
  else
  {
    let s = this.axes[si];
    dLog("shift(), before removeAt()", this, axisName, insertIndex, this.axes.length, s);
    this.log();
    this.axes = this.axes.removeAt(si, 1);
    let len = this.axes.length;
    this.log();
    if (insertIndex >= len)
      dLog("shift()", this, axisName, insertIndex, " >= ", len, s);
    let insertIndexPos = (insertIndex < 0) ? len + insertIndex : insertIndex;
    // splice() supports insertIndex<0; if we support that, this condition need
    if (si < insertIndexPos)
      insertIndexPos--;
    this.axes.insertAt(insertIndexPos, s);
    dLog("shift(), after insertAt()", insertIndexPos, this.axes.length);
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
    dLog("contains", axisName, axesP[axisName], oa.axes[axisName].parent);
  return this === stack;
};
// replaced by ./draw/stack.js : dropIn()
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
  dLog("dropIn", this, axisName, insertIndex, top);
  let fromStack = axes[axisName].stack;
  /* It is valid to drop a axis into the stack it is in, e.g. to re-order the Axes.
   * No change to portion, recalc position.
   */
  if (this === fromStack)
  {
    dLog("Stack dropIn() axis ", axisName, " is already in this stack");
    this.shift(axisName, insertIndex);
    return;
  }
  /** Any axis in the stack should have the same x position; use the first
   * since it must have at least 1. */
  let anAxisName = this.axes[0].axisName,
  /** Store both the cursor x and the stack x; the latter is used, and seems
   * to give the right feel. */
  dropX = {event: /*d3.*/event.x, stack: oa.o[anAxisName]};
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
    dLog("dropIn", released, okStacks);
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
  dLog("dropOut", this, axisName);
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
  // dLog("calculatePositions", this.stackID, this.axes.length);
  let sumPortion = 0;
  /** convert px to [0, 1] */
  let axisGapPortion = stacks.vc?.yRange ? axisGap / stacks.vc.yRange : 0;
  let positions = [];
  this.axes.forEach(
    function (a, index)
    {
      /** patham() uses yRange2() which uses .position, when filtering out paths
       * outside the zoomed scope (could instead use zoomedDomain); reducing
       * position[1] by axisGapPortion causes it to filter out paths which
       * should be in, so axisGapPortion is not applied.
       * If the gap is applied here, it would be removed from position[1]; and
       * not from portion.
       */
      let nextPosition = sumPortion + a.portion;
      positions[index] =
      a.position = [sumPortion,  nextPosition /*- axisGapPortion*/];
      sumPortion = nextPosition;
    });
  if (! oa.eventBus.isDestroying) {
    oa.eventBus.send('stackPositionsChanged', this);
  }
  return positions;
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
    dLog("axisStack()", axisName, as, as.length);
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
    dLog("axisStackIndexAll()", axisName, as, as.length);
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
      dLog("axisTransform", this, this.parent);
      return this.parent.axisTransform();
    }
    let yRange = stacks.vc.yRange;
    if (this.position === undefined || yRange === undefined)
    {
      dLog("axisTransform()", this.axisName, this, yRange);
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
    dLog("axisTransform", this, transform);
    return transform;
  };
/** Get stack of axis, return transform. */
Stack.prototype.axisTransformO = function (axis)
{
  return axis && axis.axisTransformO();
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
   *   t.selectAll("g.stack#" + stackEltId(this) + " > .axis-outer");
   */
  dLog("redraw() stackID:", this.stackID);
  let this_Stack = this;  // only used in trace

  this.axes.forEach(
    function (a, index)
    {
      /** Don't use a transition for the axis/axis which is currently being
       * dragged.  Instead the dragged object will closely track the cursor;
       * may later use a slight / short transition to smooth noise in
       * cursor.  */
      let t_ = (Stack.currentDrag == a.axisName) ? d3 : t;
      // dLog("redraw", Stack.currentDrag, a.axisName, Stack.currentDrag == a.axisName);
      let ts = 
        t_.selectAll(".axis-outer#" + eltId(a));
      (trace_stack_redraw > 0) &&
        (((ts._groups.length === 1) && dLog(ts._groups[0], ts._groups[0][0]))
         || ((trace_stack_redraw > 1) && dLog("redraw", this_Stack, a, index, a.axisName)));
      // dLog("redraw", a.axisName);
      // args passed to fn are data, index, group;  `this` is node (SVGGElement)
      ts.attr("transform", Stack.prototype.axisTransformO);
      axisRedrawText(a);
    });

  this.redrawAdjacencies();
};

/** Select the <g.axis-outer> DOM element of this axis.
 * @return d3 selection
 */
Stacked.prototype.selectAll = function ()
{
  /* This function is factored from a pattern which appears in a number of
   * places, which can now use this; (they can be seen with grep
   * 'select.*axis-outer' ).
   */

  /** currently the <g.stack>-s are in svg > g, but there may be value in adding
   * a <g.stacks> to parent the <g.stack>-s
   */
  let stackSel = "g#id" + this.stack.stackID + ".stack",
  axisSel = stackSel + " > g#id" + this.axisName + ".axis-outer",
  gAxis = Stacked.selectAll(axisSel);

  /* later we may have multiple instances of an axis; their stackID will
   * identify them uniquely if they are in separate stacks. */
  if (gAxis.size() > 1)
    dLog('Stacked:selectAll', gAxis.size(), gAxis.nodes(), gAxis.node);
  return gAxis;
};
/** Select the <g.axis-outer> DOM element of the axis indicated by optional
 * param axisSel, or all axes if axisSel is undefined.
 * @param axisSel undefined for all axes, or a CSS-style selector.
 * @return d3 selection
 */
Stacked.selectAll = function (axisSel)
{
  if (! axisSel)
    axisSel = "g.stack > g.axis-outer";
  let gAxis;
  if (oa && oa.svgContainer)
    gAxis = oa.svgContainer.selectAll("svg > g > " + axisSel);
  else
    gAxis = d3.selectAll(selectPrefix + ' > ' + axisSel);
  if (trace_stack)
    gAxis.nodes().forEach(function (n, i) { dLog(i, n);});
  return gAxis;
};

/** @param a axis1d */
function axisRedrawText(a)
{
  let svgContainer = oa.svgContainer,
  g_axisall_id = "g.axis-all#" + eltIdAll(a);
  let axisTS = svgContainer.selectAll(g_axisall_id + " > text");
  // dLog('axisRedrawText', g_axisall_id, axisTS.nodes(), axisTS.node());
  axisTS.attr("transform", yAxisTitleTransform(oa.axisTitleLayout));
  let axisGS = svgContainer.selectAll("g.axis#" + axisEltId(a) + " > g.tick > text");
  axisGS.attr("transform", yAxisTicksScale);
  let axisBS = svgContainer.selectAll("g.axis#" + axisEltId(a) + " > g.btn > text");
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
      let as = oa.svgContainer.selectAll(".axis-outer#" + eltId(a));
      as.classed("leftmost", stackClass == "leftmost");
      as.classed("rightmost", stackClass == "rightmost");
      as.classed("not_top", index > 0);
      if (a)
        a.drawTicks();
    });
};
//-    import { } from "../utils/axis.js";

//-    import { } from "../components/stacks.js";
//-    import { } from "../utils/stacks.js";

/*------------------------------------------------------------------------*/

/** allocated width of the axis. */
Stacked.prototype.allocatedWidth = function()
{
  let width;
  // draw_orig : this.axis1d.axis2d
  const axis2d = this.get('axis2d');
  if (axis2d && ! axis2d.isDestroyed) {
    width = axis2d.get('allocatedWidthRect');
  }
  return width;
};

/** width of the axis.  either 0 or .extended (current width of extension) */
Stacked.prototype.extendedWidth = function()
{
  let width = this.extended;
  if (width === true) {
    width = this.allocatedWidth();
    if (! width) {
      let childViews = this.childViews;
      /** replace this with a passed parameter enabling axis-2d to report .width back up to axis-1d.  */
      let axis2d = childViews && childViews.findBy( '_debugContainerKey', 'component:axis-2d');
      if (axis2d) {
        width = axis2d.rectWidth();
        if (trace_stack > 1)
          dLog('extendedWidth', this, childViews, axis2d, width);
      } else {
        /** based on the path translate calculation in draw-map.js : axisShowExtend();
         * These can be integrated when moved to axis-2d.
         * Also axis-tracks.js : @see layoutWidth()
         */
        let shiftRight = 5;
        width = shiftRight + this.extended;
        // using .extended in place of : stacks.oa.axisApi.getAxisExtendedWidth(this.axisName);
      }
    }
  }

  // dLog("Stacked extendedWidth()", this, this.extended);
  return width || 0;
};

/** @return range of widths, [min, max] of the Axes in this stack */
Stack.prototype.extendedWidth = function()
{
  let range;
  if (! this.axes.length) {
    range = [0, 0];
  } else {
    range = [undefined, undefined];
    this.axes.forEach(
      function (a, index)
      {
        let w = a.extendedWidth();
        if ((range[0] === undefined) || (range[0] > w))
          range[0] = w;
        if ((range[1] === undefined) || (range[1] < w))
          range[1] = w;
      });
  }
  // dLog("Stack extendedWidth()", this, range);
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
function xScaleExtend(stacks_)
{
  /* .extended is measured in the range space (pixels),
   * so calculate space between axes.
   */
  /** parallel to stacks_[]. */
  let widthRanges = stacks_.map(
    function(s){ let widthRange = s.extendedWidth(); return widthRange;}
  );
  if (trace_stack > 1)
    stacks_.map(function(s) { dLog(s.axes[0].mapName, s.axes[0].extended); });
  let widths = widthRanges.map(
    function(widthRange){ return widthRange[1];}
  ),
  widthsSum = widths.reduce(
    function(sum, width){ return sum + width;}, 0
  );

  const vc = stacks.vc;
  const stacksData = stacks;
  const stacksCount = stacksData.stacksCount;
  let axisXRange = vc.axisXRange.slice(); // shallow copy
  axisXRange[1] -= widthsSum;
  // 40 allows for width of axis ticks / text,  etc and a bit of padding
  stacksData.axisXRangeMargin = axisXRange[1] - stacks_.length * 40;
  let stackDomain = Array.from(stacks_.keys()); // was axisIDs

  /** replacing axesP (and stacks.axes1d) with stacks-view.stacks[*].axes. */
  const axesP = stacks_.mapBy('axes').flat();
  let extendedCount = Object.values(axesP).filterBy('extended').length;
  let axes2d = Object.values(axesP).map((axis1d) => axis1d.axis2d).filter((a2) => a2);
  dLog("xScaleExtend", widthRanges, widths, widthsSum, vc.axisXRange, axisXRange, stackDomain, extendedCount, axes2d.length);
  // used as dependency by draw/block-adj
  stacksCount.set('widthsSum', widthsSum);
  stacksCount.set('extendedCount', extendedCount);
  stacksCount.set('axes2d', axes2d);  // can replace oa.axes2d

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
 * xScale() uses stacks.keys().
 */
//d3 v4 scalePoint replace the rangePoint
//let x = d3.scaleOrdinal().domain(axisIDs).range([0, w]);
function xScale() {
  let stackDomain = Array.from(stacks.keys()); // was axisIDs
  dLog("xScale()", stackDomain);
  return d3.scalePoint().domain(stackDomain).range(stacks.vc.axisXRange);
}

/** @return the scale of Axis axisID.  */
function x(axis)
{
  let i = axis.stackIndex();
  const
  axisID = axis.axisName,
  xScaleExtend = oa.xScaleExtend;
  if ((xScaleExtend.domain().length === 2) && trace_stack > 1) {
    dLog("x()", axisID, i, xScaleExtend(i), xScaleExtend.domain(), xScaleExtend.range());
  }
  if (i === -1) { dLog("x()", axisID, i); breakPoint(); }
  return xScaleExtend(i);
}
stacks.x = x;


Stacked.prototype.location = function() {
  const 
  fnName = 'Stacked:location',
  location = oa.o[this.axisName];
  if (location === undefined) {
    console.warning(fnName, this.axisName, Object.keys(oa.o), oa.o);
    this.log();
  } else {
    checkIsNumber(location);
  }
  return location;
};
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
  let transform = this.axisTransformO();
  return transform;
};
Stacked.prototype.axisTransformO_orig = function ()
{
  /** can use .yRangeSansStack() */
  let yRange = stacks.vc.yRange;
  let stack;
  // check that this.stack is DrawStackObject, not Stack
  // stack instanceOf DrawStackObject
  if ((this.position === undefined) && this.get &&
      (stack = this.stack) &&
      (stack._debugContainerKey !== undefined)) {
    /** cause draw/stack-view : positions() to evaluate this.calculatePositions();
     * this can be handled via an added dependency */
    const portions = stack.portions,
          positions = stack.positions;
  }
  if (this.position === undefined || yRange === undefined)
  {
    dLog("axisTransformO()", this.axisName, this, yRange);
    // breakPoint();
    return undefined;
  }
  let yOffset = this.yOffset(),
  yOffsetText =  Number.isNaN(yOffset) ? "" : "," + this.yOffset();
  /** Y scale.
   * no need for scale when this.portion === 1
   */
  let scale = this.portion;
  let xVal = this.location();
  xVal = Math.round(xVal);
  let rotateText = "", axis = this;
  if (! axis)
    // draw_orig : not updated - expect not required
  {
    /* If the __data of g.axis* has not been updated during adoption of an axis,
     * handle it here with some trace.
     * This is equivalent to axis = Stacked.getAxis(this.axisName), plus some
     * trace. */
    let block;
    if ((axis = oa.stacks.axes[this.axisName]))
      dLog('axisTransformO', 'use axes[]', this.axisName, axis);
    else if ((block = oa.stacks.blocks[this.axisName]) && block.axis)
    {
      axis = block.getAxis();
      dLog('axisTransformO', 'use blocks[] .axis', this.axisName, axis);
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
      dLog("perpendicular", shift, rotateText, a.node());

    let axisXRange = stacks.vc.axisXRange;
    const stacksView = this.stacksView;
    const stacksLength = stacksView.stacks.length;
    /** nStackAdjs and axisSpacing : copied from draw-map.js : updateAxisTitleSize() */
    let nStackAdjs = stacksLength > 1 ? stacksLength-1 : 1;
    let axisSpacing = (axisXRange[1]-axisXRange[0])/nStackAdjs;
    /** if perpendicular (dotPlot), reduce the axis height (which is width
     * because of the 90deg rotation from yRange to axisSpacing.
     * if not perpendicular, x scale doesn't matter because x is 0; use 1 for clarity.
     */
    scale = axisSpacing / yRange;
    shift *= axisSpacing / yRange;
  }

  let
  scaleText = Number.isNaN(scale) || ((scale === 1) && ! axis.perpendicular) ? "" : " scale(1," + scale + ")";
  dLog('axisTransformO scaleText', scaleText);
  if (trace_stack > 1) {
    let xS = xScale(); dLog('xScale', xS.domain(), xS.range());
  }
  let transform =
    [
      " translate(" + xVal, yOffsetText, ")",
      rotateText,
      scaleText
    ].join("");
  if (trace_stack > 1)
    dLog("axisTransformO", this, transform);
  return transform;
};

/*----------------------------------------------------------------------------*/

/** Reference the y scales.
 * The scales y and ys are currently created in 
 * The roles of the scales y and ys are noted in comments in draw-map.js : draw();
 * the key difference is that ys has added translation and scale
 * for the axis's current stacking.
 */
Stacked.prototype.getY = function ()
{
  let axisName = this.axisName;
  /* y and ys will be referenced in the same call, since they are created at the same time.
   * this.axisName will not change.  If it did in future, this function could become a CF.
   */
  if (! this.y)
    this.y = oa.y[axisName];
  if (! this.ys)
    this.ys = oa.ys[axisName];
  return this.y;
};

/** .positions[] is [last update drawn, current], @see Stacked.prototype.currentPosition() */
Stacked.prototype.currentPosition = function ()
{
  let axis1d = this,
  currentPosition = axis1d && axis1d.get('currentPosition');
  return currentPosition;
};

/** Return domain and range intervals for the axis.
 * Used to construct the intervalParams passed to the API by requestPathsProgressive(), to guide how man results are returned.
*
 * @return length of the axis in pixels
 */
Stacked.prototype.axisDimensions = function ()
{
  let
    /** y scale of this axis */
    y = this.getY(),
  domain = this.y.domain(),
  axis1d = this.getAxis1d(),
  zoomed = axis1d && axis1d.zoomed,
  dim = { domain, range : this.yRange(), zoomed};
  let
  currentPosition = axis1d && axis1d.get('currentPosition');
  if (! currentPosition || ! isEqual(domain, currentPosition.yDomain))
    dLog('axisDimensions', domain, currentPosition && currentPosition.yDomain, zoomed, currentPosition);
  return dim;
};
/** Set the domain of the current position to the given domain
 */
Stacked.prototype.setDomain = function (domain)
{
  let axis1d = this;
  // if (! axis1d)
  //  dLog('setDomain', this, 'domain', domain, axis1d, axis1d && axis1d.currentPosition);
  if (axis1d) {
    bind(axis1d, axis1d.setDomain)(domain);
  }
};
/** Set the zoomed of the current position to the given zoomed
 */
Stacked.prototype.setZoomed = function (zoomed)
{
  let axis1d = this.getAxis1d();
  // later .zoomed may move into axis1d.currentPosition
  // if (! axisPosition)
  // dLog('setZoomed', this, 'zoomed', axis1d.zoomed, '->', zoomed, axis1d);
  if (axis1d)
    axis1d.setZoomed(zoomed);
};

Stacked.prototype.unviewBlocks = function ()
{
  /** Ember data objects. */
  let blocks = this.blocks.mapBy('block')
    .filter((b) => b);
  later(() => {
    blocks.forEach((block) => {
      // undefined .block-s are filtered out above
      block.setProperties({
        'view': undefined,
        'isViewed': false
      });
    });
  });
};



/*----------------------------------------------------------------------------*/

export  { Block, Stacked, Stack, stacks, xScaleExtend, axisRedrawText,
          axisId2Name
          , setCount
        } ;
