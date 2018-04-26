/*----------------------------------------------------------------------------*/

    /** update ys[a.axisName]  and y[a.axisName] for the given axis,
     * according to the current yRange, and for ys, the axis's current .portion.
     * @param a axis (i.e. axes[a.axisName] == a)
     * These 3 params are currently coming from oa.y, oa.ys, oa.vc :
     * @param y  axes yscale to update
     * @param ys  foreground yscale to update
     * @param vc  ViewPort
     */
function updateRange(y, ys, vc, a)
{
  // factored out of draw-map.js

  // console.log("updateRange", a, a.axisName, ys.length, ys[a.axisName]);
  // if called before ys is set up, do nothing.
  if (ys && ys[a.axisName])
  {
    let myRange = a.yRange();
    console.log("updateRange", a.axisName, a.position, a.portion, myRange, vc.yRange);
    ys[a.axisName].range([0, myRange]);
    y[a.axisName].range([0, vc.yRange]);
  }
}

/*----------------------------------------------------------------------------*/

export { updateRange };
