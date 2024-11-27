import { breakPoint } from '../breakPoint';

import {
  eltClassName,
} from '../domElements';


/*----------------------------------------------------------------------------*/

/*global d3 */
/* global CSS */

/*----------------------------------------------------------------------------*/

const trace_axis = 0;
const dLog = console.debug;

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

/** @return true if domain is undefined or [false, false] or [0, 0].
 */
function noDomain(domain) {
  let noDomain = ! domain || ! domain.length ||
    ((domain.length == 2) && ! domain[0] && ! domain[1]);
  return noDomain;
}

/*----------------------------------------------------------------------------*/

/** Check that y axis scale yp.domain() is initialised, and if not,
 * define it from .featureLimits of first block of axis
 *
 * axis-1d : domainChanged()->updateScaleDomain() can handle this, but perhaps
 * that needs an added dependency.
 *
 * @param yp  axis1d.y
 * @param axis1d  e.g. brushedAxis1dID
*/
function ensureYscaleDomain(yp, axis1d) {
  if (! yp.domain().length) {
    let block0 = axis1d.referenceBlock,
    block0featureLimits = block0?.featureLimits;
    if (block0featureLimits) {
      // for GM, blocks[0] has .featureLimits and not .range
      dLog('block0featureLimits', block0featureLimits, axis1d.axisName, block0.brushName);
      yp.domain(block0featureLimits);
    }
  }
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
 * The axis / axis title (g.axis > text) has axis1d in .__data__, axisName in its name and parent's name
 * (i.e. g[i].__data__ === axis1d)
 *
 * g.tick already has a transform, so place the scale transform on g.tick > text.
 * g.btn contains <rect> and <text>, both requiring this scale.
 *
 */
function yAxisTextScale(/*d, i, g*/)
{
  let
  axis1d = this.__data__,
  portion = axis1d && axis1d.portion || 1,
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
/** Configure the d3 axis object for the y axis.
 * Configure :
 * - tickFormat, based on yScale.domain()
 */
function axisConfig(yAxis, yScale)
{
  /** if domain covers a small interval relative to the endpoints, then use
   * the default tickFormat which will show all digits.
   */
  let
  formatString,
  domain = yScale.domain();
  if (domain && (domain.length === 2)) {
    let
    domainLength = Math.abs(domain[1] - domain[0]),
    /** handle -ve endpoint of domain, seen with blast match in gff.
     * ensure that ratio > 1 and digits > 0, required for valid formatString.
     */
    endMagnitudes = domain.map(Math.abs),
    domainMax = Math.max.apply(undefined, endMagnitudes),
    /** draw-map has axisTicks = 10;  the number of ticks drawn varies 7 - 12. */
    axisTicks = oa.drawOptions?.controls?.view?.axisTicks || 10,
    ratio = domainLength && (domainMax / domainLength * axisTicks);
    if (ratio) {
      let
      /** trunc(x + 1) to round up.
       * add some bias to allow for variation in number of ticks, and perhaps
       * allow for the 3-digit steps of SI, i.e. 200M has 3 digits left of decimal point.
       */
      digits = Math.trunc(Math.log10(ratio) + 1 + 0.8);
      // dLog('axisConfig', domainLength, domainMax, ratio, digits);
      formatString = (digits > 6) ? ',' : '.' + digits + 's';
    }
  }
  formatString ||= '';
  let
  format = d3.format(formatString);
  yAxis.tickFormat(format);
}
/**
 * @param gAxis has __data__ which is axis1d; may be g.axis-all or g.btn
 */
function axisExtended(gAxis)
{
  let
  axis1d = gAxis.__data__,
  extended = axis1d?.extended;
  /* .extended should be false or width;  if it is just true then return the default initial width. */
  if (extended === true) {
    let
    nTracksBlocks = (axis1d && axis1d.get('dataBlocks.length')) || 1;
    extended = axis1d.allocatedWidth() ||
      nTracksBlocks * 2 * 10 + 10; // trackWidth===10. orig: 130.  match : getAxisExtendedWidth()
    extended += 10;
  }
  return extended;
}
/** @return transform for the Zoom / Reset button which is currently near the axis title.
 * @description
 * Usage : ... .selectAll('g.axis ... g.btn > text').attr("transform", yAxisBtnScale);
 * The result transform contains both translate(x,y) and scale(...).
 * @param d axis1d
 */
function yAxisBtnScale(d/*, i, g*/)
{
  let g = this.parentElement,
  axis1d = g.__data__, // d === 1
  extended = axisExtended(g),
  xOffset = -30 + (extended ? extended/2 : 0),
  /** Place the Zoom / Reset button below the axis. */
  yOffsetText = ',' + (axis1d.yRange()/axis1d.portion + 10);
  console.log('yAxisBtnScale', g, axis1d.axisName, yOffsetText);
  return 'translate(' + xOffset + yOffsetText + ') ' + yAxisTextScale.apply(this, arguments);
}
/** @return transform for the axis title
 * @description
 * Usage : ... .selectAll("g.axis-all > text")
 * .attr("transform", yAxisTitleTransform(oa.axisTitleLayout))
 * @param d axis1d
 */
function yAxisTitleTransform(axisTitleLayout)
{
  return function (d /*, i, g*/) {
    if (d.isDestroying) {
      return null;
    }
    // order : scale then rotate then translate.
    let 
    gAxis = this.parentElement,
    axis1d = d; // === gAxis.__data__
    if (! axis1d) {
      axis1d = gAxis.__data__;
      dLog('yAxisTitleTransform', 'd undefined', axis1d, this, gAxis);
    }
    let
    width = axisExtended(gAxis),
    /** true if axis is at top of its stack. */
    top = axis1d.stack.axes[0] === axis1d,
    /** See also setWidth() which sets the same translate, initially. */
    translateText = top && width ? " translate(" + width/2 + ",0)" : '';
    if (trace_axis)
      console.log('yAxisTitleTransform', arguments, this, gAxis, axis1d.axisName, axis1d, width, translateText);
    return yAxisTextScale.apply(this, arguments) + ' ' + axisTitleLayout.transform()
      + translateText;
  };
}

/*----------------------------------------------------------------------------*/

/** Designed to be used as an d3 .attr('id' ) function 
 * @return a function to construct a DOM element id from a prefix and an object which has an id field, named idField.
 * @param d d3 selection datum
 * @desc
 * Example usage : selection.attr('id', eltIdFn('ar-', 'axisName') )
 */
function eltIdFn(prefix, idField) { return (d) => prefix + d[idField]; }


/** g.axis-outer Element Id Prefix */
const axisOuterEip = 'id';
/** Used for group element, class "axis-outer"; required because id may start with
 * numeric mongodb id (of geneticmap) and element id cannot start with
 * numeric.
 * Not used for axis element ids; they have an "f" prefix.
 */
function eltId(axis1d)
{
  return axisOuterEip + axis1d.axisName;
}

/** can change to 'sid'. */
const stackEip = 'id';
/** Used for g.stack, which is given a numeric id (@see nextStackID).
 */
function stackEltId(s)
{
  if (s.stackID === undefined) breakPoint();
  dLog("stackEltId", s.stackID, s.axes[0].mapName, s);
  return stackEip + s.stackID;
}

const axisEip = 'a';
/** id of axis g.axis element, based on axisName, with an "a" prefix. */
function axisEltId(axis1d)
{
  return axisEip + axis1d.axisName;
}

/** g.axis-all */
const axisAllEip = 'all';
/** id of g.axis-all element, based on axisName, with an "all" prefix. */
function eltIdAll(axis1d) { return axisAllEip + axis1d.axisName; }

const axisTitleEip = 't';
/** id of 'g.axis-all > text' element, based on axisName (id of reference block of axis), with a 't' prefix. */
function axisEltIdTitle(axis1d) { return 't' + axis1d.axisName; }

const axisClipEip = 'axis-clip-';
const axisClip2dEip = 'axis-clip-2d-';
/** id of <g clippath> element, based on axisName, with an "axis-clip" prefix.
 * Used by axisBrush.js and feature-ticks.js.
 * @param axis1d
 */
function axisEltIdClipPath(axis1d) { return "axis-clip-" + axis1d.axisName; }
/**
 * Used by axis-tracks.js, which still has axisID in element data; when that
 * changes to axis1d, the param can change from axisID to axis1d, as in
 * axisEltIdClipPath().
 * @param axisID
 */
function axisEltIdClipPath2d(axisID) { return "axis-clip-2d-" + axisID; }

/** @return a d3 selection of the svg <g> element which encloses all
 * elements of an axis; its position is :
 *  svg > g[transform] > g.stack > g.axis-outer
 *
 * It contains : 
 *  g.axis-all contains the d3 axis components
 *  g.axis-use contains a <use> of d3 axis (for dualAxis) or simply a
 *		vertical path, and all the axis-2d (split axis) elements and
 *		subComponents (g.track for axis-tracks, g.chart for axis-charts)
 */
function selectAxisOuter(axis1d) {
  /** based on selectAxisUse().   */
  let gAxis = d3.select("g.axis-outer#" + eltId(axis1d));
  return gAxis;
}

/** @return a d3 selection of the svg group element containing the split axis
 * components axis-2d etc <g.axis-use>.
 */
function selectAxisUse(axis1d) {
  /** factored from chart1.js : AxisCharts.prototype.selectParentContainer(), 
   * axis-1d.js : axisSelect(), draw-map.js, ...
   */
  let gAxis = d3.select("g.axis-outer#" + eltId(axis1d) + "> g.axis-use");
  return gAxis;
}

function eltIdGpRef(d, i, g)
{
  dLog("eltIdGpRef", this, d, i, g);
  const
  p2 = this.parentNode.parentElement,
  axis1d = p2.__data__,
  axisName = axis1d.axisName;
  return "#a" + axisName;
}


/** id of highlightFeature div element, based on feature name, with an "h" prefix. */
function highlightId(name)
{
  return "h" + name;
}

/** prefix for id of a g.tracks.  Used within split axis. see components/axis-tracks.js  */
const trackBlockEltIdPrefix = 'tb-';

//------------------------------------------------------------------------------


/**
 * @param d1	axis1d
 * @param this	EnterNode
 */
function moveOrAdd(d1, i, g) {
  let p = g[i]._parent,
      r;
  let gaExists = d3.selectAll("g.axis-outer#id" + d1.axisName);
  if (gaExists.size()) {
    r = gaExists.node();
    dLog('gaExists', gaExists.nodes(), r, p);
  }
  else {
    r = d3.creator('g').apply(this, [d1, i, g]);
  }
  return r;
}

/*----------------------------------------------------------------------------*/

/**
 * @param feature provides feature.id
 */
function axisFeatureCircles_eltId(feature) {
  let
  id = 'fc_' + eltClassName(feature.id);
  return id;
}
function axisFeatureCircles_selectAll() {
  /** see also handleFeatureCircleMouseOver(), which targets a specific feature. */
  let
  selector = "g.axis-outer > circle",
  selection = oa.svgContainer.selectAll(selector);
  return selection;
}
/**
 * @param feature provides feature.id
 */
function axisFeatureCircles_selectOne(feature) {
  let
  /** previously (until 4b47c3b5) elt id contained feature.blockId and feature.name.
   * feature.id is unique regardless of block so blockId is not required with
   * feature.id. */
  selector = "g.axis-outer" + " > circle#" + axisFeatureCircles_eltId(feature),
  circleS = d3.selectAll(selector);
  return circleS;
}
/**
 * @param axisS selector of g.axis-outer containing feature circle
 * if undefined, the axis of the feature's referenceBlock is selected.
 * @param feature provides feature.id
 */
function axisFeatureCircles_selectOneInAxis(axisS, feature) {
  if (! axisS) {
    let
    axis1d = feature.get('blockId.referenceBlockOrSelf.axis1d');
    axisS = axis1d && selectAxisOuter(axis1d);
  }
  let circleS;
  if (! axisS) {
    circleS = d3.select();
  } else {
    let
    selector = "g > circle#" + axisFeatureCircles_eltId(feature);
    circleS = axisS.selectAll(selector);
  }
  return circleS;
}
/** Select the circles of axes which have no viewed blocks.
 */
function axisFeatureCircles_selectUnviewed() {
  let
  selector = "g.axis-outer" + " > circle",
  circleS = d3.selectAll(selector)
    .filter((axisName) => ! oa.axes[axisName]?.blocks.any((b) => b.block.isViewed));
  return circleS;
}
/** Remove features of chrName from selectedFeatures and from the axisFeatureCircles.
 * @param selectedFeatures  selectedService.blocksFeatures (not .selectedFeatures)
 * @param chrName i.e. mapChrName, blockR.brushName
 */
function axisFeatureCircles_removeBlock(selectedFeatures, mapChrName) {
  const fnName = 'axisFeatureCircles_removeBlock';
  // the caller, selectedFeatures_removeAxis(), does delete selectedFeatures[mapChrName]
  selectedFeatures[mapChrName]
    ?.forEach((f) => {
      /* moving the circles into a <g> identified by the blockId would enable
       * all circles of features of a block to be removed in a single
       * operation.
       */
      let
      // similar to mapview.js: removeUnviewedBlockFeaturesFromSelected()
      circleS = axisFeatureCircles_selectOneInAxis(undefined, f);
      circleS.remove();
    });
}

/*----------------------------------------------------------------------------*/

/** Used to colour the blocks within an axis distinctly;
 * Originally was using blockId as index, but now using index within axis.blocks[].
 * The same colours are re-used on each axis.
 */
const
axisTitleColourKey = { index: 1, value : 2, slot : 3},
axisTitleColourBy = axisTitleColourKey.slot;
let
  axisTitle_colour_scale = (axisTitleColourBy === axisTitleColourKey.value) ?
  d3.scaleOrdinal().range(d3.schemeCategory10) :
  d3.scaleSequential().domain([1,11]).interpolator(d3.interpolateRainbow);
let
  /** axisTitle is not currently using schemeCategory10, so can use it here. */
  trait_colour_scale =
  d3.scaleOrdinal().range(d3.schemeCategory10/*20*/);


/** for the stroke and fill of axis title menu
 *
 * parameters match d3 call signature, but now this is wrapped by
 * Block.prototype.axisTitleColour() and Block.axisTitleColour(), which is
 * called from d3.
 *
 * @param d
 *   BlockAxisView / block-axis-view (was blockId, maybe earlier Stacks : Block) (g.axis-all > text > tspan)
 *  ? or blockId (g.axis-use > g.tracks)
 * @param i index of element within group.  i===0 is the reference block, which has colour undefined; data blocks have i>0
 * @param group
 */
function axisTitleColour (d, i) {
  /** blockId can be used as the ordinal value, e.g. let blockId = (d.axisName || d);
   * This results in unique colours for each block; we decided instead to re-use
   * the same set of colours on each axis.
   */
  let value;
  switch (axisTitleColourBy)  {
  case axisTitleColourKey.index :
    value = (i == 0) ? undefined : i;
    break;
  case axisTitleColourKey.value :
    value = d;
    break;
  case axisTitleColourKey.slot :
    /** d is axisName / blockId */
    let
    blockS = d,
    block = blockS && blockS.block,
    axis1d = block?.axis1d || blockS.axis; // if reference then === oa.axes[d],
    value = axis1d && axis1d.blockColour(block);
    if (trace_axis > 1)
      dLog('axisTitleColour', d, i, blockS, block, axis1d, value);
    if (value === -1)
      value = undefined;
    break;
 };
  let
    colour = (value === undefined) ? undefined : axisTitle_colour_scale(value);
  return colour;
};

function traitColour(traitName) {
  return trait_colour_scale(traitName);
}

/*----------------------------------------------------------------------------*/

export {
  Axes, maybeFlip, maybeFlipExtent, noDomain,
  ensureYscaleDomain,
  yAxisTextScale,  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform,
  axisConfig,
  eltIdFn,
  eltId, stackEltId, axisEltId, eltIdAll,
  axisEltIdTitle, axisEltIdClipPath, axisEltIdClipPath2d,
  selectAxisOuter, selectAxisUse, eltIdGpRef,
  highlightId,
  trackBlockEltIdPrefix,
  moveOrAdd,
  axisFeatureCircles_eltId,
  axisFeatureCircles_selectAll,
  axisFeatureCircles_selectOne,
  axisFeatureCircles_selectOneInAxis,
  axisFeatureCircles_selectUnviewed,
  axisFeatureCircles_removeBlock,
  axisTitleColour,
  traitColour,
};
