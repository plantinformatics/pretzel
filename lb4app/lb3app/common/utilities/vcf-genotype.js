const util = require('util');

var createIntervalTree = require("interval-tree-1d");

/* global exports */
/* global require */

//------------------------------------------------------------------------------

const { ApiServer, apiServers, blockServer } = require('./api-server');
const { ErrorStatus } = require('./errorStatus.js');
const { childProcess, dataOutReplyClosure, dataOutReplyClosureLimit } = require('../utilities/child-process');
const { binEvenLengthRound, binBoundaries } = require('../utilities/block-features');

//------------------------------------------------------------------------------


/**
 * @param parent  name of parent or view dataset, or vcf directory name
 * @param scope e.g. '1A'; identifies the vcf file, i.e. datasetId/scope.vcf.gz
 * @param nLines if defined, limit the output to nLines.
 * @param preArgs args to be inserted in command line, additional to the parent / vcf file name.
 * See comment in frontend/app/services/auth.js : vcfGenotypeLookup()
 */
function vcfGenotypeLookup(parent, scope, preArgs, nLines, cb) {
  const
  fnName = 'vcfGenotypeLookup',
  command = preArgs.requestFormat ? 'query' : 'view';
  let moreParams = [command, parent, scope, '-r', preArgs.region ];
  if (preArgs.requestFormat) {
    const
    /** from BCFTOOLS(1) :
     *        %GT             Genotype (e.g. 0/1)
     *        %TGT            Translated genotype (e.g. C/A)
     */
    formatGT = (preArgs.requestFormat === 'CATG') ? '%TGT' : '%GT',
    format = '%ID\t%POS' + '\t%REF\t%ALT' + '[\t' + formatGT + ']\n';
    moreParams = moreParams.concat('-H', '-f', format);
  }
  if (preArgs.samples?.length) {
    moreParams = moreParams.concat('-s', preArgs.samples.replaceAll('\n', ','));
  } else {
    // There is not an option for 0 samples, except via using an empty file :
    moreParams = moreParams.concat('-S', '/dev/null');
  }
  console.log(fnName, parent, preArgs, moreParams);

  childProcess(
    'vcfGenotypeLookup.bash',
    /* postData */ '', 
    /* useFile */ false,
    /* fileName */ undefined,
    moreParams,
    dataOutReplyClosureLimit(cb, nLines), cb, /*progressive*/ true);

};
exports.vcfGenotypeLookup = vcfGenotypeLookup;

//------------------------------------------------------------------------------

/** Count features of the given block in bins.
 *
 * @param block  object instance of Block model
 * @param interval  bin boundaries within this range
 * @param nBins number of bins to group block's features into
 *
 * @return Promise yielding : Array	: binned feature counts
 * { "_id" : { "min" : 4000000, "max" : 160000000 }, "count" : 22 }
 * { "_id" : { "min" : 160000000, "max" : 400000000 }, "count" : 21 }
 */
exports.vcfGenotypeFeaturesCounts = async function(block, interval, nBins = 10, isZoomed) {
  // header comment copied from block-features.js : blockFeaturesCounts()
  const fnName = 'vcfGenotypeFeaturesCounts';
  let result;

  // default interval can be the whole domain of the block
  if (! interval || interval.length !== 2) {
    const errorText = 'Interval is required. ' + JSON.stringify(interval),
          error = new ErrorStatus(400, errorText);
    result = error;
  } else {
    if (interval[0] > interval[1]) {
      console.warn(fnName, 'reverse interval', interval, block.id);
      let swap = interval[0];
      interval[0] = interval[1];
      interval[1] = swap;
    }

    const
      scope = block.name,
      parent = block.datasetId,
    // may be able to omit domainInteger if ! isZoomed 
      domainInteger = interval.map((d) => d.toFixed(0)),
      region = scope + ':' + domainInteger.join('-'),
      preArgs = {region, samples : null, requestFormat : 'CATG'};

      // %REF\t%ALT could be omitted in this case.

      function lookupPromise(...args) {
        return new Promise((resolve, reject) => {
          vcfGenotypeLookup(...args, cb);
          function cb(err, data) {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          }
        });
      }
    result = await util.promisify(vcfGenotypeLookup)(parent, scope, preArgs, /*nLines*/undefined)
      .then((text) => vcfToSummary(text, domainInteger, nBins));
    }

  return result;
};

/**
 * @param interval  domainInteger
 */
function vcfToSummary(text, interval, nBins) {
  const
  fnName = 'vcfToSummary',
  lengthRounded = binEvenLengthRound(interval, nBins),
  boundaries = binBoundaries(interval, lengthRounded),
  /** map the boundaries into interval [start, end] pairs.  */
  intervals = boundaries.map((b, i, a) => (i ? [a[i-1], b] : undefined))
    .slice(1, boundaries.length-1),
  symbolCount = Symbol.for('count');
  intervals.forEach((interval) => interval[Symbol.for('count')] = 0);
  console.log(fnName, lengthRounded, boundaries, intervals);

  // set up bins and interval tree
  let summaryTree = createIntervalTree(intervals);

  /** text has \n and \t, column format e.g. :
   * # [1]ID	[2]POS	[3]REF	[4]ALT
   * scaffold38755_1190119	1190119	C	T
   */
  text.split('\n')
    .forEach((line, i) => {
      // skip header line
      if (i) {
        // add line to interval of summaryTree;
        const
        cols = line.split('\t'),
        position = +cols[1];
        summaryTree.queryInterval(position, position, addToInterval);
        function addToInterval(interval) {
          interval[symbolCount]++;
        }
      }
    });
  const
  summaryArray = summaryTree.intervals
    .sort((a, b) => a[0] - b[0])
    .map((interval) =>
         ({ "_id" : { "min" : interval[0], "max" : interval[1] }, "count" : interval[symbolCount] }));

  return summaryArray;
}

//------------------------------------------------------------------------------
