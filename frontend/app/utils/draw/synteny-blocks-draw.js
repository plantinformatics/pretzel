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

  /** indexes into the columns of syntenyBlocks[]
   * 0,1 : chr0, chr1
   * 2,3,4,5 : gene 1,2,3,4
   */
  const SB_ID = 6, SB_SIZE = 7;
  let allowPathsOutsideZoom = me.get('allowPathsOutsideZoom');

  let sbS=oa.svgContainer.selectAll("g.synteny")
    .data(["synteny"]), // datum could be used for class, etc
  sbE = sbS.enter()
    .append("g")
    .attr("class", "synteny"),
  sbM = sbE.merge(sbS);
  if (trace_synteny)
    dLog("showSynteny", sbS.size(), sbE.size(), sbM.size(), sbM.node());

  function sbChrAreAdjacent(sb) {
    let a0 = sb[0], a1 = sb[1], adj = isAdjacent(a0, a1) || isAdjacent(a1, a0);
    return adj;
  }
  const sbSizeThreshold = me.get('sbSizeThreshold');
  function sbSizeFilter(sb) {
    return sb[SB_SIZE] > sbSizeThreshold;
  }
  function sbZoomFilter(sb) {
    let 
      inRangeLR = [[0, 2], [1, 4]]
      .map(([chrI, featureI]) => axisApi.featureInRange(sb[chrI], sb[featureI])),
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
    const pathDataUtils = PathDataUtils(oa);
    let sLine = pathDataUtils.patham2(s[0], s[1], s.slice(2));
    if (trace_synteny > 3)
    dLog("blockLine", s, sLine);
    return sLine;
  }

  /** @return array [start, end]  */
  const f2Value = syntenyBlock_2Feature ?
        (blockId, f) => f.get('value') :
        (blockId, f0Name, f1Name) => [f0Name, f1Name].map((fName) => oa.z[blockId][fName].location);
  function intervalIsInverted(interval)
  {
    // could use featureY_(a, d0), if flipping is implemented via scale
    let inverted = interval[0] > interval[1];
    if (trace_synteny > 3)
      dLog("intervalIsInverted", interval, inverted);
    return inverted;
  }
  function syntenyIsInverted(s) {
    let
    /** if syntenyBlock_2Feature, [s[2], s[3]] is [start feature, undefined]
     * otherwise it is [start feature name, end feature name];
     * and similarly for s[4], s[5].
     */
    inverted = intervalIsInverted(f2Value(s[0], s[2], s[3]))
      != intervalIsInverted(f2Value(s[1], s[4], s[5]));
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
