import { I } from './d3-svg';

import {
  Stacked,
  Block,
  stacks,
} from '../stacks';

import {
  AxisChrName,
} from '../utility-chromosome';

import { syntenyBlock_2Feature } from './synteny-blocks-draw';

import { inRange } from './zoomPanCalcs';

import { log_ffaa } from "./collate-paths";

import {
  unique_1_1_mapping 
} from '../paths-config';

import { breakPoint } from '../breakPoint';

import { lookupFeature } from '../feature-lookup';
import { pathClassA } from './path-classes';
import { PathInfo } from './path-info';
import { PathClasses } from './path-classes';


//------------------------------------------------------------------------------

/* global d3 */

//------------------------------------------------------------------------------

const
line = d3.line();

const trace_scale_y = 0;
const trace = 0;
const trace_path = 0;
let trace_path_count = 0;
const trace_synteny = 1;
const trace_stack = 0;


const dLog = console.debug;

//------------------------------------------------------------------------------

/** Enable display of extra info in the path hover (@see hoverExtraText).
 * Currently a debugging / devel feature, will probably re-purpose to display metadata.
 */
let showHoverExtraText = true;

/** true means the path datum is not used - its corresponding data is held in its parent g
 */
const pathDataInG = true;

//------------------------------------------------------------------------------


