import { isEqual } from 'lodash/lang';
import groupBy from 'lodash/groupBy';

import createIntervalTree from 'interval-tree-1d';

import {
  intervalOverlap,
  intervalJoin,
  intervalSubtract2,
} from '../interval-calcs';
import { inInterval } from './interval-overlap';
import { inRange, subInterval, overlapInterval, intervalSign } from './zoomPanCalcs';
import { featureCountDataProperties } from '../data-types';

const dLog = console.debug;


function featuresCountsResultsCheckOverlap(fcr1, fcr2) {
  let o = intervalOverlap([fcr1.domain, fcr2.domain]),
      fcr1O = featuresCountsResultsFilter(fcr1, o),
      fcr2O = featuresCountsResultsFilter(fcr2, o),
      same = isEqual(fcr1O, fcr2O);
  if (! same) {
    dLog('featuresCountsResultsCheckOverlap', same, fcr1, fcr2, o, fcr1O, fcr2O);
  }
  return same;
}

/** The two given featuresCountsResults overlap; merge them.
 * If one contains the other, then discard the sub-interval,
 * otherwise ap/pre -pend to fcr1 the part of fcr2 which is outside of fcr1.
 * @return the larger or combined featuresCountsResult
 */
function featuresCountsResultsMerge(fcr1, fcr2) {
  let fcr;
  if (subInterval(fcr1.domain, fcr2.domain)) {
    fcr = fcr2;
  } else if (subInterval(fcr2.domain, fcr1.domain)) {
    fcr = fcr1;
  } else {
    let
    addInterval = intervalJoin('subtract', fcr2.domain, fcr1.domain),
    add = featuresCountsResultsFilter(fcr2, addInterval);
    fcr = fcr1;
    fcr.result = featuresCountsResultsConcat(fcr.result, add.result);
    // this doesn't count the empty bins in fcr2 / add
    fcr.nBins += add.result.length;
    fcr.domain = intervalJoin('union', fcr1.domain, fcr2.domain);
  }
  dLog('featuresCountsResultsMerge', fcr, fcr1, fcr2);
  return fcr;
}
/** concat() two featuresCountsResult .result[] arrays, preserving ._id order.
 */
function featuresCountsResultsConcat(r1, r2) {
  let r;
  if (r1[r1.length-1]._id < r2[0]._id) {
    r = r1.concat(r2);
  } else if (r2[r2.length-1]._id < r1[0]._id) {
    r = r2.concat(r1);
  } else {
    // ignore order - just concat.
    dLog('featuresCountsResultsConcat', r1[0], r1[r1.length-1], r2[0], r2[r2.length-1], r1, r2);
    r = r1.concat(r2);
  }
  return r;
}


/** Copy a featuresCountsResult, within the given domain.
 * @return a copy of fcResult, with results outside of domain filtered out.
 */
function featuresCountsResultsFilter(fcResult, domain) {
  let {...out} = fcResult;
  resultFilter(out, domain);
  out.domain = domain;
  dLog('featuresCountsResultsFilter', out, fcResult, domain);
  return out;
}
function resultFilter(out, domain) {
  /* if needed could also support featureCountAutoDataProperties   */
  let datum2Location = featureCountDataProperties.datum2Location;
  out.result = out.result.filter(
    (fc) => !!intervalOverlap([datum2Location(fc), domain]));
      // overlapInterval() allows ===
  out.nBins = out.result.length;
}


/** Truncate excess decimal places in fcResult.result[*]._id
 * If result[].idWidth < 1 then ._id often has alias error
 * e.g. {_id: 49.20000000000024, count: 1, idWidth: [0.2]}
 *
 * This impacts on comparison isEqual() done by
 * featuresCountsResultsCheckOverlap(), which is purely for
 * development verification, and otherwise doesn't matter.
 *
 * @param fcResult  fcResult.result[*]._id is mutated in situ.
 */
function featuresCountsResultsTidy(fcResult) {
  let result = fcResult.result;
  if (result[result.length-1] === undefined) {
    result.pop();
  }

  result.forEach((r) => {
    // this assumes featureCountDataProperties, not featureCountAutoDataProperties.
    if (r.idWidth < 1) { r._id = Math.round(r._id  / r.idWidth) * r.idWidth; }
  });
}
/*----------------------------------------------------------------------------*/

