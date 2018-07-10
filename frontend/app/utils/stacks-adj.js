
import { inject as service } from '@ember/service';

import { Block, Stacked, Stack, stacks, xScaleExtend, axisRedrawText, axisId2Name } from '../utils/stacks';

/*----------------------------------------------------------------------------*/

/*global d3 */

/*----------------------------------------------------------------------------*/


let flowsService; // = service('data/flows-collate');
function flowsServiceInject(flowsService_) { flowsService = flowsService_; }


    const trace_adj = 1;


/*----------------------------------------------------------------------------*/

    /** Collate adjacent Axes, based on current stack adjacencies.
     *
     * result: flowsService.adjAxes;
     */
    function collateAdjacentAxes()
    {
      let adjAxes = flowsService.adjAxes = {};
      let adjacent_both_dir = flowsService.flowConfig.adjacent_both_dir;
      for (let stackIndex=0; stackIndex<stacks.length-1; stackIndex++) {
        let s0 = stacks[stackIndex], s1 = stacks[stackIndex+1],
        fAxis_s0 = s0.childBlocks(),
        fAxis_s1 = s1.childBlocks();
        if (trace_adj > 2)
        {
          console.log('collateAdjacentAxes', stackIndex, fAxis_s0, stackIndex+1, fAxis_s1);
          s0.log(); s1.log();
        }
        // Cross-product of the Axes in two adjacent stacks
        for (let a0i=0; a0i < fAxis_s0.length; a0i++) {
          let a0 = fAxis_s0[a0i], za0 = a0.z, a0Name = a0.axisName;
          if (a0Name === undefined)
          {
            console.log(fAxis_s0, fAxis_s1, a0i, a0);
          }
          for (let a1i=0; a1i < fAxis_s1.length; a1i++) {
            let a1 = fAxis_s1[a1i], za1 = a1.z;
            if (trace_adj > 3)
            {
              console.log(a0i, a0Name, a1i, a1.axisName);
              a0.log();
              a1.log();
            }
            if (adjAxes[a0Name] === undefined)
              adjAxes[a0Name] = [];
            adjAxes[a0Name].push(a1.axisName);
            if (adjacent_both_dir)
            {
              if (adjAxes[a1.axisName] === undefined)
                adjAxes[a1.axisName] = [];
              adjAxes[a1.axisName].push(a0Name);
            }
          }
        }
      }
      if (trace_adj > 1)
        log_adjAxes(adjAxes);
      else if (trace_adj)
        console.log("collateAdjacentAxes", d3.keys(adjAxes).map(Stacked.longName));
    }

/*----------------------------------------------------------------------------*/

//-stacks
    function log_adjAxes()
    {
      let adjAxes = flowsService.adjAxes;
      console.log("adjAxes");
      d3.keys(adjAxes).forEach(function(a0Name) {
        let a0 = adjAxes[a0Name];
        console.log(a0Name, axisId2Name(a0Name), a0.length);
        for (let a1i=0; a1i < a0.length; a1i++) {
          let a1Name = a0[a1i];
          console.log(a1Name, axisId2Name(a1Name));
        }
      });
    }
    function log_adjAxes_a(adjs)
    {
      console.log("adjs", adjs.length);
      for (let a1i=0, a0=adjs; a1i < a0.length; a1i++) {
        let a1Name = a0[a1i];
        console.log(a1Name, axisId2Name(a1Name));
      }
    }
    /** @return true if Axes a0, a1 are adjacent, in either direction. */
    function isAdjacent(a0, a1)
    {
      let adjAxes = flowsService.adjAxes;
      let result = false, adjs0 = adjAxes[a0];
      if (adjs0)
        for (let a1i=0; (a1i < adjs0.length) && !result; a1i++) {
          result = a1 == adjs0[a1i];
          if (result)
            console.log("isAdjacent", a0, axisId2Name(a0), a1, axisId2Name(a1));
      }
      return result;
    }

/*----------------------------------------------------------------------------*/

export { flowsServiceInject, collateAdjacentAxes, log_adjAxes,  log_adjAxes_a, isAdjacent };