function PathDataUtils(oa) {

  /** true means the <path> datum is the text of the SVG line, otherwise it is
   * the "ffaa" data and the "d" attr is the text of the SVG line.
   * @see featureNameOfPath().
   */
  let pathDataIsLine;

  /** trace scale of each axis just once after this is cleared.  enabled by trace_scale_y.  */
  let tracedAxisScale = {};


  const result = {
    blockO, 
    // featureLine2, 
    inside, 
    pointSegment, 
    featureLineS2, 
    featureLineS3, 
    featureLineS, 
    lineHoriz, 
    // featureLine, 
    path, 
    pathU, 
    pathUg, 
    pathAliasGroup, 
    /** inRangeI{,2}() are only used here */
    inRangeI, 
    inRangeI2, 
    featureAliasesText, 
    pathFeatureStore, 
    // featureNameInRange, 
    featureInRange, 
    patham, 
    // axisFeatureTick, 
    patham2, 
    featureY2, 
    log_path_data, 
    pathUpdate_, 
    // log_foreground_g, 
    pathUpdate, 
    dataOfPath, 
    featureNameOfPath, 

    get controlsView() { return oa.eventBus.controls.view; },
  };

  //----------------------------------------------------------------------------

  /**  If unique_1_1_mapping then path data is ffaa, i.e. [feature0, feature1, a0, a1]
   */
  function featureNameOfData(da)
  {
    const
    feature = (da.length === 4)  // i.e. ffaa (enabled by unique_1_1_mapping)
      ? da[0]  //  ffaa, i.e. [feature0, feature1, a0, a1]
      : da,
    featureName = feature.name;
    return featureName;
  }
  /** @see also pathsUnique_log()  */
  function data_text(da)
  {
    return unique_1_1_mapping   // ! flow.direct
      ? [da[0].name, da[1].name, da[2].mapName, da[3].mapName]
      : da.name;
  }

  //----------------------------------------------------------------------------


  /** This is equivalent to o[ak].
   * Whereas o[] keys are only axisIDs, this function handles block IDs.
   *
   * Where the feature d is in a child data block, featureY_(ak, d) requires
   * the block id not the id of the axis which contains the block.  So
   * functions which use featureY_() also use blockO().
   *
   * o[] contains x Offsets; the o may also have abbreviated Original, because
   * it caches axis positions.  Blocko can be renamed when axes are split out;
   * it is reminiscent of a bloco - a Carnival block party
   * (https://en.wikipedia.org/wiki/Carnival_block)
   *
   * @param ak  axis-1d
   */
  function blockO(ak)
  {
    let axis = ak;
    const o = axis.scaledX;
    return o;
  }

  /** A line between a feature's location in adjacent Axes.
   * @param ak1, ak2 axis-1d
   * @param d feature
   * Replaced by the stacks equivalent : @see featureLineS2()
   */
  function featureLine2(ak1, ak2, d)
  {
    let
    /** use blockO() in place of o[] lookup to handle ak1,2 being child blocks */
    ends = [ak1, ak2].map(function (ak) {
      return [blockO(ak), featureY_(ak, d)]; });
    return line(ends);
  }
  /**  Return the x positions of the given axes; if the leftmost is split, add
   *  its width to the corresponding returned axis position.
   * The purpose is to give the x positions which paths between the 2 axes
   * should terminate at, hence the name 'inside' - it is concerned with the
   * inside edges of the axes from the perspective of the space between them.
   * @param ak1, ak2  axis-1d
   * @param cached  true means use the "old" / cached positions o[ak], otherwise use the current scale x(ak).
   * @return 2 x-positions, in an array, in the given order (ak1, ak2).
   */
  function inside(ak1, ak2, cached)
  {
    const
    o = oa.o,
    x = stacks.x,
    axes = [ak1, ak2];
    let xi = cached
        ? axes.mapBy('scaledX')
        : axes.map(x),
    /** true if ak1 is left of ak2 */
    order = xi[0] < xi[1],
    /** If the rightmost axis is split it does not affect the endpoint, since its left side is the axis position.
     * This is the index of the left axis. */
    left = order ? 0 : 1,
    aL = axes[left];
    if (aL.extended)
    {
      // console.log("inside", ak1, ak2, cached, xi, order, left, akL);
      xi[left] += aL.extendedWidth();
    }
    return xi;
  }
  /** @return a short line segment, length approx 1, around the given point.
   * @param point array with indexes 0, 1 for x, y.
   */
  function pointSegment(point)
  {
    let  floor = Math.floor, ceil = Math.ceil,
    s = [[floor(point[0]), floor(point[1])],
             [ceil(point[0]), ceil(point[1])]];
    if (s[0][0] == s[1][0])
      s[1][0] += 1;
    if (s[0][1] == s[1][1])
      s[1][1] += 1;
    return s;
  }
  /** Stacks version of featureLine2().
   * A line between a feature's location in Axes in adjacent Stacks.
   * @param ak1, ak2 axis-1d,
   * @param d1, d2 features, i.e. ak1:d1, ak1:d1
   * If d1.name != d2.name, they are connected by an alias.
   */
  function featureLineS2(ak1, ak2, d1, d2)
  {
    const
    o = oa.o,
    vc = oa.vc,
    axis1 = ak1,
    axis2 = ak2,
    /** x endpoints of the line;  if either axis is split then the side closer the other axis is used.  */
    xi = inside(axis1, axis2
, true);
    let l;
    if (axis1.perpendicular && axis2.perpendicular)
    { /* maybe a circos plot :-) */ }
    else if (axis1.perpendicular)
    {
      let point = [xi[0] + vc.yRange/2 - featureY_(ak1, d1), featureY_(ak2, d2)];
      l =  line(pointSegment(point));
    }
    else if (axis2.perpendicular)
    {
      let point = [xi[1] + vc.yRange/2 - featureY_(ak2, d2), featureY_(ak1, d1)];
      l =  line(pointSegment(point));
    }
    else
    // o[p], the map location,
    l =  line([
      [xi[0], featureY_(ak1, d1)],
      [xi[1], featureY_(ak2, d2)]]);
    return l;
  }
  /** Show a parallelogram between 2 axes, defined by
   * 4 feature locations in Axes in adjacent Stacks.
   * Like @see featureLineS2().
   * @param ak1, ak2 axis-1d
   * @param d[0 .. 3] features, i.e. ak1:d[0] and d[1], ak2:d[2] and d[3]
   * update : d contains 2 features which define the ends of a synteny block
   * when syntenyBlock_2Feature, see comment in patham2()
   */
  function featureLineS3(ak1, ak2, d)
  {
    const
    o = oa.o,
    vc = oa.vc,
    axis1 = ak1,
    axis2 = ak2,
    xi = inside(axis1, axis2, false),
    oak = xi, // o[ak1], o[ak2]],
    my = syntenyBlock_2Feature ?
        [featureY2(ak1, d[0]), featureY2(ak2, d[2])] :
        [[featureY_(ak1, d[0]), featureY_(ak1, d[1])],
          [featureY_(ak2, d[2]), featureY_(ak2, d[3])]];
    let sLine;

    /** if one of the axes is perpendicular, draw a line segment using the d
     * values of the perpendicular axes as the x values, and the other as the
     * y values. */
    if (axis1.perpendicular && axis2.perpendicular)
    {  }
    else if (axis1.perpendicular)
    {
      xi[0] += vc.yRange/2;
      let s = [[xi[0] - my[0][0], my[1][0]],
               [xi[0] - my[0][1], my[1][1]]];
      sLine =  line(s);
    }
    else if (axis2.perpendicular)
    {
      xi[1] += vc.yRange/2;
      let s = [[xi[1] - my[1][0], my[0][0]],
               [xi[1] - my[1][1], my[0][1]]];
      sLine =  line(s);
    }
    else
    {
      let
      /** can use my here, with perhaps swapped my[1][0] and my[1][1] (because of swapped d[2] and d[3]).   */
      p = syntenyBlock_2Feature ?
        [
          [oak[0], my[0][0]],
          [oak[0], my[0][1]],
          [oak[1], my[1][1]],
          [oak[1], my[1][0]]] :
        [[oak[0], featureY_(ak1, d[0])],
         [oak[0], featureY_(ak1, d[1])],
         // order swapped in ak2 so that 2nd point of ak1 is adjacent 2nd point of ak2
         [oak[1], featureY_(ak2, d[3])],
         [oak[1], featureY_(ak2, d[2])],
        ];
      sLine = line(p) + "Z";
    }
    if (trace_synteny > 4)
      console.log("featureLineS3", ak1, ak2, d, oak, /*p,*/ sLine);
    return sLine;
  }

  /** Similar to @see featureLine().
   * Draw a horizontal notch at the feature location on the axis.
   * Used when showAll and the feature is not in a axis of an adjacent Stack.
   * @param ak axis1d
   * @param d feature name
   * @param xOffset add&subtract to x value, measured in pixels
   */
  function featureLineS(ak, d, xOffset)
  {
    let akY = featureY_(ak, d);
    let shiftRight = 9;
    const
    oak = blockO(ak);
    return line([[oak-xOffset + shiftRight, akY],
                 [oak+xOffset + shiftRight, akY]]);
  }
  /** calculate SVG line path for an horizontal line.
   *
   * Currently this is used for paths within axis group elt,
   * which is within stack elt, which has an x translation,
   * so the path x position is relative to 0.
   *
   * @param ak axis-1d.
   * @param akY Y	position (relative to axis of ak?)
   * @param xOffset add&subtract to x value, measured in pixels
   * Tick length is 2 * xOffset, centred on the axis + shiftRight.
   * @return line path for an horizontal line.
   * Derived from featureLineS(), can be used to factor it and featureLine()
   */
  function lineHoriz(ak, akY, xOffset, shiftRight)
  {
    /** scaled to axis */
    let akYs = ak.y(akY);
    /* If the path was within g.foreground, which doesn't have x translation
     * for the stack, would calculate x position :
     * o = oa.o;  x position of axis ak : o[ak]
     */
    return line([[-xOffset + shiftRight, akYs],
                 [+xOffset + shiftRight, akYs]]);
  }
  /** Similar to @see featureLine2().
   * Only used in path_pre_Stacks() which will is now discarded;
   * the apparent difference is the param xOffset, to which path_pre_Stacks()
   * passed 5.
   * @param ak blockId containing feature
   * @param d feature name
   * @param xOffset add&subtract to x value, measured in pixels
   */
  function featureLine(ak, d, xOffset)
  {
    let
    akY = featureY_(ak, d);
    let o = oa.o, oak = blockO(ak);
    return line([[oak-xOffset, akY],
                 [oak+xOffset, akY]]);
  }
  //- moved to collate-paths.js : collateMagm()

  //- paths
  /** This is the stacks equivalent of path() / zoompath().
   * Returns an array of paths (links between Axes) for a given feature.
   */
  function path(featureName) {
    let r = [];
    // TODO : discard features of the paths which change
    // pathFeatures = {};

    const flowsService = oa.eventBus.flowsService;
    /** 1 string per path segment */
    let
      ffNf = flowsService.featureAxes[featureName];
    if (ffNf !== undefined)
      /* console.log("path", featureName);
       else */
      if ((unique_1_1_mapping === 2) && (ffNf.length > 1))
    { /* console.log("path : multiple", featureName, ffNf.length, ffNf); */ }
    else
      for (let i=0; i < ffNf.length; i++)
    {
        let [featureName, a0_, a1_, za0, za1] = ffNf[i];
        let a0 = a0_.axisName, a1 = a1_.axisName;
        if ((za0 !== za1) && (a0 == a1))
          console.log("path", i, featureName, za0, za1, a0, a1);
        if (a0_.axis && a1_.axis)
        {
          let paths = patham(a0, a1, featureName, undefined);
          r.push(paths);
        }
      }
    if (trace_path > 3)
      console.log("path", featureName, ffNf, r);
    if (r.length == 0)
      r.push("");
    return r;
  }

  /** for unique paths between features, which may be connected by alias,
   * data is [feature0, feature1, a0, a1]
   * Enabled by unique_1_1_mapping.
   * @param ffaa  [feature0, feature1, a0, a1]
   * @param this  <path>
   */
  function pathU(ffaa) {
    if ((ffaa === undefined) || (ffaa.length === undefined))
    { console.log("pathU", this, ffaa); breakPoint(); }
    let [feature0, feature1, a0, a1] = ffaa;
    let p = [];
    p[0] = patham(a0.axisName, a1.axisName, feature0, feature1);
    if (trace_path > 2)
      console.log("pathU", ffaa, a0.mapName, a1.mapName, p[0]);
    return p;
  }
  /**
   * @param this  <path>
   */
  function pathUg(d) {
    let ffaa = dataOfPath(this),
    p = pathU(ffaa);
    if (trace_path > 2)
      console.log(this, d);
    return p;
  }

  /** TODO : for paths with alias group as data
   * @param aliasGroup   alias group (name)?
   */
  function pathAliasGroup(aliasGroup) {
    const
    flowsService = oa.eventBus.flowsService,
    aliasGroupAxisFeatures = flowsService.aliasGroupAxisFeatures;

    /** 1 string per path segment */
    let p = [],
    agafa = aliasGroupAxisFeatures[aliasGroup]; // to be passed from collateStacks().
    if (agafa === undefined)
      console.log("pathAliasGroup", aliasGroup);
    else
      for (let i=0; i < agafa.length; i++)
    {
        let [featureName, a0, a1, za0, za1] = agafa[i];
        p[i] = patham(a0.axisName, a1.axisName, featureName, undefined);
      }
    return p.join();
  }

  /** Calculate relative location of feature in the axis, and
   * check if it is inRange 
   * @param axis1d
   * @param feature  feature within axis1d
   * @param range e.g. [0, yRange]
   */
  function inRangeI(axis1d, feature, range)
  {
    return inRange(featureY_(axis1d, feature), range);
  }
  /** as for inRangeI(), but param is a Feature, which is an interval (i.e. .values.length === 2) 
   * @return true if the interval of the feature overlaps range.
   */
  function inRangeI2(axis1d, feature, range)
  {
    let ir = featureY2(axis1d, feature)
        .some((vi) => inRange(vi, range));
    return ir;
  }

  //- paths-text
  /** @param f  feature object reference
   * @return text for display in path hover tooltip */
  function featureAliasesText(fName, f)
  {
    let
      fas = f.aliases,
    s = fName + ":" + (fas ? f.aliases.length : "") + ":";
    if (fas)
    for (let i=0; i<fas.length; i++)
    {
      s += fas[i] + ",";
    }
    // console.log("featureAliasesText", fName, f, fas, s);
    return s;
  }

  /** Prepare a tool-tip for the line.
   * The line / path may be either connecting 2 axes, or a tick on one axis;
   * in the latter case fa1 will be undefined.
   * @param sLine svg path text
   * @param d0, d1 feature names, i.e. a0:f0 , a1:f1 .
   * Iff d1!==undefined, they are connected by an alias.
   * These params can be dropped because : fa0.name === d0 and fa1.name === d1
   * @param fa0, fa1  feature objects.
   * fa1 will be undefined when called from axisFeatureTick()
   * @param aliasDescription  undefined or text identifying the basis of the alias connection
   */
  function pathFeatureStore(sLine, d0, d1, fa0, fa1, aliasDescription)
  {
    let pathFeatures = oa.pathFeatures;
    if (pathFeatures[sLine] === undefined)
      pathFeatures[sLine] = {};

    /** Show the x,y coords of the endpoints of the path segment.  Useful during devel. */
    const showHoverLineCoords = false;
    const showHoverAliases = true;
    /** 1 signifies the normal behaviour - handleMouseOver() will show just the feature name.
     * Values other than 1 will be appended as text. */
    let hoverExtraText = showHoverExtraText ?
      " " + fa0.location +
      (fa1 ?  "-" + fa1.location : "")
      + (showHoverLineCoords ? " " + sLine : "")
    : 1;
    if (showHoverExtraText && showHoverAliases && aliasDescription)
      hoverExtraText += "<div><pre>" + aliasDescription + "</pre></div>";
    if (false)
    {
      hoverExtraText += 
        "<div>" + featureAliasesText(d0, fa0) + "</div>" +
        (d1 && fa1 ? 
         "<div>" + featureAliasesText(d1, fa1) + "</div>" : "");
    }
    // these are split (at ",") when assigned to hoverFeatures
    let d = d1 && (d1 != d0) ? d0 + "," + d1: d0;
    pathFeatures[sLine][d] = hoverExtraText; // 1;
  }

  /** Determine if the feature interval overlaps the zoomedDomain of its axis, axis1d.
   * Broadly similar to featureInRange() except it calculates in (pixel) range
   * space and does not use valueInInterval(), - see comments there also.
   *
   * @param axis1d axis-1d
   * @param feature
   * feature d0.blockId is viewed on axis1d
   */
  function featureInRange0(axis1d, feature) {
    /** To allow lines which spread onto other axes in the same stack, but
     * still remain within the stack limits, unlike allowPathsOutsideZoom, use
     * range0 = [0, vc.yRange];
     */
    /** If the block containing one end of the path is un-viewed, block.axis
     * may be undefined if render occurs before block-adj is destroyed . */
    if (! axis1d) return undefined;
    let  range0 = axis1d.yRange2();
    let ir = inRangeI(axis1d, feature, range0);
    return ir;
  }
  /** Determine if the feature interval overlaps the zoomedDomain of its axis - axis1d.
   *
   * This calculation is done in domain space, whereas featureInRange0()
   * calculates in (pixel) range space.
   *
   * This function also uses valueInInterval(), which is used by :
   *   utils/draw/axisBrush.js : axisFeatureCirclesBrushed()
   *   models/block.js : featuresInBrush()
   * This function is used by synteny-blocks-draw.js : sbZoomFilter()
   *
   * @param axis1d axis-1d
   * // draw_orig : @param  axisName ID of reference block of axis
   * @param feature ember data store object

   * feature d0.blockId is viewed on axis1d

   */
  function featureInRange(axis1d, feature) {
    const controlsView = this.controlsView;
    /** To allow lines which spread onto other axes in the same stack, but
     * still remain within the stack limits, unlike allowPathsOutsideZoom, use
     * [0, vc.yRange];
     */
    let
    /** true if in range */
    ir,
    valueInInterval = controlsView?.get('valueInInterval');
    /** If the block containing one end of the path is un-viewed, block.axis
     * may be undefined if render occurs before block-adj is destroyed . */
    if (axis1d) {
      let
      domain = axis1d.zoomedDomain;
      ir = ! domain || valueInInterval(feature.value, domain);
    }
    return ir;
  }
  /**
   * @param  a0, a1  axis-1d
   * feature d0.blockId is viewed on axis-1d a0, and similarly for d1, a1.
   * @param d0, d1 features, i.e. a0:d0, a1:d1.
   * Iff d1!==undefined, they are connected by an alias.
   */
  function patham(a0, a1, d0, d1) {
    const controlsView = this.controlsView;
    // let [stackIndex, a0, a1] = featureAliasGroupAxes[d];
    let r;

    /** if d1 is undefined, then d1.name === d0.name : direct connection, not alias. */
    let d1_ = d1 || d0;
    // can skip the inRangeLR[] calc if allowPathsOutsideZoom.
    /** Filter out those paths that either side locates out of the svg.
     * Currently using featureInRange0() which was named featureNameInRange;
     * changing this to use featureInRange() would include the valueInInterval()
     * functionality added firstly for synteny blocks but also perhaps
     * applicable here.
     */
    let
        inRangeLR = 
          [featureInRange0(a0, d0),
           featureInRange0(a1, d1_)],

      lineIn = controlsView?.get('allowPathsOutsideZoom') ||
          (inRangeLR[0]
           && inRangeLR[1]);
    // console.log("path()", stackIndex, a0, allowPathsOutsideZoom, inRangeI(a0), inRangeI(a1), lineIn);
    if (lineIn)
    {
      let sLine = featureLineS2(a0, a1, d0, d1_);
      let feature0 = d0, feature1 = d1,
      /** used for targeted debug trace (to filter, reduce volume)
       * e.g. = feature0.name == "featureK" && feature1.name == "featureK" &&
       a0.mapName == "MyMap5" && a1.mapName == "MyMap6"; */
      traceTarget = 
        ((trace_path_count !== undefined) && (trace_path_count-- > 0))
         || (trace_path > 4);
      if (traceTarget)
        console.log("patham()", d0, d1, a0.mapName, a1.mapName, a0, a1, d0.value, d1.value, sLine);
      r = sLine;
      if (pathDataIsLine)
        /* Prepare a tool-tip for the line. */
        pathFeatureStore(sLine, d0.name, d1.name, d0, d1_);
    }
    // equivalent : ! controlsView.allowPathsOutsideZoom
    else if (controlsView?.get('tickOrPath') === 'tick') {
      // tickOrPath replaces oa.drawOptions.showAll
      const featureTickLen = 10; // orig 5
      function axisFeatureTick(ai, d) {
        if (d.blockId.get('view.axis1d') === ai)
        {
          r = featureLineS(ai, d, featureTickLen);
          pathFeatureStore(r, d.name, d.name, d, undefined);
        }
      }
      // Filter these according to inRangeI() as above : return 0 or 1 ticks, not 2 because at least one is out of range.
        if (inRangeLR[0])
            axisFeatureTick(a0, d0);
        if (inRangeLR[1])
            axisFeatureTick(a1, d1_);
    }
    return r;
  }
  /** patham() draws a line (1-d object),  patham2 draws a parallelogram (2-d object).
   * @param  a0, a1  axis-1d
   * @param d[0 .. 3], features, i.e. a0:d[0]-d[1], a1:d[2]-d[3].
   * Unlike patham(), d does not contain undefined.
   * added : for syntenyBlock_2Feature, d is [d0, undefined, d2, undefined]
   * i.e. features d0 and d2 are intervals not points.
   */
  function patham2(a0, a1, d) {
    const
    vc = oa.vc,
    me = oa.eventBus;
    let r;
    let range = [0, vc.yRange];

    /** Filter out those parallelograms which are wholly outside the svg, because of zooming on either end axis. */
    let
    lineIn = me.get('allowPathsOutsideZoom') ||
      (syntenyBlock_2Feature ?
       inRangeI2(a0, d[0], range) ||
       inRangeI2(a1, d[2], range) : 
      (inRangeI(a0, d[0], range)
       || inRangeI(a0, d[1], range)
       || inRangeI(a1, d[2], range)
       || inRangeI(a1, d[3], range)));
    if (lineIn)
    {
      let sLine = featureLineS3(a0, a1, d);
      let cmName = oa.cmName;
      if (trace_synteny > 4)
        console.log(
          "patham2()", d, a0.mapName, a1.mapName, a0, a1,
          d[0] /* ?.value*/,
          d[2] /* ?.value*/, sLine);
      r = sLine;
    }
    /* for showAll, perhaps change the lineIn condition : if one end is wholly
     * in and the other wholly out then show an open square bracket on the
     * axis which is in. */

    return r;
  }

  /** Calculate relative feature location in the axis.
   * Result Y is relative to the stack, not the axis,
   * because .foreground does not have the axis transform (Axes which are ends
   * of path will have different Y translations).
   *
   * @param axis1d axis
   * This parameter is the difference with the original featureY() which this function replaces.
   * @param d feature
   * feature.blockId is viewed on axis1d
   */
  function featureY_(axis1d, d)
  {
    const flowsService = oa.eventBus.flowsService;
    // f.value, actual position of feature f in the axis, 
    // y[p](f.value) is the relative feature position in the svg
    // ys is used - the y scale for the stacked position&portion of the axis.
    const
    ysa = axis1d.ys,
    feature = d,
    aky = ysa(feature.location),
    /**  As noted in header comment, path Y value requires adding axisY = ... yOffset().
     */
    axisY = axis1d.yOffset();
    // can use parentName here, but initially good to have parent and child traced.
    const axisID = axis1d.axisName;
    if (trace_scale_y && ! tracedAxisScale[axisID])
    {
      tracedAxisScale[axisID] = true;
      let yDomain = ysa.domain();
      const axisChrName = AxisChrName(oa);
      const parentName = axis1d.mapName;
      console.log("featureY_", axisID,  feature.get('blockId.mapName'), parentName, d,
                    d.location, aky, axisY, yDomain, ysa.range());
    }
    return aky + axisY;
  }
  /** as for featureY_(), but param is a Feature, with value.length === 2.
   * @param axis1d
   * @param feature
   * @return [start,end]  feature interval Y relative to the stack.
   */
  function featureY2(axis1d, feature)
  {
    const
    ysa = axis1d.ys,
    v = feature.value,
    aky = v.map((location) => ysa(location)),
    axisY = axis1d.yOffset();

    return aky.map((y) => y + axisY);
  }


  //- paths
  function log_path_data(g)
  {
    let p3 = g.selectAll("g").selectAll("path");  // equiv : g.selectAll("g > path")
    console.log(p3._groups.length && p3._groups[0][0].__data__);
  }

  /** Update the paths connecting features present in adjacent stacks.
   * @param t undefined, or a d3 transition in which to perform the update.
   * @param flow  configures the data sources, processing, and output presentation
   */
  function pathUpdate_(t, flow)
  {
    const pathInfo = PathInfo(oa);
    let pathData = flow.pathData,
    unique_1_1_mapping = flow.direct ? false : (flow.unique ? true : 3),
    // pathDataInG = true,
    pathClass = flow.direct ? I : pathClassA;
    // "exported" to patham().
    pathDataIsLine = flow.direct;
    // console.log("pathUpdate");
    tracedAxisScale = {};  // re-enable trace, @see trace_scale_y
    /** flow.g may not be rendered yet; could use an empty selection in place
     * of flow.g, but flow.g is used several times here. */
    let flow_g = flow.gf;
    if (! flow_g) return;
    let g = flow_g ? flow_g.selectAll("g") :  d3.selectAll();
    let gn;
    /* if (unique_1_1_mapping)
     {*/
    if (trace_path)
      console.log("pathUpdate() pathData", flow.name, pathData.length, g.size()); // , pathData
    if (trace_path > 2)
      for (let pi=0; pi < pathData.length; pi++)
        log_ffaa(pathData[pi]);
    g = g.data(pathData);
    if (trace_path)
      console.log("exit", g.exit().size(), "enter", g.enter().size());
    if (trace_path && pathData.length === 0)
    {
      console.log("pathData.length === 0");
    }
    g.exit().remove();
    function log_foreground_g(selector)
    {
      let gg = oa.foreground.selectAll(selector);
      console.log("gg", selector, (trace_path > 2) ? gg._groups[0] : gg.node(), gg.size());
      if (trace_path > 2)
      {
        let gg0 = gg._groups[0];
        for (let gi=0; (gi < gg0.length) && (gi < 10); gi++)
        {
          log_ffaa(gg0[gi].__data__);
          console.log(gg0[gi]);
        }
      }
    }
    gn = g.enter().append("g");
    // insert data into path elements (each line of the "map" is a path)
    let pa;
    if (flow.direct)
    {
      if (trace_path)
        console.log(flow.name, gn.size(), gn);
      // pa = gn.append("path");
      // log_path_data(flow_g);
      let p2 = flow_g.selectAll("g").selectAll("path").data(path);
      // log_path_data(flow_g);
      // pa = g.selectAll("path").data(path)
      pa = p2.enter().append("path");
      let p2x = p2.exit();
      if (! p2x.empty())
      {
        console.log("pathUpdate_", "p2x", p2x._groups[0]);
        p2x.remove();
      }

    }
    else
    {
      pa =
        gn.append("path");
      let gx = g.exit();
      if (! gx.empty())
      {
        console.log("pathUpdate_", "gx", gx._groups[0]);
        gx.remove();
      }
      if (! pathDataInG)
        g.selectAll("path").data(pathData);
    }
    if (trace_path > 1)
      log_foreground_g("g." + flow.name + " > g > path");
    (pathDataInG ? gn : pa)
    //.merge()
      .attr("class", pathClass);
    //}
    // trace_path_count = 10;
    let
      path_ = unique_1_1_mapping ? (pathDataInG ? pathUg : pathU) : path,
    /** The data of g is feature name, data of path is SVG path string. */
    keyFn =function(d) { let featureName = featureNameOfPath(this); 
                         console.log("keyFn", d, 'parent', this, featureName); 
                         return featureName; };
    /* The ffaa data of path's parent g is accessed from path attribute
     * functions (i.e. style(stroke), classed(reSelected), gKeyFn(), d, etc.);
     * alternately it could be stored in the path's datum and accessed
     * directly.  This would be needed if there were multiple path's within a
     * g elt.  There is incomplete draft of this (changing the data of path to
     * ffaa) in branch devel-path-data),
     *
     * Here the SVG line string is calculated by path_ from the parent g data,
     * and the attr d function is identity (I) to copy the path datum.
     */
    if (false)
    {
      let gd = /*g.selectAll("path")*/gn/*pa*/.data(path_/*, keyFn*/);
      let en = gd.enter();
      if (trace_stack > 1)
      {
        let ex = gd.exit();
        if (ex.size())
          console.log("gd.exit()", ex);
        if (en.size())
          console.log("gd.enter()", en);
      }
      gd.exit().remove();
    }
    if (trace_path && pathData.length > 0 &&  g.size() === 0)
    {
      console.log("pathUpdate", pathData.length, g.size(), gn.enter().size(), t);
    }
    let gp;
    if ((trace_path > 1) && (pathData.length != (gp = d3.selectAll(".foreground > g." + flow.name + " > g > path")).size()))
    {
      console.log("pathData.length", pathData.length, "!= gp.size()", gp.size());
    }

    // .merge() ...
    if (true)
    {
      /** attr d function has not changed, but the data has.
       * even where the datum is the same, the axes may have moved.
       * So update all paths.
       */
      let t1= (t === undefined) ? oa.foreground.select(" g." + flow.name)  : flow_g.transition(t),
      p1 = t1.selectAll("g > path"); // pa
      p1.attr("d", pathDataIsLine ? I : path_);
      if (trace_path > 3)
      {
        console.log(t1.nodes(), t1.node(), p1.nodes(), p1.node());
        log_path_data(flow_g);
      }
      pathInfo.setupMouseHover(pa);
    }
    else
    {
      if (t === undefined) {t = d3; }
      t.selectAll(".foreground > g." + flow.name + "> g > path").attr("d", function(d) { return d; });
      pathInfo.setupMouseHover(
        flow_g.selectAll("g > path")
      );
    }
    const pathClasses = pathClasses(oa);
    pathClasses.pathColourUpdate(pa, flow);
  }
  const eventBus = oa.eventBus;
  if (! eventBus.pathUpdateFlow)
  {
    /** Call pathUpdate_().  Used for calls from collate-paths.
     * @param t transition, which is likely to be undefined here.
     */
    eventBus.pathUpdateFlow = function(t, flow) {
      const controlsView = this.controlsView;
      if (controlsView?.get('pathJoinClient'))
        pathUpdate_(t, flow);
    };
    eventBus.on('pathUpdateFlow', eventBus, eventBus.pathUpdateFlow);
  }

  /** call pathUpdate(t) for each of the enabled flows. */
  function pathUpdate(t)
  {
    const controlsView = this.controlsView;
    const flows = oa.flows;
    if (controlsView?.get('pathJoinClient'))
    d3.keys(flows).forEach(function(flowName) {
      let flow = flows[flowName];
      if (flow.enabled)
        pathUpdate_(t, flow);
    });
  }
  //- paths-classes
  /** Get the data corresponding to a path element, from its datum or its parent element's datum.
   * In the case of using aliases, the parent g's data is [f, f, axis, axis, ...] "ffaa".
   */
  function dataOfPath(path)
  {
    let pa = pathDataInG
      ? path.parentElement || path._parent /* EnterNode has _parent not parentElement */
      : path,
    da = pa.__data__;
    return da;
  }
  /** Get the featureName of a path element, from its corresponding data accessed via dataOfPath().
   */
  function featureNameOfPath(path)
  {
    let da = dataOfPath(path),
    featureName = featureNameOfData(da);
    return featureName;
  }


  return result;
}

//------------------------------------------------------------------------------

export {
  PathDataUtils,
};

