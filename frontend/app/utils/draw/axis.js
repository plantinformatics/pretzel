/*----------------------------------------------------------------------------*/

var oa;

function Axes(oa_)
{
  oa = oa_;
};


/*----------------------------------------------------------------------------*/

/** For <text> within a g.ap, counteract the effect of g.ap scale() which
 * is based on ap.portion.
 *
 * Used for :
 *  g.ap > g.axis > g.tick > text
 *  g.ap > g.axis > g.btn     (see following yAxisBtnScale() )
 *  g.ap > g.axis > text
 * g.axis has the apName in its name (prefixed via axisEltId()) and in its .__data__.
 * The AP / axis title (g.axis > text) has apName in its name, .__data__, and parent's name
 * (i.e. g[i].__data__ === apName)
 *
 * g.tick already has a transform, so place the scale transform on g.tick > text.
 * g.btn contains <rect> and <text>, both requiring this scale.
 *
 */
function yAxisTextScale(/*d, i, g*/)
{
  let
    apName = this.__data__,
  ap = oa.aps[apName],
  portion = ap && ap.portion || 1,
  scaleText = "scale(1, " + 1 / portion + ")";
  // console.log("yAxisTextScale", d, i, g, this, apName, ap, portion, scaleText);
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

/*----------------------------------------------------------------------------*/

/** Used for group element, class "AP"; required because id may start with
 * numeric mongodb id (of geneticmap) and element id cannot start with
 * numeric.
 * Also used for g.stack, which is given a numeric id (@see nextStackID).
 * Not used for axis element ids; they have an "m" prefix.
 */
function eltId(name)
{
  return "id" + name;
}
/** id of axis g element, based on apName, with an "a" prefix. */
function axisEltId(name)
{
  return "a" + name;
}
/** id of highlightMarker div element, based on marker name, with an "h" prefix. */
function highlightId(name)
{
  return "h" + name;
}


/*----------------------------------------------------------------------------*/

export {  Axes, yAxisTextScale,  yAxisTicksScale,  yAxisBtnScale, eltId, axisEltId, highlightId } ;
