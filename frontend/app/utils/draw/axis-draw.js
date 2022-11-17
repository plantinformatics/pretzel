
//------------------------------------------------------------------------------

import {
  ctrlKeyfilter,
} from '../domElements';

import { I, combineFilters } from './d3-svg';
import {
  /*fromSelectionArray,
  */ logSelectionLevel,
  logSelection,
  logSelectionNodes,
  selectImmediateChildNodes
} from '../log-selection';

import {
  Stacked,
  Stack,
} from '../stacks';

import {
  dragTransitionTime,
} from '../stacks-drag';

import { axisFontSize, AxisTitleLayout } from './axisTitleLayout';

import {
  Axes, maybeFlip, maybeFlipExtent,
  ensureYscaleDomain,
  /*yAxisTextScale,*/  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform,
  eltId, stackEltId, axisEltId, eltIdAll, axisEltIdTitle,
  moveOrAdd,
  axisFeatureCircles_eltId,
  axisFeatureCircles_selectAll,
  axisFeatureCircles_selectOneInAxis,
  axisFeatureCircles_removeBlock,
  /*, axisTitleColour*/  }  from './axis';

import {
  AxisTitle,
} from './axisTitle';

import { DropTarget } from './drop-target';
import { AxisDrag } from '../stacks-drag';


import { breakPoint } from '../breakPoint';

/* global d3 */

//------------------------------------------------------------------------------

const trace = 2;
const trace_stack = trace;

const dLog = console.debug;

//------------------------------------------------------------------------------

export default
class AxisDraw {
  constructor(oa, axis1d, stacks, stacksView) {
    console.log("AxisDraw", axis1d, stacksView);
    this.oa = oa;
    this.axis1d = axis1d;
    this.stacks = stacks;
    this.stacksView = stacksView;
    if (! this.oa && ! this.axis1d) {
      debugger;
    }
    if (! this.stacks && ! this.stacksView) {
      debugger;
    }
  }
}

AxisDraw.prototype.draw = function draw() {
  const fnName = 'AxisDraw::draw';
  console.log(fnName);
  const
  oa = this.oa || this.axis1d.drawMap.oa,
  stacks = this.stacksView.stacks;

  // can move this to stacks-view (and possibly stack-view)
    let stackSd = oa.svgContainer.selectAll(".stack")
      .data(stacks, Stack.prototype.keyFunction),
    stackS = stackSd
      .enter()
      .append("g"),
    stackX = stackSd.exit();
    if (trace_stack)
    {
      console.log("append g.stack", stackS.size(), stackSd.exit().size(), stackS.node(), stackS.nodes());
      if (oa.stacks.length > stackSd.size() + stackS.size())
      {
        console.log("missed stack", oa.stacks.length, stackSd.size());
        breakPoint();
      }
    }
    let removedStacks = 
      stackX;
    if (removedStacks.size())
    {
      if (trace_stack > 1)
      {
        logSelection(removedStacks);
        logSelectionNodes(removedStacks);
      }
      console.log('removedStacks', removedStacks.size());
      /* at this point draw-map.js:draw() does the following, which should not be required here :
       * If there are g.axis-outer in removedStacks[], either move them to the
       * correct g.stack or remove them.
       */
    }

  let selections = { svgContainer : oa.svgContainer, stackSd, stackS,  stackX };
  this.draw2(selections, stack_axisIDs, /*newRender*/false, null);
};

/** Parallel to draw-map.js : stack_axisIDs().
 * For the given Stack, return its axisIDs.
 * @return [] containing string IDs of reference blocks of axes of the Stack.
 */
function stack_axisIDs(stack) {
  const axisIDs = stack.axes.mapBy('axis.id');
  return axisIDs;
}

