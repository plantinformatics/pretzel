
import { Block, Stacked, Stack, stacks, xScaleExtend, axisRedrawText } from '../stacks';
import { breakPoint } from '../breakPoint';

/*----------------------------------------------------------------------------*/
/* DOM-related functions for stacks & axes */

/** Verify that the stacks & axes are rendered to dom elements OK.
 * @see Stack.prototype.verify(), which verifies the data layer, not the DOM presentation layer.
 */
function stacksAxesDomVerify(stacks, svgContainer)
{
  // this is just one verification - add more as needed.
  svgContainer.selectAll(".axis-outer")
    .each(function(d, i, g) {
      let block = stacks.blocks[d],
      axis = Stacked.getAxis(d),
      isViewed = block.block.get('isViewed');
      if (! block || ! axis || ! isViewed) 
        breakPoint('stacksAxesDomVerify', d, i, this, block, axis, isViewed);
    });
}

/*----------------------------------------------------------------------------*/

export { stacksAxesDomVerify } ;

