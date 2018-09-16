/*----------------------------------------------------------------------------*/

/*global d3 */

/*----------------------------------------------------------------------------*/

var oa;

function Axes(oa_)
{
  oa = oa_;
};

/*----------------------------------------------------------------------------*/
// moved here from draw-map.js

/** @param domain [min,max], e.g. result of d3.extent()
 * @return if flipped, [max,min]
 */
function maybeFlip(domain, flipped)
{
  return flipped
    ? [domain[1], domain[0]]
    : domain;
}
/** @param extent [[left,top],[right,bottom]], e.g. [[-8,0],[8,myRange]].
 * @return if flipped, [[left,bottom],[right,top]] */
function maybeFlipExtent(extent, flipped)
{
  return flipped
    ? [[extent[0][0], extent[1][1]], [extent[1][0], extent[0][1]]]
    : extent;
}


/*----------------------------------------------------------------------------*/

/** For <text> within a g.axis-outer, counteract the effect of g.axis-outer scale() which
 * is based on axis.portion.
 *
 * Used for :
 *  g.axis-outer > g.axis > g.tick > text
 *  g.axis-outer > g.axis > g.btn     (see following yAxisBtnScale() )
 *  g.axis-outer > g.axis > text
 * g.axis has the axisName in its name (prefixed via axisEltId()) and in its .__data__.
 * The axis / axis title (g.axis > text) has axisName in its name, .__data__, and parent's name
 * (i.e. g[i].__data__ === axisName)
 *
 * g.tick already has a transform, so place the scale transform on g.tick > text.
 * g.btn contains <rect> and <text>, both requiring this scale.
 *
 */
function yAxisTextScale(/*d, i, g*/)
{
  let
    axisName = this.__data__,
  axis = oa.axes[axisName],
  portion = axis && axis.portion || 1,
  scaleText = "scale(1, " + 1 / portion + ")";
  // console.log("yAxisTextScale", d, i, g, this, axisName, axis, portion, scaleText);
  return scaleText;
}
function yAxisTicksScale(/*d, i, g*/)
{
  let parent = this.parentElement,
  gp = parent.parentElement,
  // could update arguments[0] = gp.__data__, then yAxisTextScale() can use d
  scaleText = yAxisTextScale.apply(gp, arguments);
  return scaleText;
}
function yAxisBtnScale(/*d, i, g*/)
{
  return 'translate(10) ' + yAxisTextScale.apply(this, arguments);
}
function yAxisTitleTransform(axisTitleLayout)
{
  return function (/*d, i, g*/) {
    // order : scale then rotate (then translate but none in this case)
    return yAxisTextScale.apply(this, arguments) + ' ' + axisTitleLayout.transform();
  };
}

/*----------------------------------------------------------------------------*/

/** Used for group element, class "axis-outer"; required because id may start with
 * numeric mongodb id (of geneticmap) and element id cannot start with
 * numeric.
 * Also used for g.stack, which is given a numeric id (@see nextStackID).
 * Not used for axis element ids; they have an "f" prefix.
 */
function eltId(name)
{
  return "id" + name;
}
/** id of axis g element, based on axisName, with an "a" prefix. */
function axisEltId(name)
{
  return "a" + name;
}
/** id of g.axis-all element, based on axisName, with an "all" prefix. */
function eltIdAll(d) { return "all" + d; }
/** id of <g clippath> element, based on axisName, with an "axis-clip" prefix. */
function axisEltIdClipPath(d) { return "axis-clip" + d; }

/** id of highlightFeature div element, based on feature name, with an "h" prefix. */
function highlightId(name)
{
  return "h" + name;
}

/*----------------------------------------------------------------------------*/

/** Used to colour the blocks within an axis distinctly;
 * Originally was using blockId as index, but now using index within axis.blocks[].
 */
let
      axisTitle_colour_scale = d3.scaleOrdinal();
      axisTitle_colour_scale.range(d3.schemeCategory10);

/** for the stroke and fill of axis title menu
 * parameters match d3 call signature
 * @param d blockId
 * @param i index of element within group
 * @param group
 */
function axisTitleColour (d, i) {
  let
    colour = (i == 0) ? undefined : axisTitle_colour_scale(i /*d*/);
  return colour;
};

/*----------------------------------------------------------------------------*/

export {  Axes, maybeFlip, maybeFlipExtent, yAxisTextScale,  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform, eltId, axisEltId, eltIdAll, axisEltIdClipPath, highlightId, axisTitleColour } ;
