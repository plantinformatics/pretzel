/** Utilities that collate and order genotype-based column metrics.
 *
 * genotype values within variantSets.
 *
 * The genotype table lets users pin a set of SNPs (via features, variant intervals,
 * or LD blocks) and optionally choose reference samples.  The UI then needs to
 * compute a sortable "distance" per sample column that captures how closely that
 * sample matches the selected genotype pattern.
 *
 * This module centralises the domain-specific types and helpers that make the above
 * possible:
 *   • `Measure` implementations (`MatchesCounts`, `Distance`, `Counts`) define how a
 *     stream of per-feature comparisons is aggregated.
 *   • `distancesTo1d()` merges the per-block per-reference Measures produced by
 *     `filterSamples()` and projects them into a single ordering value that the table
 *     can sort by.
 *   • `MatchRefSample` implements the same comparator contract as the inline MatchRef
 *     class in manage-genotype.js but uses sample genotypes instead of Ref/Alt values.
 *   • `tsneOrder()` performs the dimensionality reduction that collapses multi-block
 *     vectors into sortable scalars while preserving relative similarity.
 *
 * Keep this file free of Ember-specific constructs so it can be reused by other
 * environments (e.g. tests or scripts) that operate directly on JSON data volumes.
 *
 * This group of related functions could be moved here from components/panel/manage-genotype.js :
 *   sampleNamesCmp(), columnNamesCmp(), matchesSummary, sampleMatchesSum().

 */


//------------------------------------------------------------------------------

import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
const /*import */{
  gtValueIsNumeric,
} = vcfGenotypeBrapi.vcfFeature; /*from 'vcf-genotype-brapi'; */


import { stringCountString } from '../string';


//----------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

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


/** {distance, missing, notMissing, differences}
 * Counts of Hamming distance and missing / notMissing data.
 *
 * distance, missing, and notMissing are counted in alleles (currently assumed
 * diploid, i.e. count each SNP as 2), whereas differences counts the SNPs which
 * are different.
 */
