
import {
  intervalSize,
  intervalOverlapOrAbut as intervalOverlap2
} from '../interval-calcs';

/* global require */
/* global d3 */

var intervalOverlap = require('./interval-overlap');

const dLog = console.debug;

const trace_filter = 1;


/** A measure of how close the paths are : number of pixels between paths,
 * measured parallel to the axes (vertical, i.e. height).
 * paths density is relative to this normal value
 */
const pixelspacing = 5;

/** Calculate how many paths to display, given the available screen height of
 * the axes and the user-controlled paths density configuration.
 *
 * @param pathsDensityParams the user-adjusted values in the view controls,
 * relating to the density of paths (densityFactor, nSamples, nFeatures).
 * @param axisLengthPx length in pixels of the axes which bound the block-adj
 * for which the paths are to be requested.  The axes may have different lengths
 * because of stacking, but for now a single value is used.
 * @return integer number if pathsDensityParams.nSamples; the result is likely
 * to be not an integer if .densityFactor
 */
function targetNPaths(pathsDensityParams, axisLengthPx) {
  let p = pathsDensityParams,
  nPaths = (p.nSamples !== undefined) ? p.nSamples :
    ((p.densityFactor !== undefined) ? (p.densityFactor * axisLengthPx / pixelspacing) : undefined);

  if (nPaths > p.nFeatures)
    nPaths = p.nFeatures;

  return nPaths;
}

/*----------------------------------------------------------------------------*/

/** Return true if the endpoints of the given path are in the corresponding axis domains.
 * The comparison is <=, i.e. the path endpoint feature value is in if it is abuts the domain,
 * e.g. feature value [0,0] is considered within if one end of the domain is 0.
 *
 * @param prType  abstract type description of path result p
 * @param p a path (result from request to backend)
 * @param all true means all path endpoints must be in the corresponding axis domains.
 * false means 'any' i.e. true if any of the path endpoints is in the corresponding axis domain.
 * @param blockDomains : 
 */
function pathInDomain(prType, p, all, blockDomains) {
  /** undefined, or a block for which the path's feature is not in the block's current (zoom) domain.  */
  let blockFound =
    [0, 1].find(function (i) {
      let
        domain = blockDomains[prType.pathBlock(p, i)],
      /** if not zoomed, i.e. ! domain, then all paths are accepted. */
      ok = ! domain;
      if (domain) {
        let
          features = prType.blocksFeatures(p, i),
        /** feature.value may be a ComputedProperty, so use get if defined. */
        dataLocation = function(feature) { return feature.get ? feature.get('value') : feature.value; },
        /** a function (v) to check if dataLocation of v is within domain domain;
         * in simple terms : domain[0] <= v && v <= domain[1], but also handles direction.
         */
        check = (intervalOverlap.inDomain(dataLocation, domain)),
        /** If all, then find the first false, otherwise find the first true. */
        findValue = ! all,
        featureFound = features.find((f) => (check(f) == findValue));
        ok = ! featureFound;
        if (trace_filter > 1 && ! ok)
          console.log('pathInDomain', domain, features, findValue, featureFound, ok);
      }
      return ok;
    });
  if (trace_filter > 1)
    console.log('pathInDomain', prType, p, all, blockDomains, blockFound);
  return ! blockFound;
}

/*----------------------------------------------------------------------------*/

/** Filter the given array of paths to reduce the number of paths to nPaths.
 *
 * Possible future param : prType abstract the different types of path data;
 * e.g. if filtering selects paths based on some attribute values of the paths.
 *
 * @param pathsResult	accumulated paths from paths requests sent to backend for
 * a block-adj.
 * @param blockDomains domains of the axes of the block-adj containing the paths,
 * indexed by blockId for quick lookup (an axis with multiple blocks will have
 * an identical entry for each).
 * @param targetNPaths	number of paths indicated by paths density / sample /
 * nFeatures configuration, and graph display height.
 * Calculated by targetNPaths() above, which may return a non-integer number.
 * @return pathsResult unchanged if pathsResult.length <= nPaths
 */
