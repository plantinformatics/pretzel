var _ = require('lodash')

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

  if (filteredPaths.length) {
  /** number of samples to skip. */
  let count = densityCount(filteredPaths.length, intervals)
  // let filteredPaths = nthSample(paths, intervals.nSamples);
  if (count)
    filteredPaths = nthSample(filteredPaths, count);
  }
  return filteredPaths;
};

function nthSample(paths, count) {
  let nth = Math.ceil(count)
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
    return total * pixelspacing / rangeLength;
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
  console.log('Calculated density count => ', count, counts, numPaths);
  return count
}

function domainFilter(paths, intervals) {
  const LEFT = 0, RIGHT = 1
  const BLOCK0 = 0, BLOCK1 = 1

  // paths = paths.slice(0, 3)

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
  // console.log('paths => ', paths);
  let result = paths.map(original => {
    let path = _.cloneDeep(original)
    path.alignment = path.alignment.map((block, i) => {
      if (!domains[i]) {
        return block
      }
      // let features = block.repeats.features

      // console.log('unfiltered features => ', block.repeats.features);
      block.repeats.features = block.repeats.features.filter(f => {
        let range = f.value || f.range
        if (range.length === 1)
          range[1] = range[0];
        return ((range[LEFT] >= domains[i][LEFT]) &&
                     range[RIGHT] <= domains[i][RIGHT])
      })
      // console.log('filtered features => ', block.repeats.features);
      return block
    })

    // console.log('path.alignment => ', path.alignment);
    // console.log('path 0 => ', path.alignment[0].repeats.features);
    // console.log('path 1 => ', path.alignment[1].repeats.features);
    // console.log('original 0 => ', original.alignment[0].repeats.features);
    // console.log('original 1 => ', original.alignment[1].repeats.features);

    // let equal0 = path.alignment[0].repeats.features.length === original.alignment[0].repeats.features.length
    // let equal1 = path.alignment[1].repeats.features.length === original.alignment[1].repeats.features.length

    // console.log('equal0, equal1 => ', equal0, equal1);
    return path
  })
  
  return result.filter(path => {
    let keepArray = [BLOCK0, BLOCK1].map(block => {
      return path.alignment[block].repeats.features.length > 0
    })
    return keepArray[BLOCK0] && keepArray[BLOCK1]
  })
}



