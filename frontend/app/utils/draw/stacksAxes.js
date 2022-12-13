
import {
  Block,
  Stacked,
  Stack,
  stacks,
  xScaleExtend,
  axisRedrawText
} from '../stacks';
import { axisEltId }  from './axis';
import { breakPoint } from '../breakPoint';

/*global d3 */

const dLog = console.debug;

/*----------------------------------------------------------------------------*/
/* DOM-related functions for stacks & axes */

/** Verify that the stacks & axes are rendered to dom elements OK.
 * @see Stack.prototype.verify(), which verifies the data layer, not the DOM presentation layer.
 * @param unviewedIsOK  (optional) true means it is OK if a <g> displays a block which is unviewed - this can occur if called between stack changes and their rendering.
 */
function stacksAxesDomVerify(stacks, svgContainer, unviewedIsOK)
{
  const fnName = 'stacksAxesDomVerify';
  // this is just one verification - add more as needed.
  (svgContainer || d3.select("#holder svg > g"))
   .selectAll(".axis-outer")
    .each(function(d, i, g) {
      let block = stacks.blocks[d],
      axis,
      isViewed;
      if (! block
          || ! (axis = Stacked.getAxis(d))
          || ! ((isViewed = block.block.get('isViewed')) || unviewedIsOK)
         )
        dLog/*breakPoint*/(fnName, d, i, this, block, axis, isViewed);
      if (axis) {
        let rightStack = this.parentElement.__data__ === axis.stack;
        if (! rightStack)
          dLog(fnName, this.parentElement.__data__, '!==', axis.stack, this, this.__data__);
      }
      if (unviewedIsOK && ! isViewed)
        dLog('fnName unviewed', d, i, this, block, axis);
    });
  stacksAxesDomLog(svgContainer);
}

function stacksAxesDomLog(svgContainer = undefined) {
  let
    go = svgContainer &&
    svgContainer.selectAll('svg > g > g.stack > g.axis-outer'),
  ga = go ?
    go.selectAll('g > g.axis-all') :
    d3.selectAll('g.axis-all'),
  t = ga.selectAll('g > text > tspan.blockTitle'),
  tg = t._groups.map((g) => Array.from(g));
  dLog('stacksAxesDomLog',  t.data(),   t.nodes(), t.node());
  tg.forEach((tgi) => {
    let tgd = tgi.map((t) => t.__data__);
    dLog(tgd);
    tgd.forEach((b) => {if (b) b.log();});
  });
}


/*----------------------------------------------------------------------------*/

function selectAxis(axis)
{
  let aS = d3.select("#" + axisEltId(axis));
  return aS;
}

const blockAdjEltIdPrefix = "ba_";
/** id of block-adj g element, based on IDs of the 2 adjacent blocks, with a "ba_" prefix.
 * @param blockAdjId  array[2] of blockId
 */
function blockAdjEltId(blockAdjId)
{
  return blockAdjEltIdPrefix + blockAdjKeyFn(blockAdjId);
}

function blockAdjKeyFn(blockAdjId)
{ return blockAdjId[0] + '_' + blockAdjId[1]; }

const featureEltIdPrefix = "f_";
/** id of a feature g element, based on its ID a "f_" prefix. */

function featureNameClass(name)
{
  /* Generally feature names have an alpha prefix, but some genetic maps use
   * the numeric form of the feature index. CSS class names need an alpha
   * prefix.
   */
  if (name.match(/[0-9]/))
    name = featureEltIdPrefix + name;
  return name;
}

const foregroundSelector = 'div#holder > svg > g > g.foreground';

/**
 * @param parent  undefined, or selector of parent of g.block-adj
 * This optional argument is provided when creating a selector for .data().append().
 * @param blockAdjId  array[2] of blockId
 */
function selectBlockAdj(parent, blockAdjId)
{
  let id = blockAdjEltId(blockAdjId);
  dLog('selectBlockAdj', id);
  let baS = (parent || d3).select("#" + id);
  return baS;
}


/*----------------------------------------------------------------------------*/

export {
  stacksAxesDomVerify, selectAxis, blockAdjKeyFn, blockAdjEltId,
  featureEltIdPrefix, featureNameClass,
  foregroundSelector, selectBlockAdj
} ;

