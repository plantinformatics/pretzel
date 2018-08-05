
import { Block, Stacked, Stack, stacks, xScaleExtend, axisRedrawText } from '../stacks';
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
          || ! (unviewedIsOK || (isViewed = block.block.get('isViewed'))))
        breakPoint('stacksAxesDomVerify', d, i, this, block, axis, isViewed);
      if (unviewedIsOK && ! isViewed)
        console.log('stacksAxesDomVerify unviewed', d, i, this, block, axis);
    });
}

/*----------------------------------------------------------------------------*/

export { stacksAxesDomVerify } ;

