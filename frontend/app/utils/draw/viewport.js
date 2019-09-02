import Ember from 'ember';

import  { logElementDimensions2 } from '../domElements';

const trace_resize = 0;

/*----------------------------------------------------------------------------*/

/** width in pixels of the axisHeaderText, which is
 * 30 chars when the axis (chromosome) name contains the 24 hex char mongodb numeric id,
 * e.g. 58a29c715a9b3a3d3242fe70_MyChr
 * This is a fairly arbitrary default; we no longer display mongodb numeric ids,
 * but the real dataset and block names are 20-30 chars.
 * This value is only used until the actual title lengths are measured by
 * Block.titleTextMax().
 */
const axisHeaderTextLen = 204; // 203.5, rounded up to a multiple of 2;

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
  /** pixels.  the default is replaced by a value calculated from axis name * font width */
  this.axisHeaderTextLen = axisHeaderTextLen;
};
/** Used by the caller to do an initial calc(), then 1 calc after sub-components have had time to render. */
Viewport.prototype.count = 0;
Viewport.prototype.calc = function(oa)
{
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

  const holderSelector = 'div#holder';
  divHolder=Ember.$(holderSelector);
  if (divHolder.length === 0) {
    console.warn('Viewport() : element not found :', holderSelector, this, oa);
    // size calculations depend on holder dimensions, so fail.
    return;
  }
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
            w: w,
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

  /** axisXRange is the
   * x range of the axis centres. reserved space at left and right for
   * axisHeaderTextLen which is centred on the axis.
   * index: 0:left, 1:right
   *
   * outsideMargin has a lower limit of 90 for the index tick text (enough for 9
   * digits with 2 commas).
   */
  let outsideMargin = Math.max(90, this.axisHeaderTextLen/2);
  this.axisXRange = [0 + outsideMargin, graphDim.w - outsideMargin];
  // -  some other results of Viewport().calc() are currently accessed within a previous draw() closure  (yRange, xDropOutDistance, dragLimit)
  if (trace_resize)
    console.log("Viewport.calc()", this);

  // save this value for use in .viewBox()
  this.axisTitleLayout = oa.axisTitleLayout;
  this.margins = margins;
  this.marginIndex = marginIndex;
};

/** @return value for viewBox attribute of <svg> containing the graph */
Viewport.prototype.viewBox = function()
{
  /** When verticalTitle, text-anchor:start, so move the graph left slightly and add title length to the width */
  let verticalTitle = this.axisTitleLayout && this.axisTitleLayout.verticalTitle,
  shiftLeft = verticalTitle ? 20 : 0,
  /** the right axis title needs more width when verticalTitle.
   * have already allocated outsideMargin, which is half the title width.
   * This can be pushed back into the outsideMargin calc.
   */
  increaseWidth = verticalTitle ?
    ((this.axisTitleLayout && (this.axisTitleLayout.increaseRightMargin() / 2 - shiftLeft)) || 0) : 0;
  return "" + (0 + shiftLeft) + " " + -this.axisTopOffset + " " +
    (this.graphDim.w + increaseWidth) + " " + (this.graphDim.h + this.axisTopOffset);
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
