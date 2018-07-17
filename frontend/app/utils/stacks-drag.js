/*global d3 */

/*------------------------------------------------------------------------*/

    const dragTransitionTime = 1000;  // milliseconds

/*------------------------------------------------------------------------*/

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

/*------------------------------------------------------------------------*/

export { DragTransition, dragTransitionTime, dragTransitionNew, dragTransition, dragTransitionEnd};
