import {  maybeFlip, maybeFlipExtent }  from '../utils/draw/axis';

import { Stacked } from './stacks';

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** update ys  and y for the given axis,
 * according to the current domain of blocks on axis, and for ys, the axis's current .portion.
 * These 2 params are currently coming from oa.y, oa.ys :
 * @param y  axes yscale to update
 * @param ys  foreground yscale to update
 * @param axis  Stacked (i.e. axes[axis.axisName] == axis)
 * @param domain (optional) : value to set as domain. If undefined then the
 * domain is determined from axis .getDomain() and maybeFlip().
 * If defined then axis.flipped will not be applied - the caller should do that.
 */
function updateDomain(y, ys, axis, domain)
{
  /* This is now called from Stacked.prototype.updateDomain(), and can be merged
   * with that function. */

  /* based on similar code in draw-map.js : resetZoom(),
   * flipButtonS.on('click'), oa.stacks.axisIDs().forEach(), selectedAxes.map()
   */
  
  let
    axisName = axis.axisName,
  a = axis;
  if (domain === undefined) {
    domain = a.parent ? a.parent.getDomain() : a.getDomain();
    dLog('updateDomain', axisName, domain, a, a.blocks[0] && a.blocks[0].z);
    domain = maybeFlip(domain, a.flipped);
  }
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

  // dLog("updateRange", a, a.axisName, ys.length, ys[a.axisName]);
  // if called before ys is set up, do nothing.
  if (ys && ys[a.axisName])
  {
    let myRange = a.yRange();
    let axisName = a.axisName;
    dLog("updateRange", a.axisName, a.position, a.portion, myRange, vc.yRange);
    ys[a.axisName].range([0, myRange]);
    y[a.axisName].range([0, vc.yRange]);

    y[axisName].brush
      .extent([[-8,0],[8, vc.yRange /* not myRange */]]);
  }
}

/*----------------------------------------------------------------------------*/

export { updateDomain, updateRange };
