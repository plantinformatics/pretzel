import { intervalSign } from './draw/zoomPanCalcs';
import { inInterval } from './draw/interval-overlap';
import { maybeFlip }  from './draw/axis';
import { equalWithinPrecision } from './domCalcs';
import { subInterval } from './draw/zoomPanCalcs';


/*----------------------------------------------------------------------------*/

/* related : see utils/draw/zoomPanCalcs.js
 * backend/common/utilities/interval-overlap.js
 */

/*----------------------------------------------------------------------------*/

/* global d3 */

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** @return true if the given intervals are equal to within the JavaScript
 * floating point number precision,
 * and the direction of the intervals is the same.
 */
function intervalsEqual(i1, i2) {
  const different = i1.find((a, i) => ! equalWithinPrecision(a, i2[i]));
  return ! different;
}
/** As for intervalsEqual(), but the params are arrays of intervals.
 * Compare them in parallel
 */
function intervalsArraysEqual(i1, i2) {
  const
  different = (i1.length !== i2.length) || 
    i1.find((a, i) => ! intervalsEqual(a, i2[i]));
  return ! different;
}

//------------------------------------------------------------------------------

/** Determine the absolute length of the given interval or domain.
 * @param interval  number[2]
 */
function intervalSize(interval) {
  return Math.abs(interval[1] - interval[0]);
}

const
intervalLimit = [d3.min, d3.max],
/** Choose the outside values, as with d3.extent()
 * true if value a is outside the domain limit b.
 */
intervalOutside = [(a, b) => (a < b),
                   (a, b) => (a > b),
                  ];

/** Merge the given interval v into the domain, so that the result domain
 * contains the interval.
 *
 * Used within .reduce(),  e.g. :
 *       intervals.reduce(intervalMerge, []);
 * @param domain  result of merging the intervals.
 * form is [min, max].
 * @param v a single interval (feature value). can be either direction, i.e. doesn't assume  f[0] < f[1]
 * @see intervalExtent()
 */
function intervalMerge(domain, v) {
  // let v = f.get('valueOrdered');

  [0, 1].forEach(function (i) {
    /** the limit value of the interval v, in the direction i.
     * The result domain is ordered [min, max] whereas the input values v are
     * not; this translates the unordered value to the ordered result.
     */
    let limit = intervalLimit[i](v);
    if ((domain[i] === undefined) || intervalOutside[i](limit, domain[i]))
      domain[i] = limit;
  });

  return domain;
}

/** Calculate the union of the given intervals. 
 */
function intervalExtent(intervals) {
  let extent = intervals.reduce(intervalMerge, []);
  return extent;
}

/** Indexes for the endpoints of an interval or domain. */
const ends = [0, 1];

/** Calculate the overlap (intersection) of domain1, domain2, and the size of
 * that overlap relative to the size of domain2.
 * @return 0 if there is no overlap
 * @params domain1, domain2	
 */
function intervalOverlapCoverage(domain1, domain2) {
  let overlap = intervalOverlap([domain1, domain2]),
  coverage = overlap ? (intervalSize(overlap) / intervalSize(domain2)) : 0;
  return coverage;
}

/** Calculate the intersection of the given intervals. 
 * @param intervals  number[2][2]
 * (intervals[i] !== undefined)
 * (intervals[i][0] <= intervals[i][1])
 * @param abut  true means return a 0-length interval if the intervals abut.
 * This param may change - prefer to use the separate function for this : @see intervalOverlapOrAbut()
 * @return number[2], or undefined if intervals[i] are disjoint.
 * @desc For testing if there is an overlap, in zoomPanCalcs.js, @see overlapInterval()
 */
function intervalOverlap(intervals, abut) {
  let overlap,
  i0 = intervalOrdered(intervals[0]),
  i1 = intervalOrdered(intervals[1]);

  // refn : https://scicomp.stackexchange.com/a/26260 spektr
  let isOverlap = abut ?
      (i1[0] <= i0[1]) && (i0[0] <= i1[1]) :
      (i1[0] <  i0[1]) && (i0[0] <  i1[1]);
  if (isOverlap) {
    overlap = [Math.max(i0[0], i1[0]), Math.min(i0[1], i1[1])];
  }

  return overlap;
}
function intervalOverlapOrAbut(intervals) {
  let overlap = intervalOverlap(intervals, true);
  return overlap;
}


/** Ensure that the endpoints of the given interval are in increasing order, or equal.
 * @return a new array if the endpoints need to be swapped
 */
function intervalOrdered(interval) {
  if (interval[0] > interval[1]) {
    interval = [interval[1], interval[0]];
  }
  return interval;
}

/** @return i1 - i2, i.e. the part of i1 outside of i2
 * Result direction is the same as the direction of i1.
 * @param operation 'intersect', 'union', 'subtract'.
 *
 * @param i1, i2 are intervals, i.e. [start, end]
 * (i1 and i2 have the same direction)
 * i1 and i2 overlap, and neither is a sub-interval of the other.
 * @see subInterval(), featuresCountsResultsMerge().
 */
