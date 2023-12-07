const util = require('util');

var createIntervalTree = require("interval-tree-1d");

/* global exports */
/* global require */

//------------------------------------------------------------------------------

const { ApiServer, apiServers, blockServer } = require('./api-server');
const { ErrorStatus } = require('./errorStatus.js');
const {
  childProcess, dataOutReplyClosure, dataOutReplyClosureLimit, dataReduceClosure,
  stringCountString,
} = require('../utilities/child-process');
const { binEvenLengthRound, binBoundaries } = require('../utilities/block-features');

//------------------------------------------------------------------------------


/**
 * @param datasetDir  name of directory containing the VCF dataset
 * @param scope e.g. '1A'; identifies the vcf file, i.e. datasetId/scope.vcf.gz
 * @param preArgs args to be inserted in command line, additional to the datasetDir / vcf dir name.
 * See comment in frontend/app/services/auth.js : vcfGenotypeLookup()
 * @param nLines if defined, limit the output to nLines.
 * @param dataOutCb passed to childProcess() - see comment there.
 * If undefined, then dataOutReplyClosureLimit(cb, lineFilter, nLines) is used.
 * @param cb
 */
function vcfGenotypeLookup(datasetDir, scope, preArgs_, nLines, dataOutCb, cb) {
  /** Split out the optional parameters which are passed as separate params for
   * processing separately to the remainder of preArgs, which are inserted as a
   * list into the command.  */
  let {isecFlags, isecDatasetIds, ... preArgs} = preArgs_ || {};
  const
  fnName = 'vcfGenotypeLookup',
  headerOnly = preArgs.headerOnly,
  /** snpPolymorphismFilter is not applicable if SNPList because if the
   * number of samples requested is <=1 then every row appears homozygous.
   */
  snpPolymorphismFilter = ! preArgs.SNPList && preArgs.snpPolymorphismFilter,
  /** These parameters are supported by view only, not query, so if
   * present then view | query will be used.
   * In that case moreParams will be passed to view, and paramsForQuery
   * will be passed to query.
   */
  viewRequired = snpPolymorphismFilter || preArgs.mafThreshold,
  command = headerOnly ? 'view' : preArgs.SNPList ?
    (viewRequired ? 'counts_view' : 'counts_query') :
    preArgs.requestFormat ? (viewRequired ? 'view_query' : 'query') : 'view';
  /* isec is only meaningful with >1 datasets. The caller
   * vcfGenotypeLookupDataset() only passes isecDatasetIds when
   * isecDatasetIds.length > 1
   */
  let isecDatasetIdsText = isecDatasetIds;
  if (Array.isArray(isecDatasetIds) /*&& (isecDatasetIds.length > 1)*/) {
    /** this is split in vcfGenotypeLookup.bash with tr '!' ' '  */
    const datasetIdsSeparator = '!';
    isecDatasetIdsText = isecDatasetIds.join(datasetIdsSeparator);
  }
  /** The params passed to spawn (node:child_process) are passed as options.args
   * to ChildProcess.spawn (node:internal/child_process) which calls
   * spawn(options) which converts non-strings to strings, e.g. arrays are
   * joined with ',' into a single string.  undefined -> 'undefined'.
   */
  let moreParams = [
    command, datasetDir, scope,
    isecFlags || '', isecDatasetIdsText || '',
    '-r', preArgs.region ];
  /** from BCFTOOLS(1) :
   bcftools view [OPTIONS] file.vcf.gz [REGION [...]]
      -h, --header-only
          output the VCF header only

      -H, --no-header
          suppress the header in VCF output

   bcftools query [OPTIONS] file.vcf.gz [file.vcf.gz [...]]
       -H, --print-header
           print header

  * headerOnly implies command==='view' i.e. -h
  * When ! headerOnly, the header is required;
  * *  for view : --with-header is default
  * *  for query : use -H
  */
  const
  headerOption = headerOnly ? /*command===view*/'-h' :
    (command === 'view') ? '' : '-H';

  if (preArgs.requestFormat) {
    const
    /** from BCFTOOLS(1) :
     *        %GT             Genotype (e.g. 0/1)
     *        %TGT            Translated genotype (e.g. C/A)
     */
    formatGT = (preArgs.requestFormat === 'CATG') ? '%TGT' : '%GT',
    /** now INFO/MAF is added if not present, by
     * vcfGenotypeLookup.{bash,Makefile} : dbName2Vcf() / %.MAF.vcf.gz
     * So requestInfo means just 'request INFO/tSNP'.
     */
    requestInfo = preArgs.requestInfo,
    format = '%ID\t%POS' + '\t%REF\t%ALT' +
      (requestInfo ? '\t%INFO/tSNP' : '') +
      '\t%INFO/MAF' +
      '[\t' + formatGT + ']\n';
    /** Params passed to query if view|query is used, otherwise to command. */
    const paramsForQuery = ['-queryStart', headerOption, '-f', format, '-queryEnd'];
    moreParams = moreParams.concat(paramsForQuery);
    if (headerOnly) {
      moreParams.push('--force-samples');
    }
    /** default is no het filter, i.e. false */
    if (snpPolymorphismFilter) {
      moreParams.push('--genotype');
      moreParams.push('het');
    }
    /** default is no MAF filter, i.e. >= 0, (MAF is >=0) */
    if (preArgs.mafThreshold) {
      const
      /** --min-af and --max-af uses "INFO/AC and INFO/AN when
       * available or FORMAT/GT" quoting BCFTOOLS(1), whereas
       * --exclude MAF< / > will utilise INFO/MAF for example.
       * Related : mafThresholdText(); inverted here because 'exclude'.
       */
      afOption = 'MAF' + (preArgs.mafUpper ? '>' : '<') + preArgs.mafThreshold;
      moreParams.push('--exclude');
      moreParams.push(afOption);
    }
    if (preArgs.featureCallRateThreshold) {
      const
      /** equivalent : N_PASS(GT!="./.")/N_SAMPLES */
      fcrOption = 'F_PASS(GT!="./.") >= ' + preArgs.featureCallRateThreshold;
      moreParams.push('-i');
      moreParams.push(fcrOption);
    }
  }
  const samples = preArgs.samples;
  if (samples?.length) {
    const
    samplesJoined = samples
      .trimEnd(/\n/)
      .replaceAll('\n', ',');
    moreParams = moreParams.concat('-s', samplesJoined);
  } else if (preArgs.requestSamplesAll) {
    // bcftools default is All samples, no option required.
  } else {
    // There is not an option for 0 samples, except via using an empty file :
    moreParams = moreParams.concat('-S', '/dev/null');
  }
  /** avoid tracing samples, and moreParams[9] which is the samples. */
  console.log(fnName, datasetDir, preArgs.region, preArgs.requestFormat, samples?.length, moreParams.slice(0, 9+3));
  if (! dataOutCb) {
    const lineFilter = false && preArgs.snpPolymorphismFilter ? snpPolymorphismFilter : null;
    dataOutCb = dataOutReplyClosureLimit(cb, lineFilter, nLines);
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
 * @param isZoomed
 * @param userOptions optional. user settings : {mafThreshold, snpPolymorphismFilter}
 *
 * @return Promise yielding : Array	: binned feature counts
 * in the same format as block-features.js :
 * blockFeaturesCounts(), @see vcfGenotypeFeaturesCounts()
 * $bucket :
 * { "_id" : 33000000, "count" : 38201, "idWidth" : [ 1000000 ] }
 * { "_id" : 34000000, "count" : 47323, "idWidth" : [ 1000000 ] }
 */
exports.vcfGenotypeFeaturesCounts = function(
  block, interval, nBins = 10, isZoomed, userOptions, cb) {
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
    datasetDir = block.datasetId,
    // may be able to omit domainInteger if ! isZoomed 
    domainInteger = interval.map((d) => d.toFixed(0)),
    region = scope + ':' + domainInteger.join('-'),
    preArgs = {region, samples : null, requestFormat : 'CATG', SNPList : true},
    // arguments 1-3 are used : block, interval, nBins
    summary = new vcfToSummary(...arguments);
    if (userOptions) {
      Object.entries(userOptions).forEach(([key, value]) =>
        { if (value !== undefined) { preArgs[key] = value; } });
    }
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
    vcfGenotypeLookup(
      datasetDir, scope,
      preArgs, /*nLines*/undefined, dataOutCb, cb
    );

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

/** Count sample genotype values 0 and 2 (number of copies of Alt).
 * Filter the line out if it is monomorphic, i.e. either the number of 0's or
 * the number of 2's is 0.
 * @param line result of split('\n'), expected to be a string
 * @return undefined or null if the line should be filtered out,
 * otherwise return truthy (returning the line because lineFilter signature
 * could be changed to filter&map).
 */
function snpPolymorphismFilter(line) {
  if (line.startsWith('#')) {
    return line;
  }

  const
  /** e.g. # [1]ID\t[2]POS\t[3]REF\t[4]ALT\t[5]tSNP\t[6]MAF\t[7]Exo
   * values are genotype call values of the samples
   */
  [/*chr,*/ name, position, ref, alt, tSNP, MAF, ...values] = line.split('\t');
  let
  counts = values.reduce((result, value) => {
    /* Number of columns before sample genotype values may vary, so skip values
     * which don't match the expected format for genotype values.  */
    if (value.match(/[012ACTG]\/[012ACTG]/)) {
      /* if (requestFormat === 'CATG') {
         altCopies = stringCountString(value, alt);
         }
      */
      const altCopies = stringCountString(value, '1');
      result[altCopies]++;
    }
    return result;
  }, [0, 0, 0]),
  monomorphic = ! counts[0] || ! counts[2];
  return ! monomorphic && line;
}

//------------------------------------------------------------------------------

/** Get the status of .vcf.gz files for this dataset.
 * Related : vcfGenotypeFeaturesCounts().
 */
function vcfGenotypeFeaturesCountsStatus(datasetDir, cb) {
  const
  fnName = 'vcfGenotypeFeaturesCountsStatus',
  command = 'status',
  moreParams = [
    command, datasetDir, /*scope*/'',
    /*isecFlags*/'', /*isecDatasetIds*/''];

  /** Receive the combined result (progressive===false).
   * For non-progressive (expect that the result is in a single chunk) could use
   * dataReduceClosure() to catenate chunks.
   * @param combined	Buffer
   */
  function dataOutCb(combined, cb) {
    // console.log(fnName, 'dataOutCb', combined);
    const text = combined.toString();
    cb(null, text);
  }

  childProcess(
    'vcfGenotypeLookup.bash',
    /* postData */ '', 
    /* useFile */ false,
    /* fileName */ undefined,
    moreParams,
    dataOutCb, cb, /*progressive*/ false);
};
exports.vcfGenotypeFeaturesCountsStatus = vcfGenotypeFeaturesCountsStatus;




//------------------------------------------------------------------------------
