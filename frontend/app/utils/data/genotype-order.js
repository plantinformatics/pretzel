/** Operations on genotype data, focused on ordering the sample columns based on
 * genotype values within variantSets.
 *
 * This group of related functions could be moved here from components/panel/manage-genotype.js :
 *   sampleNamesCmp(), columnNamesCmp(), matchesSummary, sampleMatchesSum().
 */

//------------------------------------------------------------------------------

import {
  gtValueIsNumeric,
} from './vcf-feature';

//----------------------------------------------------------------------------

/** The following classes implement a common API, which is referred to as Measure :
 *    MatchesCounts, Distance, Counts
 *
 * The methods are static because one of them, Distance, is a number not an object.
 *
 * These are formed from code factored out of manage-genotype.js,
 * matrix-view.js, and some of the param / variable names reflect that source
 * code, and the evolution from {matches,mismatches} (MatchesCounts) to Distance
 * to Counts.
 */

//----------------------------------------------------------------------------

/**  {matches,mismatches} */
class MatchesCounts {
  add(sum, distance) {
    const m = distance;
    sum.matches += m.matches;
    sum.mismatches += m.mismatches;
    return sum;
  }
  create() { return {matches: 0, mismatches : 0}; }
  haveData(counts) { return (counts.matches || counts.mismatches);  }
  hide(counts) { return counts.mismatches; }
  order(ms) {
    const
    ratio = ! ms || ! (ms.matches + ms.mismatches) ? 0 :
        ms.matches / (ms.matches + ms.mismatches);
    return ratio;
 }
  cmp(distance1, distance2) { return this.order(distance1) - this.order(distance2); }
  count(sampleMatch, match) {
    sampleMatch[match ? 'matches' : 'mismatches']++;
    return sampleMatch;
  }
  /** Used to average counts for a sampleName across blocks.
   * @param ms sum of Measure for blocks containing sampleName.
   * @param distanceCount count of blocks which added to ms, i.e. have counts
   * for sampleName.
   */
  average(ms, distanceCount) {
    const
    ratio = ! ms || ! (ms.matches + ms.mismatches) ? 0 :
      ms.matches / (ms.matches + ms.mismatches);
    return ratio;
  }
}

/** typeof distance === 'number' */
export class Distance {}
Distance.add = function(sum, distance) {
  sum = sum ?? Distance.create();
  return sum += distance;
};
Distance.create = function() { return 0; };
Distance.haveData = function(distance) { const counts = distance; return counts !== undefined; };
Distance.hide = function(distance) { return distance; };
Distance.order = function(distance) { return distance; };
Distance.cmp = function(distance1, distance2) {
  const
  matchRates = [distance1, distance2],
  /** if missing data is given undefined distance, then columns stop sorting at the missing data. */
  /* Could instead : isUndefined = matchRates.map(m => m === undefined),
   * cmp = isUndefined[0] && isUndefined[1] ? 0 : isUndefined[0] ? 1 : isUndefined[1] ? -1 : ...
   */
  containsUndefined = matchRates.indexOf(undefined) !== -1,
  cmp = containsUndefined ? 0 : matchRates[0] - matchRates[1];
  return cmp;
};

Distance.count = function(sum, distance) {
  if (distance !== undefined) {
    sum = sum ?? Distance.create();
    sum += distance;
  }
  return sum;
};
Distance.average = function(ms, distanceCount) {
  /* ! distanceCount implies ms is null.
   * missing data is not sorted
   */
  const ratio = ! distanceCount ? undefined : ms / distanceCount;
  return ratio;
};


/** {distance, missing}
 * Counts of Hamming distance and missing data.
 */
export class Counts { }
Counts.add = function(sum, counts) {
  sum = sum ?? Counts.create();
  const m = counts;
  sum.distance += m.distance;
  sum.missing += m.missing;
  return sum;
};
Counts.create = function() { return {distance: 0, missing : 0}; };
Counts.haveData = function(counts) { return counts && (counts.distance || counts.missing);  };
Counts.hide = function(counts)  { return counts && (counts.distance < counts.missing);  };
Counts.cmp = function(counts1, counts2) {
  const
  /** the sign of the result orders larger missing to the right, and smaller distances to the left.  */
  cmp = ! counts1 || ! counts2 ? 0 :
    counts1.missing || counts2.missing ? counts1.missing - counts2.missing :
    counts1.distance || counts2.distance ? counts1.distance - counts2.distance :
    0;
  return cmp;
};
Counts.count = function(sampleMatch, match) {
  sampleMatch[match ? 'missing' : 'distance']++;
  return sampleMatch;
};
Counts.average = function(ms, distanceCount) {
  /* ! distanceCount implies ms is null.
   * missing data is not sorted
   */
  const
  ratio = ! distanceCount ? undefined :
    Object.fromEntries(Object.entries(ms).map(
      ([key, value]) => [key, value / distanceCount]));
  return ratio;
};

//------------------------------------------------------------------------------