AxisDraw.prototype.draw2 = function draw2(selections, stack_axisIDs, newRender, stacksAxesDomVerify) {
  const fnName = 'AxisDraw::draw2';
  console.log(fnName);
  let { svgContainer, stackSd, stackS,  stackX } = selections;
  if (! this.oa && ! this.axis1d) {
    debugger;
  }
  if (! this.stacks && ! this.stacksView) {
    debugger;
  }
  const
  oa = this.oa || this.axis1d.drawMap.oa,
  stacks = this.stacks || this.stacksView.stacks;

  stackX
    .transition().duration(500)
    .remove();

  /*
   let st = newRender ? stackS :
   stackS.transition().duration(dragTransitionTime);
   let stackS_ = st
   */
  stackS
    .attr("class", "stack")
    .attr("id", stackEltId);


  if (stackS && trace_stack >= 1.5)
    logSelection(stackS);

  // Add a group element for each axis.
  // Stacks are selection groups in the result of this .selectAll()
  let axisS =
    stackSd.merge(stackS)
    .selectAll(".axis-outer"),


  axisG = axisS
    .data(stack_axisIDs, Stacked.prototype.keyFunction)
    .enter().append(moveOrAdd /*'g'*/),
  axisX = axisS.exit();
  dLog('stacks.length', stacks.length, axisG.size(), axisX.size());
  axisG.each(function(d, i, g) { dLog(d, i, this); });
  axisX.each(function(d, i, g) { dLog('axisX', d, i, this); });
  axisX.remove();
  let axisGE = axisG
    .selectAll('g.axis-all')
    .data((d) => [d])
    .enter(),
  /** filter axisG down to those elements without a g.axis-all child.
   * This would be equivalent to those elements of axisG which are parents in
   * the .enter() set axisGE, i.e. axisGE.nodes().mapBy('_parent')
   */
  axisGempty = 
    axisG.filter( function (d) { return d3.select(this).selectAll('g > g.axis-all').empty(); }),
  allG = axisGE
    .append('g')
    .attr("class", "axis-all")
    .attr("id", eltIdAll);
  // following code appends sub-elements to axisG, so use axisGempty.
  axisG = axisGempty;
  const resultSelections = {axisS, axisG, allG};
  if (axisG.size())
    dLog(allG.nodes(), allG.node());


  if (trace_stack)
  {
    if (trace_stack > 1)
      oa.stacks.forEach(function(s){console.log(s.axisIDs());});
    let g = axisG;
    console.log("g.axis-outer", g.enter().size(), g.exit().size(), stacks.length);
  }
  axisG
    .attr("class", "axis-outer")
    .attr("id", eltId);
  let g = axisG;
  resultSelections.g = g;
  /** stackS / axisG / g / gt is the newly added stack & axis.
   * The X position of all stacks is affected by this addition, so
   * re-apply the X transform of all stacks / axes, not just the new axis.
   */
  let ao =
    svgContainer.selectAll('.axis-outer');  // equiv: 'g.stack > g'
  /** apply the transform with a transition if changing an existing drawing. */
  let gt = newRender ? ao :
    ao.transition().duration(dragTransitionTime);
  if (trace_stack > 2)
  {
    console.log('.axis-outer');
    logSelectionNodes(gt);
  }
  /* could be used to verify ao selection. */
  if (trace_stack > 3)
  {
    let ga =  selectImmediateChildNodes(svgContainer);
    console.log('svgContainer > g');
    logSelectionNodes(ga);
    let ao1 = svgContainer.selectAll("g.stack > g");  //.axis-outer
    logSelectionNodes(ao1);
  }
  Stack.verify();
  if (stacksAxesDomVerify) {
    stacksAxesDomVerify(stacks, oa.svgContainer, /*unviewedIsOK*/ true);
  }
  ao
    .attr("transform", Stack.prototype.axisTransformO);

  const axisDrag = /*new*/ AxisDrag(oa, oa.vc);
  // .bind(axisDrag)
  g
    .call(
      d3.drag()
        .subject(function(d) { return {x: oa.stacks.x(d)}; }) //origin replaced by subject
        .filter(ctrlKeyfilter)
        .on("start", axisDrag.dragstarted) //start instead of dragstart in v4. 
        .on("drag", axisDrag.dragged)
        .on("end", axisDrag.dragended));//function(d) { dragend(d); d3.event.sourceEvent.stopPropagation(); }))
  if (g && trace_stack >= 1.5)
    logSelection(g);



  let dropTarget = new DropTarget(oa, oa.vc, g);

  [true, false].forEach(function (i) {
    dropTarget.add(i);
    // dropTarget.addMiddle(i);
  });


  /** from newly added g.axis-all : filter out those which have a parent which draws their axis. */
  g = allG
    .filter(function (d) { return oa.axesP[d]; } )
  ;
  if (trace_stack > 1)
  {
    console.log(oa.axesP, "filter", g.size(), allG.size());
    logSelection(g);
  }

  let y = oa.y;
  // Add an axis and title
  /** This g is referenced by the <use>. It contains axis path, ticks, title text, brush. */
  let defG =
    g.append("g")
    .attr("class", "axis")
    .each(function(d) {
      let axis = Stacked.getAxis(d);
      d3.select(this).attr("id",axisEltId(d)).call(axis.axisSide(y[d])); });  


  let axisTitleS = g.append("text")
     /* id is used by axis-menu targetId */
    .attr('id', axisEltIdTitle)
    .attr("y", -2 * axisFontSize)
    .style("font-size", axisFontSize);
  const axisTitle = AxisTitle(oa);
  axisTitle.axisTitleFamily(axisTitleS);

  return resultSelections;
};



//------------------------------------------------------------------------------
