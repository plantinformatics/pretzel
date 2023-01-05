import $ from 'jquery';

import  { logElementDimensions2 } from '../domElements';

const trace_resize = 0;
const dLog = console.debug;

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

  /** approx height of text block below graph which says 'n selected features'
   * also
   * @see axisTitleFontHeight
   * @see axisFontSize
   */
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

  const holderSelector = 'div#holder';
  divHolder=$(holderSelector);
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
    margins = [/*20+14*/+1, 0, 10, 0] // 10, 10, 10],
    .map(function (m, i) { return m + holderPadding[i]; });

  if (trace_resize)
    logElementDimensions2(divHolder);

  this.viewPortPrev = this.viewPort;
  /** use width of div#holder, not document.documentElement.clientWidth because of margins L & R. */

  let eltHeight;
  const
  controls = oa.axisApi.drawMap.controls,
  /** component:panel/view-controls */
  controlsView = controls.view;
  this.controlsView = controlsView;
  let
  componentGeometry = oa?.eventBus?.get('componentGeometry'),
  controls_window = controls.window,
  tablesPanelRight = controls_window ? controls_window.tablesPanelRight : componentGeometry.get('tablesPanelRight');
  /** iniiially .sizes and .tablesPanelRight are not defined; initial value of
   * controllers/mapview : tablesPanelRight is false.
   */
  if (! tablesPanelRight) {
    /** Height of the first element in the split-view, which contains #holder. */
    eltHeight = divHolder.parent().parent().height();
  } else {
    eltHeight = document.documentElement.clientHeight - topPanelHeight; // - bottomPanelHeight;
  }

  this.viewPort =
    viewPort = {w: holderWidth, h: eltHeight};

  /// Width and Height.  viewport dimensions - margins.
  w = viewPort.w  - margins[marginIndex.right] - margins[marginIndex.left];
  h = viewPort.h - margins[marginIndex.top] - margins[marginIndex.bottom];

  /// dimensions of the graph border
    this.graphDim =
        graphDim =
        {
            w: w,
            h: h - 2 * this.dropTargetYMargin
            // - this.axisTopOffset
        };
  // layout has changed, no value in this :  - selectedFeaturesTextHeight

  this.yRange = 
    yRange = graphDim.h - 40;
  const stacks = oa.axisApi.stacksView?.stacks;
  /* Same calculation in @see Viewport.prototype.xDropOutDistance_update().
   * Based on stacks.length;  (formerly used axisIDs.length until the stacks were formed).
   * See also DropTarget.size.w.
   */
  this.xDropOutDistance =
    xDropOutDistance = viewPort.w/((stacks?.length || 1)*6);

  this.dragLimit =
    dragLimit = {min:-50, max:graphDim.w+70};
  if (trace_resize)
    console.log("viewPort=", viewPort, ", w=", w, ", h=", h, ", graphDim=", graphDim, ", yRange=", yRange);

  let
  /** input range value is string */
  extraOutsideMargin = +controlsView?.extraOutsideMargin || 0;

  /** axisXRange is the
   * x range of the axis centres. reserved space at left and right for
   * axisHeaderTextLen which is centred on the axis.
   * index: 0:left, 1:right
   *
   * outsideMargin has a lower limit of 90 for the index tick text (enough for 9
   * digits with 2 commas).
   */
  let outsideMargin = Math.max(90, this.axisHeaderTextLen/2) + extraOutsideMargin;
  /** add some extra space on left to allow for long text selected.labelledFeatures (axis-1d : showLabels() ) */
  let extraLeftMargin = 50;
  this.axisXRange = [0 + outsideMargin + extraLeftMargin, graphDim.w - outsideMargin];
  // -  some other results of Viewport().calc() are currently accessed within a previous draw() closure  (yRange, xDropOutDistance, dragLimit)
  if (trace_resize)
    console.log("Viewport.calc()", this);

  // save this value for use in .viewBox()
  this.axisTitleLayout = oa.axisTitleLayout;
  this.margins = margins;
  this.marginIndex = marginIndex;
  this.drawOptions = oa.drawOptions;
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

  let
  controlsView = this.controlsView,
  showAxisText = controlsView ? controlsView.showAxisText : true,
  axisTitleHeight = showAxisText ?
    ((this.axisTitleLayout && this.axisTitleLayout.height !== undefined) ? this.axisTitleLayout.height : 0) :
    80;
  let viewBox = {
    min_x : (0 + shiftLeft),
    min_y : - axisTitleHeight,
    width : (this.graphDim.w + increaseWidth),
    height : (this.graphDim.h + axisTitleHeight)},
  viewBoxText = "" + viewBox.min_x + " " + viewBox.min_y + " " +
    viewBox.width + " " + viewBox.height;
  dLog('viewBox', viewBox, viewBoxText, this, shiftLeft, increaseWidth, axisTitleHeight);
  return viewBoxText;
};

/** Based on drawing width and the number of stacks,
 * update the X distance beyond which an axis must be dragged to be dragged out of a stack.
 * The same calculation is done initially in Viewport.prototype.calc().
 */
Viewport.prototype.xDropOutDistance_update = function (oa) {
  let viewPort = this.viewPort;
  const stacks = oa.axisApi.stacksView?.stacks;
  /** If no stacks then result is not used; avoid divide-by-zero. */
  let nStacks = stacks?.length || 1;
  let previous = this.xDropOutDistance;
  this.xDropOutDistance =
    viewPort.w/(nStacks*6);
  if (trace_resize)
    console.log('xDropOutDistance_update', previous, '->', this.xDropOutDistance, viewPort.w, nStacks);
};


/*----------------------------------------------------------------------------*/

export { Viewport };
