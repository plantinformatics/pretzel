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
    distanceOrder = {};
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
          sampleVector.push(sampleDistance);
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
   * @return undefined if value is missing data, i.e. './.'
   */
  distanceFn(value, matchValue) {
    const fnName = 'distanceFn';
    /** number of copies of values alternate to allele values. */
    let distance;
    // const values = [value, matchValue];
    if (gtValueIsNumeric(value) && gtValueIsNumeric(matchValue)) {
      distance = matchValue - value; // value[1] - value[0];
    }
    return distance;
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

