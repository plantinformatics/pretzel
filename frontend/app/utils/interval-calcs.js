/* related : see utils/draw/zoomPanCalcs.js
 * backend/common/utilities/interval-overlap.js
 */

/*----------------------------------------------------------------------------*/

/* global d3 */

/*----------------------------------------------------------------------------*/

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
 * @params intervals  number[2][2]
 * (intervals[i] !== undefined)
 * (intervals[i][0] <= intervals[i][1])
 * @return number[2], or undefined if intervals[i] are disjoint.
 * @desc For testing if there is an overlap, in zoomPanCalcs.js, @see overlapInterval()
 */
function intervalOverlap(intervals) {
  let overlap,
  i0 = intervalOrdered(intervals[0]),
  i1 = intervalOrdered(intervals[1]);

  // refn : https://scicomp.stackexchange.com/a/26260 spektr
  if ((i1[0] < i0[1]) && (i0[0] < i1[1])) {
    overlap = [Math.max(i0[0], i1[0]), Math.min(i0[1], i1[1])];
  }

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
  intervalSize, intervalLimit, intervalOutside, intervalMerge, intervalExtent,
  intervalOverlapCoverage,
  intervalOverlap,
  truncateMantissa
};