function intervalJoin(operation, i1, i2) {
  /**

  |----------------|           i1
          |-----------------|  i2
  |-------|--------|--------|
   outside  inside  outside
          |--------|           intersect
  |-------|--------|--------|  union
  |-------|                    subtract

  */
  const inside = 1, outside = 0;
  let
  cmp1 = i1.map((i) => inInterval(i2, i)),
  /** i1[indexes1[outside]] is outside i2, and
   * i1[indexes1[inside]] is inside i2.
   */
  indexes1 = cmp1.map((i) => (+(i === 0))),
  /** could calculate cmp2, indexes2, but for current use
   * (featureCountsResults) can assume that direction of i1 and i2 is
   * the same, so i2[indexes1[outside]] is inside i1.
   */
  interval =
    (operation === 'intersect') ?  [i1[indexes1[inside]],  i2[indexes1[outside]]] :
    (operation === 'union')     ?  [i1[indexes1[outside]], i2[indexes1[inside]]] :
    (operation === 'subtract')  ?  [i1[indexes1[outside]], i2[indexes1[outside]]] :
    undefined;

  let flip = intervalSign(interval) !== intervalSign(i1);
  interval = maybeFlip(interval, flip);

  dLog('intervalJoin', operation, interval, i1, i2, cmp1, indexes1);
  return interval;
}

/** Subtract i2 from i1, where i2 is a sub-interval of i1.
 * If i2 overlaps i1 but is not a sub-interval of it, then use intervalJoin('subtract', i1, i2).
 *
 * This is applicable
 * when i2 is a subInterval of i1, and hence the result is 2 intervals
 * in an array; (used by featuresCountsResultsSansOverlap()).
 */
function intervalSubtract2(i1, i2) {
  /**

  |-------------------------|  i1
          |--------|           i2
  |-------|        |--------|  subtract2

  */

  let
  sameDir = intervalSign(i1) === intervalSign(i2),
  start1 = 0,
  end1 = 1 - start1,
  start2 = sameDir ? start1 : end1,
  end2 = 1 - start2,
  interval = [[i1[start1], i2[start2]], [i2[end2], i1[end1]]];

  interval.forEach((i3, i) => { if (! intervalSign(i3)) { console.log('intervalSubtract2', i3, i); } });
  dLog('intervalSubtract2', interval, i1, i2);
  return interval;
}

/** @return the intersection of the given intervals
 * @param i1, i2 are arrays [start, end], in the same direction
 */
function intervalIntersect(i1, i2) {
  const
  intersect =
    subInterval(i1, i2) ? i1 :
    subInterval(i2, i1) ? i2 :
    intervalJoin('intersect', i1, i2);
  return intersect;
}
/** @return true if the given intervals intersect / overlap.
 * @param i1, i2 are arrays [start, end] or [start].
 * This function does not depend on direction.
 */
function intervalsIntersect(i1, i2) {
  const
  intersect =
    ((i2.length > 1) && i1.find((i) => ! inInterval(i2, i))) ||
    ((i1.length > 1) && i2.find((i) => ! inInterval(i1, i))) ||
    (i1[0] === i2[0]);
  return intersect;
}

/** @return true if the 2 intervals have a common endpoint.
 * Form of i1 and i2 is : [number, number].
 * The implementation will handle other vector lengths; if sameDir
 * then i2.length is expected to be >= i1.length
 * @param sameDir if true then assume i1 and i2 have the same direction.
 */
function intervalsAbut(i1, i2, sameDir) {
  let
  matchFn = sameDir ?
    (x1, i) => x1 === i2[i] :
    (x1, i) => i2.find((x2, j) => (x1 === x2)),
    match = i1.find(matchFn);
  return match;
}

/*----------------------------------------------------------------------------*/

/** Keep the top byte of the mantissa and clear the rest.
 * Used to granularise an interval, for constructing a taskId (getSummary() in
 * services/data/block.js), so that a new request (task) is sent when the
 * interval is zoomed significantly.
 */
function truncateMantissa(x)
{
  /** based on https://stackoverflow.com/a/17156580 by 'copy'. */
  var float = new Float64Array(1),
      bytes = new Uint8Array(float.buffer);

  float[0] = x;

  bytes[0] = 0;
  bytes[1] = 0;
  bytes[2] = 0;
  bytes[3] = 0;
  bytes[4] = 0;
  bytes[5] = 0;

  return float[0];
}

/*----------------------------------------------------------------------------*/

export {
  intervalsEqual,
  intervalsArraysEqual,
  intervalSize, intervalLimit, intervalOutside, intervalMerge, intervalExtent,
  intervalOverlapCoverage,
  intervalOverlap,
  intervalOverlapOrAbut,
  intervalOrdered,
  intervalJoin,
  intervalSubtract2,
  intervalIntersect,
  intervalsIntersect,
  intervalsAbut,
  truncateMantissa
};
