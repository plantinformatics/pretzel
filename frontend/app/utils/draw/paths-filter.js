
/* global require */

var intervalOverlap = require('./interval-overlap');

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
        dataLocation = function(feature) { return feature.value; },
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
    if (trace_filter)
    console.log('pathsFilter', pathsResult, nPaths, modulus, pathsFiltered);
  }

  return pathsFiltered;
}

export { targetNPaths, pathsFilter };