export class Counts { }
Counts.add = function(sum, counts) {
  sum = sum ?? Counts.create();
  const m = counts;
  sum.distance += m.distance;
  sum.missing += m.missing;
  sum.notMissing += m.notMissing;
  sum.differences += m.differences;
  return sum;
};
Counts.create = function() {
 return {
   distance: 0, missing : 0, notMissing : 0, differences : 0};
};
Counts.haveData = function(counts) {
 return counts &&
    (counts.distance || counts.missing || counts.notMissing || counts.differences);
};
Counts.hide = function(counts)  { return counts && (counts.distance < counts.missing);  };
Counts.order = function(counts) {
  const
  /** adjust the distance + differences measure by its significance,
   * proportional to notMissing / missing data
   */
  nSNPs = counts.missing + counts.notMissing,
  d = (((counts.distance << 8) | counts.differences) * nSNPs) << 8,
  p = counts.notMissing ? d / counts.notMissing : d,
  value = p | counts.missing;
  return value;
};
Counts.cmp = function(counts1, counts2) {
  const
  /** the sign of the result sorts in ascending order by : distance, differences, missing;
   * i.e. larger missing to the right, and smaller distances to the left.
   * This does not handle undefined or null field values.
   */
  cmp = ! counts1 || ! counts2 ? 0 :
    Counts.order(counts1) - Counts.order(counts2);
/*
    (counts1.distance - counts2.distance) ||
    (counts1.differences - counts2.differences) ||
    (counts1.missing - counts2.missing);
*/
  if (trace) {
    dLog('cmp', cmp, counts1, counts2);
  }
  return cmp;
};
Counts.count = function(sampleMatch, match) {
  sampleMatch[match ? 'missing' : 'distance']++;
  sampleMatch.differences++;
  return sampleMatch;
};
Counts.average = function(ms, distanceCount) {
  /* ! distanceCount implies ms is null.
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

/** Merge per-block Measure maps into a single sortable value per sample.
 * collate distances by sampleName
 *
 * Input expectations :
 *   • `blocks` is an array of genotype table blocks.  Each block may carry
 *     `block[sampleMatchesSymbol]` (no explicit reference samples) and/or
 *     `block[referenceSampleMatchesSymbol]` (distances measured against specific
 *     reference samples).  Both maps originate from filterSamples().
 *   • `referenceSamplesCount` is used as the quick path: if there are zero or one
 *     reference samples in play we do not need t-SNE because `sampleMatchesSum()`
 *     can compare Measures directly.
 *   • `userSettings` (currently `sampleFilterTypeName` and `haplotypeFilterRef`) tell
 *     the function which reference map to use when no explicit references exist.
 *
 * Behaviour :
 *   • Simple cases (≤1 reference sample) reuse the raw Measure values as-is.  The
 *     consumer will call `Measure.order()` later to derive a numeric sort key.
 *   • When multiple references and/or blocks contribute distances we treat each
 *     reference as a dimension and build a vector per sample.  These vectors feed into
 *     `tsneOrder()` which outputs a 1-D embedding that preserves relative separation
 *     so samples can still be sorted left-to-right in a meaningful way.
 *
 * @param blocks
 * @param referenceSamplesCount number of selected referenceSamples
 * @param  userSettings { sampleFilterTypeName, haplotypeFilterRef}
 * @return {} if no dimension reduction is required, i.e. there is <= 1
 * selected referenceSample.  These cases are handled by sampleMatchesSum(),
 * which is equivalent.
 *
 * @return Object<string,number|Object>  Mapping sampleName ➜ ordering metric.
 */
function distancesTo1d(blocks, referenceSamplesCount, userSettings) {
  const fnName = 'distancesTo1d';
  const sampleFilterTypeName = userSettings.sampleFilterTypeName;
  let distanceOrder = {};
  if ( ! referenceSamplesCount) {
    const
    block = blocks[0];
    // distanceOrder = block[sampleMatchesSymbol];
  } else
  if ((blocks.length === 1) && (blocks[0][referenceSamplesSymbol]?.length === 1)) {
    const
    block = blocks[0],
    referenceSamples = block[referenceSamplesSymbol],
    referenceSampleName = referenceSamples[0];
    dLog(fnName, distanceOrder, referenceSamplesCount, block.brushName, referenceSamples, referenceSampleName);
    // distanceOrder = block[referenceSampleMatchesSymbol][referenceSampleName];
  } else if (
    /* if just <= 1 referenceSamples selected, merge the measures of the blocks
     * instead of using dimension reduction to combine them.  This is
     * experimental - some possible issues :
     * .  sample names may overlap between the blocks, in which case .average()
     *    would be better;
     * .  sampleFilters may not be present in all blocks, affecting the distance
     *    (may be OK because .order() calculates relative to counts.notMissing).
     * .  if a referenceSample is selected, it is in 1 block - this will similarly
     *    affect the distance.
     *    This is not a problem when 0 referenceSamples, i.e. using alt/ref of
     *    the parent.
     */
    blocks.map(b => b[referenceSamplesSymbol]?.length)
      .filter(s => typeof s === 'number')
      .reduce((sum, s) => {return sum +=s;}, 0)
      <= 1) {
    const
    sampleName = userSettings.haplotypeFilterRef ? 'ref' : 'alt',
    orders = blocks.map(b => b[referenceSampleMatchesSymbol]?.[sampleName]);
    dLog(fnName, distanceOrder, referenceSamplesCount, sampleName, orders);
    // distanceOrder = Object.assign.apply({}, orders);
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

/** match a (sample genotype call) value against the Ref/Alt/Null value of the
 * feature / SNP.  a rough factorisation; currently there is just 1 flag
 * haplotypeFilterRef for all selected 'LD Blocks', and hence one instance
 * of MatchRef, but these requirements are likely to evolve.
 *
 * Origin : in cafd7623 MatchRef was factored from haplotypeFilterSamples()
 * (later renamed to filterSamples()).
 * Update 2025Nov24 : add support for null genotype values.
 */
export class MatchRef {
  constructor(matchRef) {
    this.matchRef = matchRef;
    this.matchKey = (matchRef === null) ? 'null' : matchRef ? 'ref' : 'alt';
    this.matchNumber = (matchRef === null) ? 'N' : matchRef ? '0' : '2';
  }
  /** Extract from feature the value to compare against for this MatchRef.
   * i.e. feature.values.ref, feature.values.alt, or null
   */
  matchValue(feature) {
    return (this.matchRef === null) ? null : feature.values[this.matchKey];
  }
  static columnNameToMatchRef = {
    Ref : true,
    Alt : false,
    Null : null,
  }
  /** to match homozygous could use .startsWith(); that will also match 1/2 of heterozygous.
   * Will check on (value === '1') : should it match depending on matchRef ?
   * @param value sample/individual value at feature / SNP
   * This function is not called if valueIsMissing(value).
   * @param matchValue  ref/alt value at feature / SNP (depends on matchRef)
   * @desc added in 2a0962e0, replaced in 557d1c30 by distanceFn().
   */
  matchFn(value, matchValue) { return (value === this.matchNumber) || (value === '1') || value.includes(matchValue); }
  /** Calculate the distance between a sample genotype value and matchValue.
   * Used in featuresCountMatches() (manage-genotype.js).
   * 
   * @param value sample/individual value at feature / SNP
   * This function is not called if valueIsMissing(value).
   * @param matchValue  ref/alt/null value at feature / SNP (depends on matchRef)
   * @return undefined if value is invalid
   * missing data, i.e. './.', is counted in .missing if using Counts
   */
  distanceFn(value, matchValue) {
    const fnName = 'distanceFn';
    /** number of copies of Alt / Ref, for matchRef true / false. */
    let distance, missing = 0;
    const numeric = gtValueIsNumeric(value);
    if (value === './.') {
      missing += 2;
      distance = this.matchRef ? 0 : 2;
    } else {
      switch (value.length) {
      case 3 :
        if (this.matchRef === null) {
          /** value is not 'N' or missing, so it is Alt / Ref / het, so distance = 2 */
          distance = 2;
        } else {
          if (numeric) { matchValue = this.matchRef ? '1' : '0'; }
          distance = /*2 -*/ stringCountString(value, matchValue);
        }
        break;
      case 1:
        if (numeric || (value === 'N')) {
            distance = (this.matchRef === null) ? 2 * +(value !== 'N') :
            (value === 'N') ? 2 :
            this.matchRef ? +value : 2 - value;
          } else {
            // was .matchNumber, but that is numeric.
            distance = 2 - 2 * (value === matchValue);
          }
        break;
      default : dLog(fnName, 'invalid genotype value', value);
        break;
      }
    }
    if (Measure === Counts) {
      const counts = Measure.create();
      // similar to Counts.count(), except that increments by only 1.
      if (missing) {
        counts.missing = missing;
      } else {
        counts.notMissing = 2;
        counts.distance = distance;
        counts.differences = distance ? 1 : 0;
      }
      distance = counts;
    }

    return distance;
  }
}


//------------------------------------------------------------------------------

export
/** Comparator that uses the genotype values of a user-selected reference sample.
 *
 * Manage-genotype reuses the same filtering pipeline for both of these scenarios:
 *   1. Compare every sample column against a synthetic Ref/Alt pattern
 *      (`MatchRef` in manage-genotype.js).
 *   2. Compare every sample column against the actual genotype calls of one of the
 *      reference samples selected in the UI.
 *
 * This class implements scenario #2 so that `filterSamples()` can keep the same
 * aggregation code path regardless of the source of the comparator data.
 *
 * match a (sample genotype call) value against the alleles genotype values
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
    let distance = 0, missing = 0, differences = 0;
    // const values = [value, matchValue];
    // matchValue.length is 1
    // this assumes value.length === 1
    if (gtValueIsNumeric(value) && gtValueIsNumeric(matchValue)) {
      // probably Math.abs()
      distance = matchValue - value; // value[1] - value[0];
      differences = distance ? 1 : 0;
    } else {
      missing = 2;
    }
    const notMissing = 2 - missing;
    return {distance, missing, notMissing, differences};
  }
}


//------------------------------------------------------------------------------

import TSNE from 'tsne-js';

export
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

