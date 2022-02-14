
/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

function deg2Rad(degrees)
{
  return degrees * Math.PI / 180;
}
function rad2Deg(radians)
{
  return radians * 180 / Math.PI;
}

/*----------------------------------------------------------------------------*/

function AxisTitleLayout()
{
};

/*----------------------------------------------------------------------------*/

/** Moved here from draw-map.js : AxisTitleLayout.prototype .calc(), .transform()
 */

AxisTitleLayout.prototype.calc = function(axisSpacing, titlePx)
{
  this.axisSpacing = axisSpacing;
  this.titlePx = titlePx;
  this.verticalTitle = axisSpacing < titlePx;
  dLog('updateAxisTitleSize AxisTitleLayout.calc', axisSpacing, this.verticalTitle, this);

  let
  /** approx height of map / chromosome selection buttons above graph */
  axisSelectionHeight = 30,
  /** from css line-height, or approx axisFontSize + 3 */
  axisTitleLineHeight = 17,

  /* axisNameRows and axisNameHeight are moved here from viewport.js;
   * In the medium term axisNameRows will be derived from axis-1d : viewedBlocks(),
   * and will also calculate the height of the top-right corner from angle, axisNameHeight and width.
   */

  /** Axes which have a reference block and multiple data blocks show each block
   * name on a separate line in the axis title.  Other axes have just 1 line of
   * text in the title, so the minimum value of axisNameRows is 1.
   * This can be made a configurable option, and adjusted for the actual max #
   * of rows in axis titles.
   * Update : the blocks list in the axis title will be moved into the axis
   * title menu, so height will only be required for the title row - 1.
   */
  axisNameRows = 1,
  /** approx height of text name of map+chromosome displayed above axis.
   *   *axisNameRows for parent/child; later can make that dependent on whether there are any parent/child axes.
   */
  axisNameHeight = axisTitleLineHeight * axisNameRows;


  /** height, angle are undefined when ! verticalTitle */
  let height, angle;
  /** The title is rotated up to fit within width == axisSpacing, unless that
   * requires angle > angleThresh.
   */
  let width = axisSpacing;
  if (this.verticalTitle)
  {
    angle = Math.acos(axisSpacing / titlePx);
    let adj2 = titlePx * titlePx - axisSpacing * axisSpacing;
    if (adj2 <= 0)
      dLog('titlePx', titlePx, '<', 'axisSpacing', axisSpacing);
    height = (adj2 > 0) ? Math.sqrt(adj2) : 50;
    /** Allow text to overlap the adjacent column once it clears the adjacent title.  */
    let angleThresh = deg2Rad(12);
    if (angle > angleThresh)
    {
      angle = (angle - angleThresh) / 3 + angleThresh;
      height = titlePx * Math.sin(angle);
      width = titlePx * Math.cos(angle);;
    }
    // convert radians to degrees
    angle = rad2Deg(angle);
    dLog(axisSpacing, titlePx, 'angle', angle, width, height);
    if (! height > 0) height = 0;
    angle = -angle;
  }
  else
    height = 0;
    /**  height for the axis title, plus vertical allowances; larger increase when verticalTitle.
     * The 50(px) replaces padding-top (earlier version of chrome didn't clip the
     * <text><tspan> as it entered padding-top).
     *
     * Used for the <svg> viewBox
     * The text is at y=-24 (-2 * axisFontSize)
     * (addding 2 * axisTitleLineHeight here)
     *
     * Changing #holder { padding-top } from 50px to 0, so that long titles can
     * enter the white-space above the graph, instead of using padding.
     * So adding that 50px here, plus headroom for verticalTitle.
     */
  let straightHeight = 
    50 + axisNameHeight + 2 * axisTitleLineHeight;

  this.height = straightHeight + height;
  this.angle = angle;
  this.width = width;
};

/** Return any extra width required for the right axis title.
 * If not rotated up, or if (angle <= angleThresh), the title fits within
 * axisSpacing; in either case the extra margin required is width.
 * @return 0 if width (and hence axisSpacing) are undefined
 */
AxisTitleLayout.prototype.increaseRightMargin = function()
{
  return this.width ? this.width : 0;
};

/** @return '' if ! .verticalTitle (i.e. ! .angle) */
AxisTitleLayout.prototype.transform = function()
{
  let transform = this.angle ? "rotate("+this.angle+")" : '';
  return transform;
};


/*----------------------------------------------------------------------------*/

export { AxisTitleLayout };
