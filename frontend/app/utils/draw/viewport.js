import Ember from 'ember';

import  { logElementDimensions2 } from '../domElements';

const trace_resize = 0;

/*----------------------------------------------------------------------------*/

/** Calculate values which depend on the width and height of the DOM element
 * which contains the drawing.  This is used at first render, and when the
 * user resizes the browser tab or clicks a side panel open/close/resize
 * button.  */
/** Measure the screen size allocated to the drawing, and calculate
 * size-related variables.
 * Attributes :
 * .margins, .viewPort, .graphDim, .yRange, .xDropOutDistance, .dragLimit, ..axisXRange
 */
function Viewport()
{
};
/** Used by the caller to do an initial calc(), then 1 calc after sub-components have had time to render. */
Viewport.prototype.count = 0;
Viewport.prototype.calc = function(oa)
{
  /** width in pixels of the axisHeaderText, which is
   * 30 chars when the axis (chromosome) name contains the 24 hex char mongodb numeric id,
   * e.g. 58a29c715a9b3a3d3242fe70_MyChr
   */
  let axisHeaderTextLen = 204; // 203.5, rounded up to a multiple of 2;

  let divHolder,
  holderWidth;
  /** margins: top right bottom left */
  let margins,
  /** indices into margins[]; standard CSS sequence. */
  marginIndex = {top:0, right:1, bottom:2, left:3};

  //- axis droptarget
    /** small offset from axis end so it can be visually distinguished. */
  this.dropTargetYMargin = 10;  //- could be in .prototype, or ...
  let
  dropTargetXMargin = 10,

  /** Width and Height.  viewport dimensions - margins. */
  w,
  h,

  /** approx height of map / chromosome selection buttons above graph */
  axisSelectionHeight = 30,
  /** Axes which have a reference block and multiple data blocks show each block
   * name on a separate line in the axis title.  Other axes have just 1 line of
   * text in the title, so the minimum value of axisNameRows is 1.
   * This can be made a configurable option, and adjusted for the actual max #
   * of rows in axis titles.
   */
  axisNameRows = 5,
  /** approx height of text name of map+chromosome displayed above axis.
   *   *axisNameRows for parent/child; later can make that dependent on whether there are any parent/child axes.
   */
  axisNameHeight = 14 * axisNameRows,
  /** approx height of text block below graph which says 'n selected features' */
  selectedFeaturesTextHeight = 14,


  /** yRange is the stack height, i.e. sum of stacked axis lengths */
  yRange,

  /** X Distance user is required to drag axis before it drops out of Stack. */
  xDropOutDistance,

  /** left and right limits of dragging the axes / chromosomes / linkage-groups. */
  dragLimit,
  /** x range of the axis centres. */
  axisXRange;

  let viewPort;

  /** dimensions of the graph border */
  let graphDim;

  this.axisTopOffset = /*axisSelectionHeight +*/ axisNameHeight;

  divHolder=Ember.$('div#holder');
  /** @param jqElt  jQuery single DOM element */
  function eltStylePaddingRect(e)
  {
    let s = e.style;
    return [
      s.paddingTop, 
      s.paddingRight,
      s.paddingBottom,
      s.paddingLeft
    ];
  };
  let holderElt = divHolder[0],
  /** standard CSS order, same as margins : top right bottom left */
  holderPadding = eltStylePaddingRect(holderElt);
  holderWidth = divHolder.width();
    /**  px */
    let topPanelHeight = 100,
        /** for display of marker details below graph */
        bottomPanelHeight = 60;
  /** 	margins : top right bottom left */
  this.margins =
    // 14 was maybe for axisNameHeight, not needed
    margins = [20/*+14*/+1, 0, 10, 0] // 10, 10, 10],
    .map(function (m, i) { return m + holderPadding[i]; });

  logElementDimensions2(divHolder);

  this.viewPortPrev = this.viewPort;
  /** use width of div#holder, not document.documentElement.clientWidth because of margins L & R. */
  this.viewPort =
    viewPort = {w: holderWidth, h:document.documentElement.clientHeight};

  /// Width and Height.  viewport dimensions - margins.
  w = viewPort.w  - margins[marginIndex.right] - margins[marginIndex.left];
  h = viewPort.h - margins[marginIndex.top] - margins[marginIndex.bottom];

  /// dimensions of the graph border
    this.graphDim =
        graphDim =
        {
            w: w*0.9,
            h: h - 2 * this.dropTargetYMargin
            - this.axisTopOffset
            - topPanelHeight - bottomPanelHeight
        };
  // layout has changed, no value in this :  - selectedFeaturesTextHeight

  this.yRange = 
    yRange = graphDim.h - 40;
  /* Same calculation in @see Viewport.prototype.xDropOutDistance_update().
   * Based on stacks.length;  (formerly used axisIDs.length until the stacks were formed).
   * See also DropTarget.size.w.
   */
  this.xDropOutDistance =
    xDropOutDistance = viewPort.w/((oa.stacks.length || 1)*6);

  this.dragLimit =
    dragLimit = {min:-50, max:graphDim.w+70};
  if (trace_resize)
    console.log("viewPort=", viewPort, ", w=", w, ", h=", h, ", graphDim=", graphDim, ", yRange=", yRange);
  /// pixels.  can calculate this from axis name * font width

  /// x range of the axis centres. left space at left and right for
  /// axisHeaderTextLen which is centred on the axis.
  /// index: 0:left, 1:right
  this.axisXRange = [0 + axisHeaderTextLen/2, graphDim.w - axisHeaderTextLen/2];
  // -  some other results of Viewport().calc() are currently accessed within a previous draw() closure  (yRange, xDropOutDistance, dragLimit)
  if (trace_resize)
    console.log("Viewport.calc()", this);

  // expose these values for use in draw-map
  this.axisHeaderTextLen = axisHeaderTextLen;
  this.margins = margins;
  this.marginIndex = marginIndex;
};

/** @return value for viewBox attribute of <svg> containing the graph */
Viewport.prototype.viewBox = function()
{
  return "0 " + -this.axisTopOffset + " " + this.graphDim.w + " " + (this.graphDim.h + this.axisTopOffset);
};

/** Based on drawing width and the number of stacks,
 * update the X distance beyond which an axis must be dragged to be dragged out of a stack.
 * The same calculation is done initially in Viewport.prototype.calc().
 */
Viewport.prototype.xDropOutDistance_update = function (oa) {
  let viewPort = this.viewPort;
  /** If no stacks then result is not used; avoid divide-by-zero. */
  let nStacks = oa.stacks.length || 1;
  let previous = this.xDropOutDistance;
  this.xDropOutDistance =
    viewPort.w/(nStacks*6);
  if (trace_resize)
    console.log('xDropOutDistance_update', previous, '->', this.xDropOutDistance, viewPort.w, nStacks);
};


/*----------------------------------------------------------------------------*/

export { Viewport };
