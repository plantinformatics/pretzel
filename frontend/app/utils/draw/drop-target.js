import { breakPoint } from '../breakPoint';

/** the DropTarget which the cursor is in, recorded via mouseover/out events
 * on the DropTarget-s.  While dragging this is used to know the DropTarget
 * into which the cursor is dragged.
 */
// oa.currentDropTarget /*= undefined*/;

function DropTarget(oa, vc, g) {
  let viewPort = oa.vc.viewPort;
  const axisHeaderTextLen = vc.axisHeaderTextLen;
  let size = {
    /** Avoid overlap, assuming about 5-7 stacks. */
    w : Math.round(Math.min(axisHeaderTextLen, viewPort.w/15)),
    // height of dropTarget at the end of an axis
    h : Math.min(80, viewPort.h/10),
    // height of dropTarget covering the adjacent ends of two stacked axes
    h2 : Math.min(80, viewPort.h/10) * 2 /* + axis gap */
  },
  posn = {
    X : Math.round(size.w/2),
    Y : /*YMargin*/10 + size.h
  },
  /** top and bottom edges relative to the axis's transform.
   */
  edge = {
    top : size.h,
    /** Originally bottom() depended on the axis's portion, but now g.axis-outer
     * has a transform with translate and scale which apply the axis's portion
     * to the elements within g.axis-outer.
     * So bottom() is now based on vc.yRange instead of axis.yRange().
     * @param axis is not used - see comment re. edge.
     */
    bottom : function (axis) { return vc.yRange /* formerly axis.yRange() */ - size.h; }
  };
  /** Same as dropTargetY().
   * Called via d3 .attr().
   * @param this  <rect> DOM element in g.stackDropTarget
   */
  function dropTargetYresize () {
    /** DOMTokenList. contains top or bottom etc */
    let rect = this,
    parentClasses = rect.parentElement.classList,
    top = parentClasses.contains('top'),
    bottom = parentClasses.contains('bottom'),
    yVal = top ? -oa.vc.dropTargetYMargin : edge.bottom(undefined);
    // console.log('dropTargetYresize', rect, parentClasses, top, bottom, yVal);
    return yVal;
  };

  /** @return axis which this DropTarget is part of */
  DropTarget.prototype.getAxis = function ()
  {
    /** The datum of the DropTarget is the axisName */
    let axisName = this.datum(),
    axis = oa.axes[axisName];
    return axis;
  };
  /// @parameter top  true or false to indicate zone is positioned at top or
  /// bottom of axis
  /// uses g, a selection <g> of all Axes
  DropTarget.prototype.add = function (top)
  {
    // Add a target zone for axis stacking drag&drop
    let stackDropTarget = 
      g.append("g")
      .attr("class", "stackDropTarget" + " end " + (top ? "top" : "bottom"));
    let
      dropTargetY = function (datum/*, index, group*/) {
        let axisName = datum,
        axis = oa.axes[axisName],
        yVal = top ? -oa.vc.dropTargetYMargin : edge.bottom(axis);
        if (Number.isNaN(yVal))
        {
          console.log("dropTargetY", datum, axis, top, oa.vc.dropTargetYMargin, edge.bottom(axis));
          breakPoint();
        }
        return yVal;
      };
    stackDropTarget
      .append("rect")
      .attr("x", -posn.X)
      .attr("y", dropTargetY)
      .attr("width", 2 * posn.X)
      .attr("height", posn.Y)
    ;

    stackDropTarget
      .on("mouseover", dropTargetMouseOver)
      .on("mouseout", dropTargetMouseOut);
  };

  /** The original design included a drop zone near the middle of the axis,
   * for dropping an axis out of its current stack; this is replaced by
   * dropping past xDropOutDistance, so this is not enabled.
   * @parameter left  true or false to indicate zone is positioned at left or
   * right of axis
   */
  DropTarget.prototype.addMiddle = function (left)
  {
    // Add a target zone for axis stacking drag&drop
    let stackDropTarget = 
      g.append("g")
      .attr("class", "stackDropTarget" + " middle " + (left ? "left" : "right"));
    function dropTargetHeight(datum/*, index, group*/)
    {
      // console.log("dropTargetHeight", datum, index, group);
      /** dropTargetHeight is axis height minus the height of the top and bottom drop zones.
       * Translate and scale is provided by transform of g.axis-outer, so
       * use vc yRange not axis.yRange().  More detailed comment in @see edge.bottom().
       * So axis is not used :
       let axisName = datum,
       axis = oa.axes[axisName];
       */
      return vc.yRange - 2 * size.h;
    }
    stackDropTarget
      .append("rect")
      .attr("x", left ? -1 * (oa.vc.dropTargetXMargin + posn.X) : oa.vc.dropTargetXMargin )
      .attr("y", edge.top)
      .attr("width", posn.X /*- oa.vc.dropTargetXMargin*/)
      .attr("height", dropTargetHeight)
    ;

    stackDropTarget
      .on("mouseover", dropTargetMouseOver)
      .on("mouseout", dropTargetMouseOut);
  };

  /** Show the affect of window resize on axis drop target zones.
   * Only the y value of g.top > rect elements need be changed.
   * Target zone width could be changed in response to window width change - that is not done.
   */
  DropTarget.prototype.showResize = function ()
  {
    oa.svgContainer.selectAll('g.stackDropTarget.bottom > rect')
      .attr("y", dropTargetYresize)
    // .each(function(d, i, g) { console.log(d, i, this); })
    ;
  };

  function storeDropTarget(axisName, classList)
  {
    oa.currentDropTarget = {axisName: axisName, classList: classList};
  }

  function dropTargetMouseOver(data, index, group){
    console.log("dropTargetMouseOver() ", this, data, index, group);
    this.classList.add("dragHover");
    storeDropTarget(data, this.classList);
  }
  function dropTargetMouseOut(d){
    console.log("dropTargetMouseOut", d);
    this.classList.remove("dragHover");
    oa.currentDropTarget = undefined;
  }

}

export {
  DropTarget,
}
