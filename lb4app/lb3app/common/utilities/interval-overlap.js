/* global exports */

var trace_filter = 1;

/*----------------------------------------------------------------------------*/

/** This code is split out of backend/common/utilities/paths-filter.js
 * so it can be shared between backend/ and frontend/.
 * Sharing the code using build and package looks non-trivial from this discussion :
 * https://discuss.emberjs.com/t/best-practice-for-sharing-es6-code-between-a-node-server-and-an-ember-client/8016
 * An alternative is to use git symlinks, which are now reasonably supported in Windows :
 * https://stackoverflow.com/questions/5917249/git-symlinks-in-windows/49913019#49913019
 * that configuration may be simpler with WSL2, so initially npm run scripts are
 * used to set up the symlink.
 */

/*----------------------------------------------------------------------------*/


/** Determine if the point v is in the interval domain.
 * The result is analogous to the comparator function (cmp) result.
 * Assume i[0] < i[1].
 * @return 0 if v is in i, -1 if v < i, +1 if v > i
 */
function inInterval(i, v) {
  let
    in0 = i[0] <= v,
  in1 = v <= i[1],
  within = in0  &&  in1,
  cmp = within ? 0 : (in0 ? 1 : -1);
  return cmp;
}

function trueFunction() { return true; }

/**
 * @return a function which takes a feature as parameter and returns true if
 * the feature value is within the domain.
 * @param dataLocation  function which reads the location value from the data
 * @param domain  Array[2] of location limit values.  Not undefined.
 */
function inDomain(dataLocation, domain) {
  function featureInDomain(f) {
    let v = dataLocation(f),
    /** handle value array with 1 or 2 elements */
    inA =
      v.map(function (vi) { return inInterval(domain, vi); });
    let result;
    if (v.length === 1) {
      let
        in0 = (inA[0] === 0);
      result = in0;
    }
    else {
      let
        in0 = (inA[0] === 0),
        in1 = (inA[1] === 0),
      within = in0  &&  in1,
      /** i.e. feature value overlaps or contains domain as a subset. */
      overlapping = inA[0] != inA[1];
      result = within || overlapping;
    }
    // console.log('featureInDomain', f, v, inA, result);
    return result;
  };
  return featureInDomain;
}

/** Filter features by the domain defined in intervals.axes[0].
 * Uses @see inDomain().
 * @param data  paths from aliases
 */
function domainFilterPathAliases(data, intervals) {
  if (trace_filter > (1 - (data.length > 1)))
    console.log('domainFilterPathAliases', data.length, intervals, intervals.axes[0].domain);
  if (trace_filter > (2 - (data.length > 1)))
    logArrayEnds('', data, 1);
  const featureFields = ["featureAObj", "featureBObj"];
  let debugCount = 1;
  function debugCounter() { if (debugCount > 0) { debugCount--; debugger; }; };
  function dataLocation(i) { return function (d) { /*debugCounter();*/ let f = d[featureFields[i]]; return f.value || f.range; }; };
  function check1(i) {
    let a = intervals.axes[i];
    return (a.zoomed && a.domain) ? inDomain(dataLocation(i), a.domain) : trueFunction;
 };
  let check1_0 = check1(0),
  check1_1 = check1(1);
  function check(p) { return check1_0(p) && check1_1(p); };
  let
  filtered = data.filter(check);
  if (trace_filter > (2 - (data.length > 1)))
    logArrayEnds('filtered', filtered, 1);
  return filtered;
}

/*----------------------------------------------------------------------------*/

/** Log the first and last elements of an array.
 * Used to check filtering by interval.
 */
function logArrayEnds(label, a, margin) {
  console.log(label, a.length, a.slice(0, margin));
  if (a.length > 1)
    console.log('...', a.length-2*margin, a.slice(-margin));
}

/*----------------------------------------------------------------------------*/

exports.inInterval = inInterval;
exports.inDomain = inDomain;
exports.domainFilterPathAliases = domainFilterPathAliases;
exports.logArrayEnds = logArrayEnds;

/*----------------------------------------------------------------------------*/
