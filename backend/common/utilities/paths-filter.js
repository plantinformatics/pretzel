/* global exports */

/** TODO :
 * filter paths according to intervals.axes[].domain[]
 * 
 * Use pathsAggr.densityCount(), with some changes : instead of totalCounts[], can simply count the paths.
*/
exports.filterPaths = function(paths, intervals) {
  // console.log('paths, intervals => ', paths, intervals);
  console.log('paths.length => ', paths.length);
  

  let filteredPaths = nthSample(paths, intervals.nSamples);
  return filteredPaths;
};

function nthSample(paths, nSamples) {
  let nth = Math.ceil(paths.length/nSamples)
  return paths.filter((path, i) => {
    return (i % nth === 0)
  })
}