/** The given featuresCountsResults selectedResults have been selected
 * by their coverage of a given interval (e.g. zoomedDomain), and by
 * their binSize being suited for display at the current scale.
 * Adjacent or overlapping results with the same binSize have been
 * merged using featuresCountsResultsMerge(), so for a given binSize,
 * results in selectedResults do not overlap.
 * For different binSizes, they are likely to overlap and may have
 * gaps in covering the domain.
 *
 * This function selects sections of these results; the return
 * featuresCountsResult contains results whose bins join exactly with
 * no overlap, and no gap if none was present in the input.
 * Results with smaller binSize (higher resolution) are preferred.
 *

Rough design notes
 * (from early Mar11)

. starting from result of featuresCountsInZoom()
. group into layers by binSize
. start with the layer with smallest binSize (only those large enough to display are chosen by featuresCountsInZoom())
 . accept all of these; set .join = .domain; add them to interval tree
. for each subsequent layer :
 . subtract all previous (smaller) layers from results, this defines .join at an end where subtraction limits the result
   . for each result in layer : for each end : search for overlapping results in interval tree
 . this may split results into multiple pieces; add a function in featuresCountsResults.js, using
 added operation 'subtract2' to intervalJoin( ), for this specific internal use, not public api.
 . for edges which are not cut, set .join = .domain
 . at the subtraction edge : set .join to the cut point, calculate .rounded :
   . on the result being added (larger binSize) : round outwards by .binSize
   . on the result already accepted (smaller binSize) : round inwards by .binSize of the result being added.
. after the above : all results have .join set at both ends, and possibly .rounded
  . where .rounded is not set, set it to .join
. all results have .rounded and are non-overlapping
. slice each result : removing bins at each end which are outside .rounded


 * @param selectedResults array of featuresCountsResults, which have the form e.g.
 *  {binSize: 200000, nBins: 100, domain: Array(2), result: Array(90)} 
 * .result is an array of feature counts : e.g. {_id: 8500000, count: 131, idWidth: Array(1)}
 * .idWidth[0] is binSize.
 *
 * This assumes the result type is featureCountDataProperties, not featureCountAutoDataProperties.
 * It would be easy to add an _id lookup function to featureCount{,Auto}DataProperties,
 * but bucketauto would not suit the current requirements, and using defined boundaries does.
 */

