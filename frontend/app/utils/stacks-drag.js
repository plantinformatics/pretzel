import {
  later,
} from '@ember/runloop';

//------------------------------------------------------------------------------

import {
  logSelection,
} from './log-selection';

import {
  eltId, stackEltId,
  axisFeatureCircles_selectAll,
}  from '../utils/draw/axis';

import {
  Stack,
  stacks,
  axisRedrawText,
  setCount,
} from './stacks';


import { breakPoint, breakPointEnableSet } from './breakPoint';

import {
  collateStacks,
} from "./draw/collate-paths";

import { PathDataUtils } from './draw/path-data';


/* global d3 */


//------------------------------------------------------------------------------

const trace = 2;
const trace_stack = trace;

const dLog = console.debug;

//------------------------------------------------------------------------------

const dragTransitionTime = 1000;  // milliseconds

//------------------------------------------------------------------------------

/** Factored out of draw-map.js.  This is a minimal change - next stage is to
 * convert dragTransitionNew, dragTransition, dragTransitionEnd to be methods of
 * DragTransition, accessed in draw-map via stacks.dragTransition.
 * dragTransitionTime can be a DragTransition.prototype.time.
*/

/** singleton DragTransition object, Will 'transition' to passing it in an API */
var singleton;
/**
 * @param containerD3Sel e.g. oa.svgContainer
 */
function DragTransition(containerD3Sel)
{
  this.containerD3Sel = containerD3Sel;
  singleton = this;
}

/** Set svgContainer.class .dragTransition to make drop zones insensitive during drag transition.
 * @return new drag transition
 */
function dragTransitionNew()
{
  dragTransition(true);
  let t = d3.transition().duration(dragTransitionTime);
  t.ease(d3.easeCubic);
  return t;
}
/** Signal the start or end of a drag transition, i.e. a axis is dragged from
 * one Stack to another - dropIn() or dropOut().
 * During this transition, 
 * @param start signifies start (true) or end (false) of drag transition.
 */
function dragTransition(start)
{
  if (start)
    console.log("dragTransition(start)");
  singleton.containerD3Sel.classed("dragTransition", start);
}
function dragTransitionEnd(data, index, group)
{
  console.log("dragTransitionEnd", /*this,*/ data, index, group);
  dragTransition(false);
}



//------------------------------------------------------------------------------

/** guard against repeated drag event before previous dragged() has returned. */
let dragging = 0;

//------------------------------------------------------------------------------

const trace_path = 0;
const trace_drag = 0;

// require : + oa, dragging, me, vc;
/* functions
let breakPointEnableSet, deleteAfterDrag, collateStacks, axisRedrawText, pathUpdate, axisFeatureCircles_selectAll;
let axisStackChanged, eltId, stackEltId, updateXScale, stacksAdjust, setCount;
*/


