
import { inject as service } from '@ember/service';

import { isEqual } from 'lodash/lang';


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
  console.log('collateAdjacentAxes', flowsService);
  let previous = flowsService.get ? flowsService.get('adjAxes') : flowsService.adjAxes;
  let adjAxes = {};
  if (flowsService.set)
    flowsService.set('adjAxes', adjAxes);
  else
  {
    // this path is no longer applicable / used; flowsService is an Ember object
    console.log('flowsService', flowsService);
    flowsService.adjAxes = adjAxes;
  }
  let adjacent_both_dir = flowsService.flowConfig.adjacent_both_dir;
  /** Each stack, other than the end stacks, is visited twice in this loop,
   * so the result stack.datablocks() is cached for the next pass.
   * It is a minor time saving, but it makes the trace log clearer.
   */
  let dataBlocks = [];
  for (let stackIndex=0; stackIndex<stacks.length-1; stackIndex++) {
    let s0 = stacks[stackIndex], s1 = stacks[stackIndex+1],
    fAxis_s0 = dataBlocks[stackIndex] || (dataBlocks[stackIndex] = s0.dataBlocks()),
    fAxis_s1 = dataBlocks[stackIndex+1] || (dataBlocks[stackIndex+1] = s1.dataBlocks());
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

  let changed = ! isEqual(previous, adjAxes);
  if (changed) {
    /** the above simple comparison can yield false positives because {A : [ B]} is equivalent to { B : [A] }.
     * It doesn't really matter, but the follow can be used to convert previous
     * and adjAxes to sorted ordered pairs, and compare those.
     */
    let 
      previousPairs = adjAxesOrderedPairs(previous),
    adjAxesPairs = adjAxesOrderedPairs(adjAxes),
    changed2 = ! isEqual(previousPairs, adjAxesPairs);
    if (changed != changed2) {
      console.log(
        'collateAdjacentAxes changed',
        changed, changed2,
        previous, adjAxes,
        previousPairs, adjAxesPairs);
    }
    else {
      /* if ! stacks.length || ! adjAxesKeys.length then adjAxesArr will be set to [].
       * adjAxesArr is a dependent key of CP blockAdjIds (flows-collate.js).
       */
      let adjAxesKeys = d3.keys(adjAxes);
      let current = flowsService.get('adjAxesArr');
      
      console.log(current, 'adjAxesKeys', adjAxesKeys);
      flowsService.set('adjAxesArr', adjAxesKeys);
    }
  }
}

/** Given an object of the form {A : [ C, B], ...}, convert to ordered pairs and
 * sort them i.e.  [ [A, B], [A, C] ... ]
 * @param adjAxes is a value of flowsService.get('adjAxes')
 */
function adjAxesOrderedPairs(adjAxes) {
  let 
  a = Object.entries(adjAxes),
  a3 = a.map((a2) => a2[1].map((b) => [a2[0], b] )),
  a4 = a3.reduce((result, value) => result.concat(value), []),
  sortedPairs = a4.sortBy('1').sortBy('0');
  return sortedPairs;
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