function featuresCountsResultsSansOverlap (selectedResults) {
  if (! selectedResults || ! selectedResults.length)
    return;

  /** group into layers by binSize */
  let binSize2fcrs = groupBy(selectedResults, 'binSize');

  let
  /** createIntervalTree() handles just the interval, so map from that to the FCR */
  domain2Fcr = new WeakMap();
  selectedResults.forEach((fcr) => domain2Fcr.set(fcr.domain, fcr));

  /** .join[] and .rounded[] are parallel to .domain[], i.e. [start, end].
   * When end `i` is cut, .join[i] is set, and .rounded[i] is
   * calculated from that by rounding by the binSize of the shadowing
   * fcr.
   * Dropping .join because it is not needed, and it introduces
   * the complication of using  .join[i] || .domain[i] 
   */
  selectedResults.forEach((fcr) => { fcr.rounded = []; /*fcr.join = [];*/ });


  /** start with the layer with smallest binSize (only those large
   * enough to display are chosen by selectFeaturesCountsResults())
   * accept all of these; set .join = .domain; add them to interval tree
   */
  let 
  binSizes = Object.keys(binSize2fcrs).sort(),
  smallestBinSize = binSizes.shift(),
  firstLayer = binSize2fcrs[smallestBinSize],
  intervalTree = createIntervalTree(firstLayer.mapBy('domain'));
  // firstLayer.forEach((fcr) => fcr.join = fcr.domain);
  /** fcr-s created by subtracting a sub-interval */
  let addedFcr = [];

/*
. for each subsequent layer :
 . subtract all previous (smaller) layers from results, this defines .join at an end where subtraction limits the result
   . for each result in layer : for each end : search for overlapping results in interval tree
 . this may split results into multiple pieces; add a function in featuresCountsResults.js, using
  added operation 'subtract2' to intervalJoin( ), for this specific internal use, not public api.
    */
  binSizes.forEach((binSize) => {
    let fcrs = binSize2fcrs[binSize];
    fcrs.forEach(subtractAccepted);
  });

  function subtractAccepted(fcr) {
    let addedFcrLocal = [];
        let [lo, hi] = fcr.domain;
        intervalTree.queryInterval(lo, hi, function(interval) {
          /* fcr.domain may be cut by multiple matching intervals.
           */
          if (subInterval(fcr.domain, interval)) {
            // fcr is already covered by interval
          } else if (subInterval(interval, fcr.domain)) {
            let
            outer = intervalSubtract2(fcr.domain, interval);
            fcr.domain = outer[0];
            domain2Fcr.set(fcr.domain, fcr);
            let {...fcr2} = fcr;
            fcr2.domain = outer[1];
            // copy because it will have different values to fcr.
            fcr2.rounded = fcr2.rounded.slice();
            // copy because it may be used to lookup domain2Fcr.
            fcr2.domain = fcr2.domain.slice();
            domain2Fcr.set(fcr2.domain, fcr2);
            addedFcrLocal.push(fcr2);
            addedFcr.push(fcr2);
            cutEdge(fcr, interval, 1);
            cutEdge(fcr2, interval, 0);
          } else {
            fcr.domain = intervalJoin('subtract', fcr.domain, interval);
            domain2Fcr.set(fcr.domain, fcr);

            /**  edge of fcr cut by interval is fcr.domain[ci] */
            let ci = fcr.domain.findIndex((d) => inRange(d, interval));
            cutEdge(fcr, interval, ci);
          }
        });
      /* for edges which are not cut, set .join = .domain
      fcr.domain.forEach((d, i) => {
        if (fcr.join[i] === undefined) { fcr.join[i] = d; }});
        */
      intervalTree.insert(fcr.domain);
      addedFcrLocal.forEach((fcr) => subtractAccepted(fcr));
    }


  /** fcr (i1) is cut by i2 at i2[+!edge].
   * Round the edge.
   *
   * For featuresCountsResults, direction is true (positive) because
   * it is determined by the block domain, which is positive; some of
   * this code handles direction variation, but there seems no point
   * in making that complete.
   */
  function cutEdge(fcr, i2, edge) {
    /*
 . at the subtraction edge : set .join to the cut point, calculate .rounded :
   . on the result being added (larger binSize) : round outwards by .binSize
   . on the result already accepted (smaller binSize) : round inwards by .binSize of the result being added.
*/
    let
    fcr2 = domain2Fcr.get(i2);
    /*if ((fcr.rounded[+!edge] !== undefined) || (fcr2.rounded[edge] !== undefined)) {
      dLog('cutEdge', fcr, i2, edge);
    } else*/ {
      // fcr.domain[edge] has been limited at i2[+!edge]
      featuresCountsResultsRound(fcr, edge, true, fcr.binSize);
      featuresCountsResultsRound(fcr2, +!edge, false, fcr.binSize);
    }
  }

  /*
  . after the above : all results have .join set at both ends, and possibly .rounded
    . where .rounded is not set, set it to .join
  . all results have .rounded and are non-overlapping
  */
  let withAdded = selectedResults.concat(addedFcr);
  withAdded.forEach((fcr) => {
    fcr.domain.forEach((r, i) => (fcr.rounded[i] ||= fcr.domain[i])); 
  });

  /*
  . slice each result : removing bins at each end which are outside .rounded
  */
  withAdded.forEach((fcr) => {
    resultFilter(fcr, fcr.rounded);
  });

  /* Result is single-layer - no overlapping featuresCountsResults. */
  let single = withAdded;

  dLog('featuresCountsResultsSansOverlap', single, selectedResults, binSizes);
  return single;
}


/** Round one edge of fcr (fcr.domain[edge]) by binSize.
 */
function featuresCountsResultsRound(fcr, edge, outwards, binSize) {
  const fnName = 'featuresCountsResultsRound';
  /**
        fcr    |<-- binSize -->|                  
     ... ------|---------------|-----------|
                       |---|---|---|---|---|---|- ...
                         shadowing fcr (already accepted; smaller binSize)

    edge  outwards  direction up
    0      true       true    0
    0      true       false   1

    0      false      true    1
    0      false      false   0

    1      true       true    1
    1      true       false   0

    1      false      true    0
    1      false      false   1

    Check the above truth table with :
  [0,1].forEach((edge) =>  [true, false].forEach(
    (outwards) =>  [true, false].forEach(
      (direction) => console.log(edge, outwards, direction, (edge === 1) ^ !direction ^ !outwards))));

  */



  if (fcr.rounded[edge] !== undefined) {
    dLog(fnName, fcr, edge, outwards, binSize);
  } else {
    // if edge is 1 and direction is positive and outwards then round up
    let
    edgeLocn = fcr.domain[edge],
    direction = intervalSign(fcr.domain),
    up = (edge === 1) ^ !direction ^ !outwards;
    fcr.rounded[edge] = Math.trunc(edgeLocn / binSize + (up ? 1 : 0)) * binSize;
    if (Math.abs(fcr.rounded[edge] - fcr.domain[edge]) > binSize) {
      dLog(fnName, fcr, edge, outwards, binSize, edgeLocn, direction, up, fcr.rounded, fcr.domain, );
    }
  }
}


/*----------------------------------------------------------------------------*/

export {
  featuresCountsResultsCheckOverlap,
  featuresCountsResultsMerge,
  featuresCountsResultsFilter,
  featuresCountsResultsTidy,
  featuresCountsResultsSansOverlap,
};