function pathsFilter(prType, pathsResult, blockDomains, nPaths) {
  /** all or any : filter the path in / out if all / any of its features' endpoints are in
   * the corresponding axis domain.
   * This may need to be a user toggle because either may be useful.
   * Alias result may contain paths with >1 feature per block.
   */
  let all = true;
  let pathsFiltered;
  if (blockDomains) {
    pathsResult = pathsResult.filter(function (p) {
      let inRange = pathInDomain(prType, p, all, blockDomains);
      return inRange;
    });
  }
  if (pathsResult.length <= nPaths)
    pathsFiltered = pathsResult;
  else {
    let modulus = Math.round(pathsResult.length / nPaths);
    pathsFiltered = pathsResult.reduce(function skipSome(result, path, i) {
      if (i % modulus == 0)
        result.push(path);
      return result;
    }, []);
    /** trace the (array) value or just the length depending on trace level. */
    function valueOrLength(value) { return (trace_filter > 1) ? value : value.length; }
    if (trace_filter)
      console.log('pathsFilter', valueOrLength(pathsResult), nPaths, modulus, valueOrLength(pathsFiltered));
  }

  return pathsFiltered;
}

/** Indexes for the endpoints of an interval or domain. */
const ends = [0,1];
/** Index for {prev,current} blockDomains and params.  */
const prevCurrent = [0, 1];
const indexPrev = 0, indexCurrent = 1;

/** Similar in role to pathsFilter(), this function aims for continuity of the
 * selected paths.
 * As in pathInDomain(), the comparison is <= (abut).  @see pathInDomain().
 * @param scope = model block-adj .get('scope')
 * scope[2] : {0,1} are {prev,current};  each element is : {blockDomains, pathsDensityParams, nPaths}
 * @param shown set of paths which are shown  (Set)
 */
