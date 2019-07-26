
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


/** Filter the given array of paths to reduce the number of paths to nPaths.
 *
 * Possible future param : prType abstract the different types of path data;
 * e.g. if filtering selects paths based on some attribute values of the paths.
 *
 * @param pathsResult	accumulated paths from paths requests sent to backend for
 * a block-adj.
 * @param targetNPaths	number of paths indicated by paths density / sample /
 * nFeatures configuration, and graph display height.
 * Calculated by targetNPaths() above, which may return a non-integer number.
 * @return pathsResult unchanged if pathsResult.length <= nPaths
 */
function pathsFilter(pathsResult, nPaths) {
  let pathsFiltered;

  if (pathsResult.length <= nPaths)
    pathsFiltered = pathsResult;
  else {
    let modulus = Math.round(pathsResult.length / nPaths);
    pathsFiltered = pathsResult.reduce(function skipSome(result, path, i) {
      if (i % modulus == 0)
        result.push(path);
      return result;
    }, []);
    console.log('pathsFilter', pathsResult, nPaths, modulus, pathsFiltered);
  }

  return pathsFiltered;
}

export { targetNPaths, pathsFilter };
