import { isEqual } from 'lodash/lang';

//------------------------------------------------------------------------------

import {
  axisId2Name,
} from '../stacks';

import {
  isAdjacent
} from '../stacks-adj';

import { configureSyntenyBlockClicks } from '../../components/draw/synteny-blocks';

import { configureHover } from '../hover';

import { PathDataUtils } from './path-data';

//------------------------------------------------------------------------------

/** true means syntenyBlock is defined by 2 features instead of 4 feature names.
 *   true : chr1 chr2 g1 undefined g3 undefined id size
 *   false : chr1 chr2 g1 g2 g3 g4 id size
 * This can be based on path.feature[].blockId.isSyntenyBlock
 */
const syntenyBlock_2Feature = true;

//------------------------------------------------------------------------------

const trace_synteny = 1;

const dLog = console.debug;

//------------------------------------------------------------------------------

/** Draw  synteny blocks between adjacent axes.
 *
 * Uses isAdjacent(), which uses adjAxes[], calculated in
 * collateAdjacentAxes(), called via flows.alias : collateStacksA()
 *
 * @param t transition or undefined
 */
function showSynteny(syntenyBlocks, t, oa)
{
  const me = oa.eventBus;
  const axisApi = oa.axisApi;
  const pathDataUtils = PathDataUtils(oa);

  /** indexes into the columns of syntenyBlocks[]
   * 0,1 : chr0, chr1
   * 2,3,4,5 : gene 1,2,3,4
   */
  const SB_ID = 6, SB_SIZE = 7;
  let allowPathsOutsideZoom = me.get('controls.view.allowPathsOutsideZoom');

  let sbS=oa.svgContainer.selectAll("g.synteny")
    .data(["synteny"]), // datum could be used for class, etc
  sbE = sbS.enter()
    .append("g")
    .attr("class", "synteny"),
  sbM = sbE.merge(sbS);
  if (trace_synteny)
    dLog("showSynteny", sbS.size(), sbE.size(), sbM.size(), sbM.node());

  function sbFeatures(sb) {
    /** assumes syntenyBlock_2Feature */
    const features = [sb[2], sb[4]];
    return features;
  }
  /** Use the features in sb[] to lookup the corresponding axis-1d-s.
   * If one of the feature's blocks are unviewed, the corresponding axis will be undefined.
   */
  function sbAxes(sb) {
    const axes = sbFeatures(sb).map((feature) => feature.get('blockId.axis1d'));
    return axes;
  }
  function sbBlockIds(sb) {
    const featureBlocks = sbFeatures(sb).map(feature => feature.get('blockId.id'));
    if (trace_synteny) { // verify
      /** sb[0] and sb[1] are the data blockIds of the features */
      if (! isEqual([sb[0], sb[1]], featureBlocks)) {
        dLog('sbAxes', 'mismatch', sb, featureBlocks);
      }
    }
    return featureBlocks;
  }

  function sbChrAreAdjacent(sb) {
    const
    a0 = sb[0], a1 = sb[1],
    /** Using this equivalent allows blockIds to be dropped from sb[] :
     [a0, a1] = sbBlockIds(sb),
     */
    /** if one of the blocks are unviewed, showSynteny() will be called before
     * the synteny blocks between those blocks is removed from syntenyBlocks[].
     */
    adj = a0 && a1 &&
      (isAdjacent(a0, a1) || isAdjacent(a1, a0));
    return adj;
  }
  const sbSizeThreshold = me.get('sbSizeThreshold');
  function sbSizeFilter(sb) {
    return sb[SB_SIZE] > sbSizeThreshold;
  }
  function sbZoomFilter(sb) {
    const
    axes = sbAxes(sb),
    /** featureInRange() uses valueInInterval(), which depends on
     * featureIntervalOverlap and featureIntervalContain : the latter is true by
     * default and indicates that when zoomed inside the interval of a feature,
     * such as a synteny block which are easy to zoom into because they may be
     * the whole axis, a path connecting that feature will still be displayed.
     */
    inRangeLR = [[0, 2], [1, 4]]
      .map(([chrI, featureI]) => pathDataUtils.featureInRange(axes[chrI], sb[featureI])),
    inCount = inRangeLR.reduce((sum, flag) => sum += flag ? 1 : 0),
    lineIn = inCount >= (allowPathsOutsideZoom ? 1 : 2);
    return lineIn;
  }
  let adjSynteny = syntenyBlocks.filter(sbChrAreAdjacent)
    .filter(sbSizeFilter);
  if (oa.drawOptions.showAll) {
    adjSynteny = adjSynteny
      .filter(sbZoomFilter);
  }

  function blockLine (s) {
    const
    // blockIds = [s[0], s[1]],
    axes = sbAxes(s),
    sLine = pathDataUtils.patham2(axes[0], axes[1], s.slice(2));
    if (trace_synteny > 3)
    dLog("blockLine", s, sLine);
    return sLine;
  }

  /** @return array [start, end]  */
  const f2Value = syntenyBlock_2Feature ?
        (f) => f.get('value') :
        (f0, f1) => [f0, f1].map((f) => f.location);
  function intervalIsInverted(interval)
  {
    // could use featureY_(a, d0), if flipping is implemented via scale
    let inverted = interval[0] > interval[1];
    if (trace_synteny > 3)
      dLog("intervalIsInverted", interval, inverted);
    return inverted;
  }
  function syntenyIsInverted(s) {
    const
    /** if syntenyBlock_2Feature, [s[2], s[3]] is [start feature, undefined]
     * otherwise it is [start feature, end feature];
     * and similarly for s[4], s[5].
     */
    inverted = intervalIsInverted(f2Value(s[2], s[3]))
      != intervalIsInverted(f2Value(s[4], s[5]));
    if (trace_synteny > 3)
      dLog("syntenyIsInverted", s, inverted);
    return inverted;
  }

  function  syntenyBlockHoverText(sb)
  {
    let j=0, text = axisId2Name(sb[j++]) + "\n" + axisId2Name(sb[j++]);
    if (syntenyBlock_2Feature) {
      for (let fi = 0; fi++ < 2; ) {
        /** skip undefined following feature. */
        let f = sb[j];  j += 2;
        //  f.name is added as sb[SB_ID] (6)
        text += '\n' + f.value;
      }
    }
    for ( ; j < sb.length; j++) text += "\n" + sb[j];
    dLog("syntenyBlockHoverText", sb, text);
    return text;
  };
  function configureSyntenyBlockHover(sb)
  {
    configureHover.apply(this, [sb, syntenyBlockHoverText]);
  }

  function sbKeyFn(sb) {
    return sb[SB_ID];
  }

    let pS = sbM.selectAll("path.syntenyEdge")
      .data(adjSynteny, sbKeyFn),
    pSE = pS.enter()
      .append("path")
      .attr("class", "syntenyEdge")
      .classed("inverted", syntenyIsInverted)
      .each(configureSyntenyBlockHover)
      .call(configureSyntenyBlockClicks),
  pSX = pS.exit(),
    pSM = pSE.merge(pS)
      .attr("d", blockLine);
  pSX.remove();
  if (trace_synteny > 1)
    dLog("showSynteny", oa.syntenyBlocks.length, sbSizeThreshold, adjSynteny.length, pS.size(), pSE.size(), pSX.size(), pSM.size(), pSM.node());
  if (trace_synteny > 2)
    dLog(pSM._groups[0]);

} // showSynteny()

//------------------------------------------------------------------------------

export {
  syntenyBlock_2Feature,
  showSynteny,
};

//------------------------------------------------------------------------------
