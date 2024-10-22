//------------------------------------------------------------------------------

/* global d3 */

//------------------------------------------------------------------------------

import { axisEltId } from './axis';
import { configureHorizTickHover_orig } from '../hover';
import { PathDataUtils } from './path-data';
import { stacks } from '../stacks';

//------------------------------------------------------------------------------

/** Draw horizontal ticks on the axes, representing scaffold boundaries.
 * @param t transition or undefined
 */
function showTickLocations(scaffoldTicks, t)
{
  Object.keys(scaffoldTicks).forEach
  (showTickLocationsOfAxis.bind(scaffoldTicks, t));
}
function showTickLocationsOfAxis(scaffoldTicks, t, axisName) {
  let tickLocations = Array.from(scaffoldTicks[axisName].keys());
  /** -  if axisName matches nothing, then skip this. */
  let aS = d3.select("#" + axisEltId(axisName));
  if (!aS.empty())
  {
    const
    pS = aS.selectAll("path.horizTick")
      .data(tickLocations),
    pSE = pS.enter()
      .append("path")
      .attr("class", "horizTick fromInput");
    pSE
      .each(configureHorizTickHover_orig);
    let pSM = pSE.merge(pS);

    /* update attr d in a transition if one was given.  */
    let p1 = (t === undefined) ? pSM
        : pSM.transition(t);
    p1.attr("d", function(tickY) {
      // based on axisFeatureTick(ai, d)
      /** shiftRight moves right end of tick out of axis zone, so it can
       * receive hover events.
       */
      const xOffset = 25, shiftRight=5;
      const pathDataUtils = PathDataUtils(stacks.oa);
      let ak = axisName,
          sLine = pathDataUtils.lineHoriz(ak, tickY, xOffset, shiftRight);
      return sLine;
    });
  }
}

//------------------------------------------------------------------------------

export {
  showTickLocations,
  showTickLocationsOfAxis,
};

//------------------------------------------------------------------------------
