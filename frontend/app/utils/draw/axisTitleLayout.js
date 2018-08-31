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
  console.log('updateAxisTitleSize AxisTitleLayout.calc', axisSpacing, this.verticalTitle, this);
  /** height, angle are undefined when ! verticalTitle */
  let height, angle;
  /** The title is rotated up to fit within width == axisSpacing, unless that
   * requires angle > angleThresh.
   */
  let width = axisSpacing;
  if (this.verticalTitle)
  {
    angle = Math.acos(axisSpacing / titlePx);
    height = Math.sqrt(titlePx * titlePx - axisSpacing * axisSpacing);
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
    console.log(axisSpacing, titlePx, 'angle', angle, width, height);
    /* The <svg> viewBox -70 already gives 70px of vertical space above
     * (from viewport.js: axisNameHeight)
     * But also, the text is at y=-24 (-2 * axisFontSize)
     */
    height = height - 70 + 2 * 12 /*axisFontSize*/;
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
