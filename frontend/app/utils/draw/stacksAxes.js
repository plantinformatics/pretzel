
import { Block, Stacked, Stack, stacks, xScaleExtend, axisRedrawText } from '../stacks';
import { axisEltId }  from './axis';
import { breakPoint } from '../breakPoint';

/*global d3 */

/*----------------------------------------------------------------------------*/
/* DOM-related functions for stacks & axes */

/** Verify that the stacks & axes are rendered to dom elements OK.
 * @see Stack.prototype.verify(), which verifies the data layer, not the DOM presentation layer.
 * @param unviewedIsOK  (optional) true means it is OK if a <g> displays a block which is unviewed - this can occur if called between stack changes and their rendering.
 */
function stacksAxesDomVerify(stacks, svgContainer, unviewedIsOK)
{
  // this is just one verification - add more as needed.
  (svgContainer || d3.select("#holder svg > g"))
   .selectAll(".axis-outer")
    .each(function(d, i, g) {
      let block = stacks.blocks[d],
      axis,
      isViewed;
      if (! block
          || ! (axis = Stacked.getAxis(d))
          || ! ((isViewed = block.block.get('isViewed')) || unviewedIsOK))
        breakPoint('stacksAxesDomVerify', d, i, this, block, axis, isViewed);
      if (unviewedIsOK && ! isViewed)
        console.log('stacksAxesDomVerify unviewed', d, i, this, block, axis);
    });
}

/*----------------------------------------------------------------------------*/

function selectAxis(axis)
{
  let axisName = axis.axisName;
  let aS = d3.select("#" + axisEltId(axisName));
  return aS;
}

const blockAdjEltIdPrefix = "ba_";
/** id of block-adj g element, based on IDs of the 2 adjacent blocks, with a "ba_" prefix. */
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
 */
function selectBlockAdj(parent, blockAdjId)
{
  let id = blockAdjEltId(blockAdjId);
  console.log('selectBlockAdj', id);
  let baS = (parent || d3).select("#" + id);
  return baS;
}


/*----------------------------------------------------------------------------*/

export {
  stacksAxesDomVerify, selectAxis, blockAdjKeyFn, blockAdjEltId,
  featureEltIdPrefix, featureNameClass,
  foregroundSelector, selectBlockAdj
} ;

