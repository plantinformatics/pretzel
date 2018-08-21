
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
  if (this.verticalTitle)
  {
    angle = Math.acos(axisSpacing / titlePx);
    height = Math.sqrt(titlePx * titlePx - axisSpacing * axisSpacing);
    /** Allow text to overlap the adjacent column once it clears the adjacent title.  */
    let angleThresh = 20 * Math.PI / 180;
    if (angle > angleThresh)
    {
      angle = (angle - angleThresh) / 3 + angleThresh;
      height = titlePx * Math.sin(angle);
    }
    // convert radians to degrees
    angle = angle * 180 / Math.PI;
    console.log(axisSpacing, titlePx, 'angle', angle, height);
    // The <svg> viewBox -70 already gives 70px of vertical space above
    // (from viewport.js: axisNameHeight)
    height = height - 70;
    if (height < 0) height = 0;
    angle = -angle;
  }
  this.height = height;
  this.angle = angle;
};

/** @return '' if ! .verticalTitle (i.e. ! .angle) */
AxisTitleLayout.prototype.transform = function()
{
  let transform = this.angle ? "rotate("+this.angle+")" : '';
  return transform;
};


/*----------------------------------------------------------------------------*/

export { AxisTitleLayout };