/** previous value : Distance; */
export const Measure = Counts;

//----------------------------------------------------------------------------

const sampleFiltersSymbol = Symbol.for('sampleFilters');
const sampleMatchesSymbol = Symbol.for('sampleMatches');

/** Sample names of a block which are selected by the user as references for
 * comparison of genotype values against the displayed samples.
 */
const referenceSamplesSymbol = Symbol.for('referenceSamples');
/** Distances per sampleName, per referenceSample, per block
 * i.e. block[referenceSampleMatchesSymbol][referenceSampleName] [sampleName] is a
 * distance across the variantSets of selected variantIntervals.
 */
const referenceSampleMatchesSymbol = Symbol.for('referenceSampleMatches');

export {
  referenceSamplesSymbol,
  referenceSampleMatchesSymbol,
};

//----------------------------------------------------------------------------

export { distancesTo1d };

/** collate distances by sampleName
 */
function distancesTo1d(blocks, referenceSamplesCount, sampleFilterTypeName) {
  const fnName = 'distancesTo1d';
  let distanceOrder;
  if ( ! referenceSamplesCount) {
    const
    block = blocks[0];
    distanceOrder = block[sampleMatchesSymbol];
  } else
  if ((blocks.length === 1) && (blocks[0][referenceSamplesSymbol]?.length === 1)) {
    const
    block = blocks[0],
    referenceSamples = block[referenceSamplesSymbol],
    referenceSampleName = referenceSamples[0];
    distanceOrder = block[referenceSampleMatchesSymbol][referenceSampleName];
  } else {
    const
    sampleDistanceVectors = blocks.reduce((d, block) => {
      const
      filterTypeName = sampleFilterTypeName,
      referenceSamples = block[referenceSamplesSymbol] || [],
      /** if referenceSampleMatches is empty, i.e. {}, then
       * sampleDistanceVectors and distanceOrder are both {}. */
      referenceSampleMatches = block[referenceSampleMatchesSymbol] || {};
      // objectSymbolNameArray(block, sampleFiltersSymbol, filterTypeName);
      // this.blockSampleFilters(block, 'referenceSampleMatches')

      Object.entries(referenceSampleMatches).forEach(([referenceSampleName, sampleDistances]) => {
        Object.entries(sampleDistances).forEach(([sampleName, sampleDistance]) => {
          const
          sampleVector = d[sampleName] || (d[sampleName] = []);
          /** Distance is the only Measure which is not an Object. */
          if (Measure === Distance) {
            sampleVector.push(sampleDistance);
          } else {
            sampleVector.pushObjects(Object.values(sampleDistance));
          }
        });
      });
      return d;
    }, {});
    distanceOrder = tsneOrder(sampleDistanceVectors);
  }
  return distanceOrder;
}

//------------------------------------------------------------------------------

export { tsneOrder };

/** match a (sample genotype call) value against the alleles genotype values
 * of the reference sample at the feature / SNP.
 * Used in filterSamples(), and based on the Alt/Ref equivalent `MatchRef` there.
 */
class MatchRefSample {
  constructor(referenceSampleName) {
    this.matchKey = referenceSampleName;
  }

  /**
   * @return Measure, i.e. Counts {distance, missing}
   * .missing is 2 if value is missing data, i.e. './.'
   */
  distanceFn(value, matchValue) {
    const fnName = 'distanceFn';
    /** number of copies of values alternate to allele values.
     * if missing then distance should be undefined, but sample column sort
     * order will depend on .distance then on .missing.
     */
    let distance = 0, missing = 0;
    // const values = [value, matchValue];
    if (gtValueIsNumeric(value) && gtValueIsNumeric(matchValue)) {
      distance = matchValue - value; // value[1] - value[0];
    } else {
      missing = 2;
    }
    return {distance, missing};
  }
}


//------------------------------------------------------------------------------

import TSNE from 'tsne-js';

export { MatchRefSample };

/** Map distance vectors of samples to 1D.
 * param samples {sampleName : [distance, ...], ... }
 */
function tsneOrder(samples) {
  const
  distanceVectors = Object.values(samples);
  // samples.entries.map(([sampleName, distances]) => 

  let sampleOrder;
  if (! distanceVectors.length) {
    sampleOrder = {};
  } else {
    const model = new TSNE({
      dim: 1,
      perplexity: 30.0,
      earlyExaggeration: 4.0,
      learningRate: 100.0,
      nIter: 150/*1000*/,
      metric: 'euclidean'
    });

    model.init({
      data: distanceVectors,
      type: 'dense'
    });

    const [error, iter] = model.run();

    // `outputScaled` is `output` scaled to a range of [-1, 1]
    const outputScaled = model.getOutputScaled();
    const
    sampleEntries = Object.keys(samples).map((sampleName, i) => ([sampleName, outputScaled[i][0]]));
    sampleOrder = Object.fromEntries(sampleEntries);
  }

  return sampleOrder;
}

