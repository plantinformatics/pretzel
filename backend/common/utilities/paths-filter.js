/* global exports */

/** TODO :
 * filter paths according to intervals.axes[].domain[]
 * 
 * Use pathsAggr.densityCount(), with some changes : instead of totalCounts[], can simply count the paths.
*/
exports.filterPaths = function(paths, intervals) {
  // console.log('paths, intervals => ', paths, intervals);
  console.log('paths.length => ', paths.length);
  console.log('intervals.axes[0].domain => ', intervals.axes[0].domain);
  console.log('intervals.axes[1].domain => ', intervals.axes[1].domain);
  // console.log('paths[0] => ', paths[0]);
  // console.log('paths[1] => ', paths[1]);
  // console.log('paths[0].alignment => ', paths[0].alignment);
  // console.log('paths[0].alignment.length => ', paths[0].alignment.length);
  // console.log('paths[1].alignment.length => ', paths[1].alignment.length);
  // console.log('paths[0].alignment[0] => ', paths[0].alignment[0]);
  // console.log('paths[0].alignment[0].repeats => ', paths[0].alignment[0].repeats);
  let filteredPaths
  if (intervals.axes[0].domain || intervals.axes[1].domain)
    filteredPaths = domainFilter(paths, intervals)
  else
    filteredPaths = paths;

  let nSamples = densityCount(paths.length, intervals)
  // let filteredPaths = nthSample(paths, intervals.nSamples);
  filteredPaths = nthSample(filteredPaths, nSamples);
  return filteredPaths;
};

function nthSample(paths, nSamples) {
  let nth = Math.ceil(paths.length/nSamples)
  return paths.filter((path, i) => {
    return (i % nth === 0)
  })
}

function densityCount(numPaths, intervals) {
  // console.log('numPaths, intervals => ', numPaths, intervals);
  // console.log('intervals.axes[0].range => ', intervals.axes[0].range);
  // console.log('intervals.axes[1].range => ', intervals.axes[1].range);
  // console.log('intervals.axes => ', intervals.axes);
  let pixelspacing = 5;

  // using total in block instead of # features in domain interval.
  function blockCount(total, rangeLength) {
    // console.log('total, range => ', total, rangeLength);
    // console.log('range / pixelspacing => ', rangeLength / pixelspacing);
    return rangeLength / pixelspacing
  }
  // What should range (pixel space) look like?
  // Is it a range of values? (Start and end point of pixel space,
  // a single length value may be all that's needed)
  // Is it different for different axes?
  // How does different ranges affect the samples?

  let count
  let counts = [0, 1].map(i => {
    // console.log('intervals.axes[i] => ', intervals.axes[i]);
    var range = intervals.axes[i].range
    var rangeLength = Array.isArray(range) ? (range[1] - range[0]) : range
    return blockCount(numPaths, rangeLength);
  });
  count = Math.sqrt(counts[0] * counts[1]);
  count = count / intervals.page.thresholdFactor;
  count = Math.round(count);
  console.log('Calculated density count => ', count);
  return count
}

function domainFilter(paths, intervals) {
  const LEFT = 0, RIGHT = 1
  const BLOCK0 = 0, BLOCK1 = 1

  /* Checking paths object structure */
  // console.log('paths[0].alignment[0] => ', paths[0].alignment[0]);
  // console.log('paths[0].alignment[0].blockId => ', paths[0].alignment[0].blockId);
  // console.log('paths[0].alignment[1].blockId => ', paths[0].alignment[1].blockId);

  // console.log('paths[1].alignment[0].blockId => ', paths[1].alignment[0].blockId);
  // console.log('paths[1].alignment[1].blockId => ', paths[1].alignment[1].blockId);
  // console.log('paths[0].alignment[0].repeats.features => ', paths[0].alignment[0].repeats.features);
  // console.log('paths[0].alignment[0].repeats.features[0].range => ', paths[0].alignment[0].repeats.features[0].range);
  // console.log('paths[0].alignment[1].repeats.features[0].range => ', paths[0].alignment[1].repeats.features[0].range);
  
  let domains = [BLOCK0, BLOCK1].map(block => {
    return intervals.axes[block].domain
  })
   console.log('domains => ', domains);
  return paths.filter(path => {
    let featureRanges = [BLOCK0, BLOCK1].map(block => {
      // has a magic number 0 atm, the array may fill up with other features
      // that will also have to be checked if they are within the domain
      let f = path.alignment[block].repeats.features[0];
      // attribute name was formerly .range, handle some current data which has that form.
      return f.value || f.range;
    })
    // console.log('featureRanges => ', featureRanges);
    let keepArray = [BLOCK0, BLOCK1].map(block => {
      let featureValue = featureRanges[block];
      // feature.value maybe be [x] or [start, end]
      if (featureValue.length === 1)
        featureValue[1] = featureValue[0];
      // Is left of feature in domain and right of feature in domain?
      return ! domains[block] ||
        ((featureValue[LEFT] >= domains[block][LEFT]) &&
         featureValue[RIGHT] <= domains[block][RIGHT])
    })

    // console.log('keepArray => ', keepArray);
    // Are both blocks within domain requested?
    return keepArray[BLOCK0] && keepArray[BLOCK1]
  })
}