export default
function AxisDrag(oa, vc) {
  /* constructor*/
    console.log("AxisDrag");
/*
    this.oa = oa;
    this.vc = vc;
    this.drawMap = oa.drawMap;
*/
  const drawMap = oa.drawMap;

  return { dragstarted, dragged, dragended}; 

// AxisDrag.prototype.dragstarted = dragstarted;

  function dragstarted(event, start_axis1d /*, start_index, start_group*/) {
    const
    fnName = 'dragstarted',
    stacks = start_axis1d.stacksView.stacks,
    x = oa.stacks.x;
    Stack.currentDrop = undefined;
    const start_d = start_axis1d.axisName;
    Stack.currentDrag = start_d;
    // unique_1_1_mapping = me.get('isShowUnique'); // disable until button click does not redraw all.
    /** disable this as currently togglePathColourScale() sets pathColourScale as a boolean
     * maybe have a pull-down selector because multi-value.
     use_path_colour_scale = me.get('pathColourScale'); */
    dLog(fnName, this, start_d/*, start_index, start_group*/);
    let cl = {/*self: this,*/ d: start_d/*, index: start_index, group: start_group, axisIDs: axisIDs*/};
    let svgContainer = oa.svgContainer;
    svgContainer.classed("axisDrag", true);
    d3.select(this).classed("active", true);
    /** start_axis1d === event.subject */
    if (start_axis1d !== event.subject) {
      dLog(fnName, start_axis1d, '!==', event.subject);
    }
    dLog(fnName, event.subject.fx, event.subject.x);
    event.subject.fx = x(start_axis1d);
    let axisS = svgContainer.selectAll(".stack > .axis-outer");
    if (axisS && trace_stack >= 1.5)
      logSelection(axisS);
    /* Assign class current to dropTarget-s depending on their relation to drag subject.
     add class 'current' to indicate which zones to get .dragHover
     axis being dragged does not get .current
     middle targets on side towards dragged axis don't
     axes i in 1..n,  dragged axis : dg
     current if dg != i && (! middle || ((side == left) == (i < dg)))
     * for (i < dg), use x(d) < startx
     */
    axisS.selectAll('g.axis-outer > g.stackDropTarget').classed
    ("current",
     function(axis1d /*, index, group*/)
     {
       const d = axis1d.axisName;
       let xd = x(axis1d),
       /** event has various x,y values, which are sufficient for this
        * purpose, e.g. x, subject.x, sourceEvent.clientX, sourceEvent.x */
       startX = event.x,
       middle = this.classList.contains("middle"),
       left = this.classList.contains("left"),
       isCurrent =
         (d != cl.d) &&  (! middle || ((left) === (xd < startX)));
       // console.log("current classed", this, event, d, /*index, group,*/ cl, xd, startX, middle, left, isCurrent);
       return isCurrent;
     });
  }

// AxisDrag.prototype.dragged = dragged;
  /** @param  d (datum) name of axis being dragged.
   * @see stacks.log() for description of stacks.changed
   */
  function dragged(event, axis1d) {
    const fnName = 'dragged';
    const d = axis1d.axisName;
    const /*oa = this.oa,*/ me = oa.eventBus, vc = oa.vc, axisApi = oa.axisApi;
    if (axis1d !== event.subject) {
      dLog(fnName, axis1d, '!==', event.subject);
    }

    /** Transition created to manage any changes. */
    let t;
    /** X distance from start of drag */
    let xDistance;
    let currentDropTarget = oa.currentDropTarget;
    if (this.dragging++ > 0) { console.log("dragged drop", dragging); dragging--; return;}
    if (! oa.svgContainer.classed("dragTransition"))
    {
      // if cursor is in top or bottom dropTarget-s, stack the axis,
      // otherwise set axis x to cursor x, and sort.
      let dropTargetEnd = currentDropTarget && currentDropTarget.classList.contains("end");

      const dropDelaySeconds = 0.5, milli = 1000;
      /** currentDrop references the axisName being dragged and the stack it is dropped into or out of. */
      let currentDrop = Stack.currentDrop,
      /** Use the start of the drag, or the most recent drop */
      xDistanceRef = (currentDrop && currentDrop.x) ? currentDrop.x.stack : axis1d.fx,
      now = Date.now();
      if (trace_drag)
      {
        console.log("dragged xDistanceRef", event.x, currentDrop && currentDrop.x, xDistanceRef);
        console.log("dragged", currentDrop, d);
      }
      /** true iff currentDrop is recent */
      let recentDrop = currentDrop && (now - currentDrop.dropTime < dropDelaySeconds * milli);

      if (true && recentDrop && dropTargetEnd)
      {
        console.log("dragged", currentDrop, currentDropTarget, now - currentDrop.dropTime);
      }
      if (! recentDrop)
      {
        if (dropTargetEnd)
        {
          const
          targetAxis1d = currentDropTarget.axisName,
          targetAxisName = targetAxis1d.axisName,
          top = currentDropTarget.classList.contains("top"),
          zoneParent = Stack.axisStackIndex2(targetAxis1d);
          /** destination stack */
          const stacks = axis1d.stacksView.stacks;
          let stack = stacks[zoneParent.stackIndex];
          if (! stack.contains(axis1d))
          {
            t = dragTransitionNew();
            /*  .dropIn() and .dropOut() don't redraw the stacks they affect (source and destination), that is done here,
             * with this exception : .dropIn() redraws the source stack of the axis.
             */
            // if (draw_orig) stack.dropIn(d, zoneParent.axisIndex, top, t);
            axis1d?.dropIn(event, targetAxis1d, top);
            breakPointEnableSet(1);
            deleteAfterDrag(stacks);
            // axisChangeGroupElt(d, t);
            collateStacks();
            // number of stacks has decreased - not essential to recalc the domain.
            Stack.log();
            stack.redraw(t);
          }
          // set x of dropped axisID
        }
        // For the case : drag ended in a middle zone (or outside any DropTarget zone)
        // else if d is in a >1 stack then remove it else move the stack
        else if ((! currentDrop || !currentDrop.out)
                 && ((xDistance = Math.abs(event.x - xDistanceRef)) > vc.xDropOutDistance))
        {
          /** dragged axis, source stack */
          const stack = axis1d.stack;
          if (currentDrop && currentDrop.stack !== stack)
          {
            console.log("dragged", d, currentDrop.stack, stack);
          }
          if (stack.axes.length > 1)
          {
            t = dragTransitionNew();
            stack.dropOut(axis1d);
            axis1d?.dropOut();
            Stack.log();
            // axisChangeGroupElt(d, t);
            collateStacks();
            /* if d is not in currentDrop.stack (=== stack), which would be a
             * program error, dropOut() could return false; in that case stack
             * redraw() may have no effect.
             */
            stack.redraw(t);
            /* if axis is dropped out to a new stack, redraw now for
             * continuity, instead of waiting until dragended().
             */
            axisRedrawText(axis1d);
            /* Following code will set o[d] and sort the Stack into location. */
          }
        }
      }
      /*
       else
       console.log("no currentDrop", d); */

      // console.log("dragged", dropTargetEnd, currentDropTarget, d);
    }

    // if (! dropTargetEnd)
    {
      let o = oa.o;
      // console.log("dragged o[d]", o[d], event.x);
      o[d] = event.x;
      // Now impose boundaries on the x-range you can drag.
      /** The boundary values */
      let dragLimit = oa.vc.dragLimit;
      if (o[d] < dragLimit.min) { o[d] = dragLimit.min; }
      else if (o[d] > dragLimit.max) { o[d] = dragLimit.max; }
    }
    //console.log(axisIDs + " " + o[d]);
    if (this === undefined)
    {
      console.log("dragged this undefined", d);
    }
    else
    {
      /* if (t === undefined)
       t = dragTransitionNew(); */
      draggedAxisRedraw(this, d, t);
    }
    if (stacks.changed & 0x01)
    {
      console.log("dragged", "stacks.changed 0x", stacks.changed.toString(16));
      stacks.changed ^= 0x01;
      axisApi.axisStackChanged(undefined);
    }

    dragging--;
  } // dragged()

  /** Redraw the axis/axis which is being dragged.
   * Calls pathUpdate() which will mostly change the paths connected to the dragged axis;
   * but when dropIn/dropOut(), paths to other axes can be changed when stacking / adjacencies change.
   *
   * @param axisElt  node/DOM element corresponding of axis. this of dragged()
   * @param axis1d
   * @param t transition in which to make changes
   */
  function draggedAxisRedraw(axisElt, axis1d, t)
  {
    const d = axis1d.axisName;
    // const oa = this.oa;
    let st0 = d3.select(axisElt);
    if (! st0.empty())
    {
      /* if (t === undefined)
       t = dragTransitionNew(); */
      // console.log("st0", st0._groups[0].length, st0._groups[0][0]);
      let st = st0; //.transition();  // t
      // st.ease(d3.easeQuadOut);
      // st.duration(dragTransitionTime);
      st.attr("transform", Stack.prototype.axisTransformO);
      // zoomed affects transform via path() : axisTransform.
      if (oa.drawOptions.continuousPathUpdate && (trace_path < 2)) {
        const pathDataUtils = PathDataUtils(oa);
        pathDataUtils.pathUpdate(t || st);
      }
      //Do we need to keep the brushed region when we drag the axis? probably not.
      //The highlighted features together with the brushed regions will be removed once the dragging triggered.
      // st0.select(".brush").call(y[d].brush.move,null);

      /** Disabled this - it's not clear why it is needed; it seems sensible to
       * retain the highlighted Features through the drag and after it.
       * Their position doesn't need to be updated.
      //Remove all highlighted Features.
      axisFeatureCircles_selectAll().remove();
      */
    }
  }

  // not used now.  part of draw_orig.
  /** Called when axisID has been dragged from one stack to another.
   * It is expected that the group element of the axis, g.axis-outer#<eltId(axisID)>,
   * needs to be moved from the source g.stack to destination.
   * @param axisID name/id of axis
   * @param t drag transition
   */
  function axisChangeGroupElt(axisID, t)
  {
    // const oa = this.oa;
    let aS_ = "g.axis-outer#" + eltId(axisID),
    aS = t.selectAll(aS_),
    gStack = aS._groups[0][0].parentNode;
    // let p = t.select(function() { return gStack; });
    // console.log("axisChangeGroupElt", axisID, t, aS_, aS, p);
    // compare with axis->stack
    let axis = oa.axes[axisID],
    stackID = axis.stack && axis.stack.stackID,
    /** destination Stack selection */
    dStack_ = "g.stack#" + stackEltId(axis.stack),
    dStackS = t.selectAll(dStack_),
    dStack = dStackS._groups[0][0], // equiv : .node()
    differentStack = gStack !== dStack;
    console.log("axisChangeGroupElt", axis, stackID, dStack_, dStackS, dStack, differentStack);

    // not currently used - g.stack layer may be discarded.
    if (false && differentStack)
    {
      var removedGAxis = aS.remove(),
      removedGAxisNode = removedGAxis.node();
      console.log("removedGAxis", removedGAxis, removedGAxisNode);
      let dStackN = dStackS.node();
      // tried .append, .appendChild(), not working yet.
      if (dStackN && dStackN.append)
        //  dStackN.append(removedGAxisNode);
        dStackN.append(function() { return removedGAxisNode;});
    }
  }

//------------------------------------------------------------------------------

// probably will adjust stacks horizontal layout calculation instead of using deleteAfterDrag()

//------------------------------------------------------------------------------

// AxisDrag.prototype.dragended = dragended;
  function dragended(event, axis1d /*, i, g*/) {
    const fnName = 'dragended';
    if (axis1d !== event.subject) {
      dLog(fnName, axis1d, '!==', event.subject);
    }
    const stacks = axis1d.stacksView.stacks;
    deleteAfterDrag(stacks);
    const /*oa = this.oa,*/ vc = oa.vc, axisApi = oa.axisApi;
    stacks.sortLocation();

    // in the case of dropOut(),
    // number of stacks has increased - need to recalc the domain, so that
    // x is defined for this axis.
    //
    // Order of axisIDs may have changed so need to redefine x and o.
    axisApi.updateXScale();
    // if caching, recalc : collateAxisPositions();

    /* stacks.changed only needs to be set if sortLocation() has changed the
     * order, so for an optimisation : define stacks.inOrder() using reduce(),
     * true if stacks are in location order.
     */
    stacks.changed = 0x10;
    let t = axisApi.stacksAdjust(true, undefined);
    // already done in xScale()
    // x.domain(axisIDs).range(axisXRange);
    // stacksAdjust() calls redrawAdjacencies().  Also :
    /* redrawAdjacencies() is called from .redraw(), and is mostly updated
     * during dragged(), but the stacks on either side of the origin of the
     * drag can be missed, so simply recalc all here.
     */

    d3.select(this).classed("active", false);
    let svgContainer = oa.svgContainer;
    svgContainer.classed("axisDrag", false);
    axis1d.fx = null;
    Stack.currentDrag = undefined;
    /* collateO() is deferred while .currentDrag, so do it now. */
    axisApi.collateO?.();
    later(() => {
      let t = axisApi.stacksAdjust(true, undefined);
    });
    /** This could be updated during a drag, whenever dropIn/Out(), but it is
     * not critical.  */
    vc.xDropOutDistance_update(oa);


    if (svgContainer.classed("dragTransition"))
    {
      dLog(fnName, "dragTransition, end");
      dragTransition(false);
    }
    stacks.log();
    setCount('dragended');
  }

  //----------------------------------------------------------------------------

  function deleteAfterDrag(stacks) {
    // draw_orig : let stacks = oa.stacks;
    if (trace_stack)
      console.log("deleteAfterDrag", stacks.toDeleteAfterDrag);

    if (stacks.toDeleteAfterDrag !== undefined)
    {
      stacks.toDeleteAfterDrag.delete();
      stacks.toDeleteAfterDrag = undefined;
    }
    Stack.verify();
    // stacks change has not yet been rendered, so don't compare against DOM here.
    // stacksAxesDomVerify(stacks, oa.svgContainer);
  }

  //----------------------------------------------------------------------------

}

//------------------------------------------------------------------------------

export {
  DragTransition, dragTransitionTime, dragTransitionNew, dragTransition, dragTransitionEnd,
  AxisDrag,
};
