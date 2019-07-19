import {  maybeFlip, maybeFlipExtent }  from '../utils/draw/axis';

import { Stacked } from './stacks';

/*----------------------------------------------------------------------------*/

/** update ys  and y for the given axis,
 * according to the current domain of blocks on axis, and for ys, the axis's current .portion.
 * These 2 params are currently coming from oa.y, oa.ys :
 * @param y  axes yscale to update
 * @param ys  foreground yscale to update
 * @param axis  Stacked (i.e. axes[axis.axisName] == axis)
 */
function updateDomain(y, ys, axis)
{
  /* This is now called from Stacked.prototype.updateDomain(), and can be merged
   * with that function. */

  /* based on similar code in draw-map.js : resetZoom(),
   * flipButtonS.on('click'), oa.stacks.axisIDs().forEach(), selectedAxes.map()
   */
  
  let
    axisName = axis.axisName,
  a = axis,
  domain = a.parent ? a.parent.getDomain() : a.getDomain();
  console.log('updateDomain', axisName, domain, a, a.blocks[0] && a.blocks[0].z);
  domain = maybeFlip(domain, a.flipped);
  y.domain(domain);
  ys.domain(domain);
}


/*----------------------------------------------------------------------------*/

    /** update ys[a.axisName]  and y[a.axisName] for the given axis,
     * according to the current yRange, and for ys, the axis's current .portion.
     * @param a axis (i.e. axes[a.axisName] == a)
     * These 3 params are currently coming from oa.y, oa.ys, oa.vc :
     * @param y  axes yscale to update
     * @param ys  foreground yscale to update
     * @param vc  ViewPort
     */
function updateRange(y, ys, vc, a)
{
  // factored out of draw-map.js

  // console.log("updateRange", a, a.axisName, ys.length, ys[a.axisName]);
  // if called before ys is set up, do nothing.
  if (ys && ys[a.axisName])
  {
    let myRange = a.yRange();
    let axisName = a.axisName;
    console.log("updateRange", a.axisName, a.position, a.portion, myRange, vc.yRange);
    ys[a.axisName].range([0, myRange]);
    y[a.axisName].range([0, vc.yRange]);

    y[axisName].brush
      .extent(maybeFlipExtent([[-8,0],[8, vc.yRange /* not myRange */]], a.flipped));
  }
}

/*----------------------------------------------------------------------------*/

export { updateDomain, updateRange };
