
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
    /* The <svg> viewBox -70 already gives 70px of vertical space above
     * (from viewport.js: axisNameHeight)
     * But also, the text is at y=-24 (-2 * axisFontSize)
     *
     * Changing #holder { padding-top } from 50px to 0, so that long titles can
     * enter the white-space above the graph, instead of using padding.
     * So adding that 50px here, plus headroom for verticalTitle, which can be
     * calculated but for now use 300 to allow for 6 rows of axis title.
     */
    let
      /** copied from viewport.js for quick change (demo); this logic can be
       * moved here, along with using a CP to calculate axisNameRows,
       * and calculating the height of the top-right corner.
       */
  axisNameRows = 7,
    axisNameHeight = 14 * axisNameRows;
    height = (height || 0) + 50 + axisNameHeight + 2 * 12 /*axisFontSize*/;
    if (height < 0) height = 0;
    angle = -angle;
  }
  this.height = height;
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