function pathsFilterSmooth(prType, pathsResult, scope, shown) {
  const fnName = 'pathsFilterSmooth';
  /*
   calculate new nPaths
   ratio (overlap of) previous domain to current (new) domain, number of current paths to keep, difference is dp2k
*/
  dLog(fnName, prType.typeName, pathsResult.length, scope, shown.size);
  let
    /** scope[i].blockDomains is indexed by blockId, so map it to an array indexed by ends[].
     * so blockDomainsV[i] is equivalent to scope[i].blockDomains[blockIds[i]]
     * where blockIds = Object.keys(s.blockDomains)
     */
    blockDomainsV = scope.map((s, i) => Object.values(s.blockDomains)),
  overlaps =  ends.map((i) => intervalOverlap2(prevCurrent.map((j) => blockDomainsV[j][i]))),
  /** ratio of the overlap to the previous zoomedDomain, to determine proportion
   * of paths to keep when zooming out.
   * When zooming in, all paths are kept (ignoring the impact of changes to
   * nPaths; it is expected that this function will see 1 change at a time
   * either to nPaths or a zoom of one axis).
   */
  ratios = overlaps.map((o, i) => intervalSize(o) / intervalSize(blockDomainsV[indexCurrent][i])),
  /** combining the ratios from the 2 ends into a single number; heuristic : use
   * geometric mean; could also choose the minimum, because if [.1, .5] then the
   * .1 will have the more significant impact on the number of paths.
   *  If zooming in or not zooming then ratio is 1, so the mean is the other value.
   */
  ratio2 = Math.sqrt(ratios[0] * ratios[1]),
  // pathsToKeep = ratios.map((r) => r * scope[indexCurrent].nPaths),
  /** add new paths :
   * total nPaths, spread evenly across overlaps and outside it
   * inside overlaps : ratio2 * nPaths - pathsKept
   * outside overlaps : (1-ratio2) * nPaths
   * within overlaps : to make shown.size up to nPaths
   */
  nPaths = scope[indexCurrent].nPaths,
  pathsToKeep2 = ratio2 * nPaths;
  // deltaPathsToKeep = pathsToKeep.map((n) => n - scope[indexPrev].nPaths),
  // dp2k = d3.max(deltaPathsToKeep);
  dLog(fnName, overlaps, ratios, ratio2, pathsToKeep2); // pathsToKeep, , deltaPathsToKeep, dp2k);

  /* Drop shown paths which are outside the new domain. */
  const all = true;
  shown.forEach((p) => {
    let inRange = pathInDomain(prType, p, all, scope[indexCurrent].blockDomains);
    if (! inRange) {
      shown.delete(p);
    }
  });

/*
   increase  (dp2k > 0):
   keep all of current paths within new domain
   add extra paths, sampled from those within new domain and not in current

   decrease :
   keep sampled set of current paths within new domain, proportional to interval
   */


  if ((ratio2 < 1) || (nPaths < scope[indexPrev].nPaths)) { // drop some paths
    /** ratio of total / to-keep */
    let nextSelected = sequenceSelector(shown.size, pathsToKeep2);
    shown.forEach((p) => {
      if (! nextSelected())
        shown.delete(p);
    });
  }
  let pathsKept = shown.size;

  let blockDomains = scope[indexCurrent].blockDomains;
  let pathsFiltered = [];
    shown.forEach((p) => {
      pathsFiltered.push(p);
    });
  if (blockDomains) {
    pathsResult = pathsResult.filter(function (p) {
      let inRange = pathInDomain(prType, p, all, blockDomains);
      return inRange;
    });
  }
  if (pathsResult.length <= nPaths) {
    pathsFiltered = pathsResult;
    pathsFiltered.forEach((p) => {
      shown.add(p);
    });
  } else {
    //   add extra paths, sampled from those within new domain and not in current
    /** number of paths to add in the interval outside the overlap, i.e. the added interval when zooming out. */
    let nPathsAdd = ratio2 === 1 ? 0 : (1-ratio2) * nPaths;
    let nPathsAddIn = ratio2 * nPaths - pathsKept;
    if (nPathsAddIn < 0)
      nPathsAddIn = 0;
    if (nPathsAdd || nPathsAddIn) {
      /** selectors for new paths to add, outside and inside the overlap,
       * i.e. the interval of the previous zoom, and the interval(s) added
       * either side of that when zooming out.  */
      let selectOutside = sequenceSelector(pathsResult.length, nPathsAdd),
      selectInside = sequenceSelector(pathsResult.length, nPathsAddIn);
      /** verify sequenceSelector(). */
      let counts = [0, 0];
      pathsFiltered = pathsResult.reduce(function skipSome(result, path, i) {
        if (! shown.has(path)) {
          let inside = pathInDomain(prType, path, all, scope[indexCurrent].blockDomains),
          select = inside ? selectInside : selectOutside;
          /** using these 2 selectors alternately is only approximate. */
          if (select()) {
            result.push(path);
            shown.add(path);
            counts[+inside]++;
          }
        }
        return result;
      }, pathsFiltered);
      dLog(fnName, pathsResult.length, nPathsAdd, nPathsAddIn, counts);
    /** trace the (array) value or just the length depending on trace level. */
    function valueOrLength(value) { return (trace_filter > 1) ? value : value.length; }
    if (trace_filter)
      console.log(fnName, valueOrLength(pathsResult), nPaths, valueOrLength(pathsFiltered));
    }
  }

  return pathsFiltered;
}

/** Evenly select a fraction of a sequence.
 * @param total total number of items in the sequence to select from
 * @param selection number of items to select.
 * May be 0, in which case the result will be : function () { return false; }
 */
function sequenceSelector(total, selection) {
  /** Usage / test : 
   * next = sequenceSelector(shown.size, pathsToKeep2);  selected=0;
   * for (let i=0; i < 420000; i++) { if (next()) selected++; };
   * selected;
   */
  let fn;
  if (! selection) {
    fn = function () { return false; };
  }
  else {
    let ratio = total / selection,
    count = 0;
    fn = function next() {
      let cursor = count++ % ratio,
      select = cursor < 1;
      return select;
    };
  }
  return fn;
};


/*----------------------------------------------------------------------------*/

export { targetNPaths, pathsFilter, pathsFilterSmooth };
