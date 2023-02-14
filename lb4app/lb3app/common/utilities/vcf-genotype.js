const util = require('util');

var createIntervalTree = require("interval-tree-1d");

/* global exports */
/* global require */

//------------------------------------------------------------------------------

const { ApiServer, apiServers, blockServer } = require('./api-server');
const { ErrorStatus } = require('./errorStatus.js');
const {
 childProcess, dataOutReplyClosure, dataOutReplyClosureLimit, dataReduceClosure
} = require('../utilities/child-process');
const { binEvenLengthRound, binBoundaries } = require('../utilities/block-features');

//------------------------------------------------------------------------------


/**
 * @param parent  name of parent or view dataset, or vcf directory name
 * @param scope e.g. '1A'; identifies the vcf file, i.e. datasetId/scope.vcf.gz
 * @param preArgs args to be inserted in command line, additional to the parent / vcf file name.
 * See comment in frontend/app/services/auth.js : vcfGenotypeLookup()
 * @param nLines if defined, limit the output to nLines.
 * @param dataOutCb passed to childProcess() - see comment there.
 * If undefined, then dataOutReplyClosureLimit(cb, nLines) is used.
 * @param cb
 */
function vcfGenotypeLookup(parent, scope, preArgs, nLines, dataOutCb, cb) {
  const
  fnName = 'vcfGenotypeLookup',
  headerOnly = preArgs.headerOnly,
  command = ! headerOnly && preArgs.requestFormat ? 'query' : 'view';
  let moreParams = [command, parent, scope, '-r', preArgs.region ];
  /** from BCFTOOLS(1) :
      -h, --header-only
          output the VCF header only

      -H, --no-header
          suppress the header in VCF output
  */
  const headerOption = headerOnly ? '-h' : '-H';

  if (preArgs.requestFormat) {
    const
    /** from BCFTOOLS(1) :
     *        %GT             Genotype (e.g. 0/1)
     *        %TGT            Translated genotype (e.g. C/A)
     */
    formatGT = (preArgs.requestFormat === 'CATG') ? '%TGT' : '%GT',
    requestInfo = preArgs.requestInfo && JSON.parse(preArgs.requestInfo),
    format = '%ID\t%POS' + '\t%REF\t%ALT' +
      (requestInfo ? '\t%INFO/tSNP' : '') +
      '[\t' + formatGT + ']\n';
    moreParams = moreParams.concat(headerOption, '-f', format);
    if (headerOnly) {
      moreParams.push('--force-samples');
    }
  }
  if (preArgs.samples?.length) {
    moreParams = moreParams.concat('-s', preArgs.samples.replaceAll('\n', ','));
  } else {
    // There is not an option for 0 samples, except via using an empty file :
    moreParams = moreParams.concat('-S', '/dev/null');
  }
  /** avoid tracing preArgs.samples, and moreParams[9] which is the samples. */
  console.log(fnName, parent, preArgs.region, preArgs.requestFormat, preArgs.samples?.length, moreParams.slice(0, 9));
  if (! dataOutCb) {
    dataOutCb = dataOutReplyClosureLimit(cb, nLines);
  }

  childProcess(
    'vcfGenotypeLookup.bash',
    /* postData */ '', 
    /* useFile */ false,
    /* fileName */ undefined,
    moreParams,
    dataOutCb, cb, /*progressive*/ true);

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
 * in the same format as block-features.js :
 * blockFeaturesCounts(), @see vcfGenotypeFeaturesCounts()
 * $bucket :
 * { "_id" : 33000000, "count" : 38201, "idWidth" : [ 1000000 ] }
 * { "_id" : 34000000, "count" : 47323, "idWidth" : [ 1000000 ] }
 */
exports.vcfGenotypeFeaturesCounts = function(block, interval, nBins = 10, isZoomed, cb) {
  // header comment copied from block-features.js : blockFeaturesCounts()
  const fnName = 'vcfGenotypeFeaturesCounts';
  let result;

  // default interval can be the whole domain of the block
  if (! interval || interval.length !== 2) {
    const
    errorText = 'Interval is required. ' + JSON.stringify(interval),
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
    preArgs = {region, samples : null, requestFormat : 'CATG'},
    summary = new vcfToSummary(...arguments);
    function sumCb(error, text) {
      let result;
      if (error) {
        throw error;
      } else if (text === undefined) {
        result = summary.summarise();
      } else {
        summary.accumulateChunk(text);
      }
      return result;
    }
    const [blockArg, ...intervalArgs] = arguments;
    const dataOutCb = dataReduceClosure(sumCb);
    vcfGenotypeLookup(parent, scope, preArgs, /*nLines*/undefined, dataOutCb, cb);

    /* vcfGenotypeLookup() includes %REF\t%ALT, which could be omitted in this case. */
  }

  return result;
};

const symbolCount = Symbol.for('count');

class vcfToSummary {

  /**
   * @param interval  domainInteger
   */
  constructor(block, interval, nBins) {
    const
    fnName = 'vcfToSummary',
    lengthRounded = binEvenLengthRound(interval, nBins),
    boundaries = binBoundaries(interval, lengthRounded),
    /** map the boundaries into interval [start, end] pairs.  */
    intervals = boundaries.map((b, i, a) => (i ? [a[i-1], b] : undefined))
      .slice(1, boundaries.length-1);
    intervals.forEach((interval) => interval[Symbol.for('count')] = 0);
    // console.log(fnName, block.id, lengthRounded, boundaries, intervals);

    // set up bins and interval tree
    this.summaryTree = createIntervalTree(intervals);
  }
}

vcfToSummary.prototype.accumulateChunk = function (text) {
  /** text has \n and \t, column format e.g. :
   * # [1]ID	[2]POS	[3]REF	[4]ALT
   * scaffold38755_1190119	1190119	C	T
   */
  text.split('\n')
    .forEach((line, i) => {
      /* first line of first chunk is header line, for subsequent chunks match /^#/
       * last line of chunk may be incomplete - save it to prepend to first line of next chunk.
       */
      // skip header line
      if (i) {
        // add line to interval of summaryTree;
        const
        cols = line.split('\t'),
        position = +cols[1];
        this.summaryTree.queryInterval(position, position, addToInterval);
        function addToInterval(interval) {
          interval[symbolCount]++;
        }
      }
    });
};

    
/**
 * @return summary array, in the same format as block-features.js :
 * blockFeaturesCounts(), @see vcfGenotypeFeaturesCounts()
 */
vcfToSummary.prototype.summarise = function() {
  const
  summaryArray = this.summaryTree.intervals
    .sort((a, b) => a[0] - b[0])
    .map(
      (interval) =>
        ({
          _id : interval[0],
          count : interval[symbolCount],
          idWidth : [interval[1] - interval[0]]
        }));

    return summaryArray;
};


//------------------------------------------------------------------------------
