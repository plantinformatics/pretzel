const util = require('util');

var { flatten }  = require('lodash/array');

const { blockFilterValue0 } = require('./paths-aggr');


var ObjectID = require('mongodb').ObjectID;

/*----------------------------------------------------------------------------*/

/* global require */
/* global exports */
/* global process */

const trace_block = 1;

/** ObjectId is used in mongo shell; the equivalent defined by the node js client library is ObjectID; */
const ObjectId = ObjectID;

/** blockFeaturesCounts() can use a query which is covered by the index
 * if .value[0] has been copied as .value_0
 *
 * Using '$value_0' in place of {$arrayElemAt : ['$value', 0]} is functionally
 * equivalent, and enables the combined index {blockId, value_0} to cover
 * the query;
 * this can be dropped if a way is found to access value[0] without $expr,
 * which seems to not enable PROJECTION_COVERED.
 */
const use_value_0 = process.env.use_value_0 || false;

/*----------------------------------------------------------------------------*/

/** Show whether a aggregation pipeline is covered by an index.
 */
function showExplain(label, aggregationCursor) {
  /* Usage e.g. showExplain('blockFeaturesCounts', featureCollection.aggregate ( pipeline, {allowDiskUse: true} ))
   */
  aggregationCursor
    .explain()
    .then((a, b) => {
      let stage; try { stage = a.stages[0].$cursor.queryPlanner.winningPlan.stage; } catch (e) {};
      if (stage !== 'PROJECTION_COVERED') {
        console.log(label, ' explain then', a, stage /*, b, arguments, this*/);
      }
    });
}

/*----------------------------------------------------------------------------*/


/** Count features of the given blocks.
 *
 * @param blockCollection dataSource collection
 * @param blockIds  ids of data blocks
 *
 * @return cursor	: features
 */
exports.blockFeaturesCount = function(db, blockIds) {
  // initial draft based on blockFeaturesInterval()
  let featureCollection = db.collection("Feature");
  if (trace_block)
    console.log('blockFeaturesCount', blockIds);
  let ObjectId = ObjectID;

  let
    /** may be faster to use simple string match for .length === 1, instead of $in array. */
    blockIdMatch = blockIds.length === 1 ? ObjectId(blockIds[0]) :
      {$in : blockIds.map(function (blockId) { return ObjectId(blockId); }) },
    matchBlock =
    [
	    { $match :  { "blockId" : blockIdMatch}},
      { $group: { _id: '$blockId', featureCount: { $sum: 1 } } }
    ],

    pipeline = matchBlock;

  if (trace_block)
    console.log('blockFeaturesCount', pipeline);
  if (trace_block > 1)
    console.dir(pipeline, { depth: null });

  let result =
    featureCollection.aggregate ( pipeline, {allowDiskUse: true} );

  return result;

};

/*----------------------------------------------------------------------------*/

/** Calculate the bin size for even-sized bins to span the given interval.
 * The bin size is rounded to be a multiple of a power of 10, only the first 1-2
 * digits are non-zero.
 * Used in @see binBoundaries().
 * @return lengthRounded
 */
function binEvenLengthRound(interval, nBins) {
  let lengthRounded;
  if (interval && (interval.length === 2) && (nBins > 0)) {
    /* if (interval[1] < interval[0])
     interval = interval.sort(); */
    /** handle -ve interval direction - could occur with only -ve features in block. */
    let intervalLength = Math.abs(interval[1] - interval[0]),
    binLength = intervalLength / nBins,
    digits = Math.floor(Math.log10(binLength)),
    eN1 = Math.exp(digits * Math.log(10)),
    mantissa = binLength / eN1,
    /** choose 1 2 or 5 as the first digit of the bin size. */
    m1 = mantissa > 5 ? 5 : (mantissa > 2 ? 2 : 1);
    if (digits >= 0) {
      lengthRounded = Math.round(m1 * eN1);
    } else {
      /** for e.g. digits===-1, eN1 is 0.09999999999999998,
       * and (m1 * eN1) is 0.4999999999999999 which will round down to 0.
       * So instead, use string operation to construct eN1, so .round() is not required.
       * This could probably be used for digits >= 0 also.
       *
       * A simpler form would be Math.round(m1 * eN1 * 100000) / 100000, but
       * that is limited to digits > -5, which would be sufficient for the
       * datasets used so far, e.g. a genetic map is ~200cM, so digits===-1, and
       * for a physical map digits==-6.
       */
      eN1 = '0.' + ('000000000000000'.substr(0, 1+digits)) + '1';
      lengthRounded = (m1 * eN1);
    }

    console.log('binEvenLengthRound', interval, nBins, intervalLength, binLength, digits, eN1, mantissa, m1, lengthRounded);
  }
  return lengthRounded;
};
exports.binEvenLengthRound = binEvenLengthRound;

/** Generate an array of even-sized bins to span the given interval.
 * Used for mongo aggregation pipeline : $bucket : boundaries.
 */
function binBoundaries(interval, lengthRounded) {
  let b;
  if (lengthRounded) {
    let
      start = interval[0],
    intervalLength = interval[1] - interval[0],
    direction = Math.sign(intervalLength),
    forward = (direction > 0) ?
      function (a,b)  {return a < b; }
    : function (a,b)  {return a > b; };

    let location = Math.floor(start / lengthRounded) * lengthRounded;
	  b = [location];
    do {
      location += lengthRounded;
      b.push(location);
    }
    while (forward(location, interval[1]));
    console.log('binBoundaries', direction, b.length, location, b[0], b[b.length-1]);
  }
  return b;
};
exports.binBoundaries = binBoundaries;




/** Count features of the given block in bins.
 *
 * @param blockCollection dataSource collection
 * @param blockId  id of data block
 * @param interval  if given then use $bucket with boundaries in this range,
 * otherwise use $bucketAuto.
 * @param nBins number of bins to group block's features into
 *
 * @return cursor	: binned feature counts
 * additional field when ! useBucketAuto : idWidth
 * $bucket :
 * { "_id" : 33000000, "count" : 38201, "idWidth" : [ 1000000 ] }
 * { "_id" : 34000000, "count" : 47323, "idWidth" : [ 1000000 ] }
 * $bucketAuto :
 * { "_id" : { "min" : 4000000, "max" : 160000000 }, "count" : 22 }
 * { "_id" : { "min" : 160000000, "max" : 400000000 }, "count" : 21 }
 */
exports.blockFeaturesCounts = function(db, blockId, interval, nBins = 10, isZoomed, useBucketAuto) {
  // initial draft based on blockFeaturesCount()
  let featureCollection = db.collection("Feature");
  /** The requirement (so far) is for even-size boundaries on even numbers,
   * e.g. 1Mb bins, with each bin boundary a multiple of 1e6.
   *
   * $bucketAuto doesn't require the boundaries to be defined, but there may not
   * be a way to get it to use even-sized boundaries which are multiples of 1eN.
   * By default it defines bins which have even numbers of features, i.e. the
   * bin length will vary.  If the parameter 'granularity' is given, the bin
   * boundaries are multiples of 1e4 at the start and 1e7 near the end (in a
   * dataset [0, 800M]; the bin length increases in an exponential progression.
   *
   * So $bucket is used instead, and the boundaries are given explicitly.
   * This requires interval; if it is not passed, $bucketAuto is used, without granularity.
   */
  useBucketAuto = useBucketAuto || ! (interval && interval.length === 2);
  if (interval && interval.length === 2) {
    if (interval[0] > interval[1]) {
      console.warn('blockFeaturesCount', 'reverse interval', interval, blockId);
      let swap = interval[0];
      interval[0] = interval[1];
      interval[1] = swap;
    }
  }
  if (trace_block)
    console.log('blockFeaturesCounts', blockId, interval, nBins, isZoomed, useBucketAuto);
  let ObjectId = ObjectID;
  let lengthRounded, boundaries;
  if (! useBucketAuto) {
    lengthRounded = binEvenLengthRound(interval, nBins),
    boundaries = binBoundaries(interval, lengthRounded);
  }
    
  let
    matchBlock =
    [
      use_value_0 ? blockFilterValue0(isZoomed ? interval : undefined, blockId) :
      {$match : {blockId :  ObjectId(blockId)}},
      useBucketAuto ? 
        { $bucketAuto : { groupBy: {$arrayElemAt : ['$value', 0]}, buckets: Number(nBins)}  } // , granularity : 'R5'
      : { $bucket     :
          {
            /** faster query if .value_0 is available  @see use_value_0 */
            groupBy: (use_value_0 ? '$value_0' : {$arrayElemAt : ['$value', 0]}), boundaries,
	    'default' : 'outsideBoundaries',
            output: {
              count: { $sum: 1 },
              idWidth : {$addToSet : lengthRounded }
            }
          }
        }
    ],

    pipeline = matchBlock;

  if (trace_block)
    console.log('blockFeaturesCounts', pipeline);
  if (trace_block > 1)
    console.dir(pipeline, { depth: null });

  let result =
    featureCollection.aggregate ( pipeline, {allowDiskUse: true} );

  return result;

};

/*----------------------------------------------------------------------------*/


/** Collate max & min feature values of the given block.
 *
 * Also includes the count of Features in each block, which is also returned by
 * blockFeaturesCount(); if this function has similar performance then it could
 * be used in place of blockFeaturesCount().
 *
 * @param db connected dataSource
 * @param blockId  id of data block.  optional - if undefined then all blocks are scanned.
 * The existing backend URL-level cache can effectively cache requests for a single blockId or for
 * all (blockId===undefined), whereas another caching facility would be required
 * for requests with an array of blockIds.
 *
 * @return cursor	: max and min feature values
 * e.g.
 * { "_id" : ObjectId("5cc69ed7de8ab9393f45052d"), "max" : 494550358, "min" : 447129 }
 */
exports.blockFeatureLimits = function(db, blockId) {
  // initial draft based on blockFeaturesCounts()
  let featureCollection = db.collection("Feature");
  if (trace_block)
    console.log('blockFeatureLimits', blockId);
  let ObjectId = ObjectID;

  /** unwind the values array of Features, and group by blockId, with the min &
   * max values within the Block.
   * value may be [from, to, anyValue], so use slice to extract just [from, to],
   * and $match $ne null to ignore to === undefined.
   * The version prior to adding this comment assumed value was just [from, to] (optional to);
   * so we can revert to that code if we separate additional values from the [from,to] location range.
   *
   * We currently have data which has just a number or string for value instead of an array;
   * handle this by checking for $type and applying $slice to the array type only.
   */
  let
  /** Project .value_0 if use_value_0, otherwise .value[0 and 1]
   * or .value if it is not an array.
   * Using .value_0 will probably be faster than array access; it misses the end
   * of the feature interval, but for knowing the limits of the block it will be
   * sufficient.
   */
    group_array = [
      {$project : {
        _id : 1, name: 1, blockId : 1, value : 
        use_value_0 ? "$value_0" : 
          {$cond: { if: { $isArray: "$value" }, then: {$slice : ['$value', 2]}, else: "$value" } }
      }},
      {$unwind : '$value'}, 
      {$match: { $or: [ { value: { $ne: null } } ] } },
      {$group : {
        _id : '$blockId' ,
        featureCount : { $sum: 1 },
        max : { "$max": "$value" }, 
        min : { "$min": "$value" }
      }}
    ],
    /** using .value_0 enables this simpler form, which is faster in tests so far. */
    group_0 = [
      {$group : {
        _id : '$blockId' ,
        featureCount : { $sum: 1 },
        max : { "$max": "$value_0" }, 
        min : { "$min": "$value_0" }
      }}
    ],
  group = use_value_0 ? group_0 : group_array,
  pipeline = blockId ?
    [
      {$match : {blockId :  ObjectId(blockId)}}
    ]
    .concat(group)
  : group;

  if (trace_block > 1) {
    console.log('blockFeatureLimits', pipeline);
  }
  if (trace_block > 2) {
    console.dir(pipeline, { depth: null });

    showExplain('blockFeatureLimits', featureCollection.aggregate ( pipeline, {allowDiskUse: true} ));
  }
  let result =
    featureCollection.aggregate ( pipeline, {allowDiskUse: true} );

  return result;

};


/*----------------------------------------------------------------------------*/

function addField(object, fieldName, value) {
  object[fieldName] = value;
  return object;
}


/** For Blocks of Datasets with the given tag ('QTL'), collate Feature.values.Trait
 * for all Features of those blocks, and group the results by blockId.
 * This is used to present a tree of Trait (Ontology) : parent : block (dataset)
 * in the dataset explorer.  This can be parameterised to support also :
 * Feature.values.Ontology, and other values.
 *
 * @param db connected dataSource
 * @param fieldName 'Trait' or 'Ontology'
 * @return promise yielding cursor	: 
 * ...
 * { "_id" : ObjectId(...), "Traits" : [ "Plant height", "Rust resistance" ] }
 * ...
 */
exports.blockValues = function(db, fieldName) {
  /** $match : exclude copies (meta._origin);  require tags[] to contain 'QTL'.
   * $group : _id : 0, i.e. don't group, combine into a single array.
   */
  let
  cursorP =
    db.collection('Dataset').aggregate([
      {$match : {tags : {$exists: true}, 'meta._origin' : {$exists: false}}},
      {$match : {$expr : {$in : ['QTL', '$tags']}}},
      {
        $group: {
          _id: null,
          'ids': { $push: '$_id' }
        }
      }]).toArray()
    .then((datasets) => {
      let
      datasetIds = flatten(datasets.map((d) => d.ids)),
      blocks =
        db.collection('Block').aggregate([
          {$match : {datasetId : {$in : datasetIds}, 'meta._origin' : {$exists: false}}},
          {
            $group: {
              _id: null,
              'ids': { $push: '$_id' }
            }
          }]).toArray();
      return blocks;
    })
    .then((blocks) => {
      let
      blockIds = flatten(blocks.map((b) => b.ids)),
      fieldNamePlural = (fieldName === 'Ontology') ? 'Ontologies' : fieldName + 's',
      cursor =
        db.collection('Feature').aggregate([
          {$match : {blockId : {$in : blockIds}}},
          {$group : addField({_id : '$blockId'}, fieldNamePlural, {$addToSet : '$values.' + fieldName})}]);
      return cursor;
    });

  return cursorP;
};

// --------------------------------------------------------------------------------

/** clear the blockValues API results (blockFeature{Traits,Ontologies})
 * @see Block.blockValues()
 */
exports.blockFeaturesCacheClear = function blockFeaturesCacheClear(cache)
{
  const fnName = 'blockFeaturesCacheClear';
  ['Trait', 'Ontology'].forEach((fieldName) => {
    let
    apiName = 'blockValues',
    cacheId = apiName + '_' + fieldName;

    let value = cache.get(cacheId);
    if (value) {
      console.log(fnName, cacheId, 'remove from cache', value.length);
      cache.put(cacheId, undefined);
    }
  });

  exports.blockFeatureLimitsCacheClear(cache);
};

exports.blockFeatureLimitsCacheClear = function blockFeatureLimitsCacheClear(cache)
{
  const fnName = 'blockFeatureLimitsCacheClear';
  let
  apiName = 'blockFeatureLimits',
  blockId = undefined,
  cacheId = apiName + '_' + blockId;

  let value = cache.get(cacheId);
  if (value) {
    console.log(fnName, cacheId, 'remove from cache', value.length);
    cache.put(cacheId, undefined);
  }
};


// --------------------------------------------------------------------------------

/** Clear cached result for given cacheId and return the removed result. */
exports.cacheClearKey = function cacheClearKey(cache, cacheId)
{
  const fnName = 'cacheClearKey';

  let value = cache.get(cacheId);
  if (value !== undefined) {
    console.log(fnName, cacheId, 'remove from cache', value.length);
    cache.put(cacheId, undefined);
  }
  return value;
};

//------------------------------------------------------------------------------

exports.cacheblocksFeaturesCounts = cacheblocksFeaturesCounts;
/** Pre-warm the cache of blockFeaturesCounts for each block of this dataset
 * For dense datasets such as Exome SNPs and VCFs, the time taken to count
 * features for the initial zoomed-out blockFeaturesCounts request can be
 * several minutes, and the frontend client will time out in 1min, so pre-warm
 * the cached results for each block.
 * Perform the requests in series because 21 blocks in parallel would compete
 * with each other in-efficiently.
 * @param db
 * @param models
 * @param datasetId
 * @param options
 */
function cacheblocksFeaturesCounts(db, models, datasetId, options) {
  const fnName = 'cacheblocksFeaturesCounts';

  const blockFeaturesCountsP = util.promisify(models.Block.blockFeaturesCounts);

  const
  /// datasetId -> dataset -> parent -> parent blocks
  blocksP = datasetBlocks(models, datasetId),
  parentBlocksP = models.Block.datasetLookup(datasetId, options)
    .then(datasets => datasetBlocks(models, datasets[0].parent)),
  resultP = blocksP
    .then(blocks => parentBlocksP.then(parentBlocks =>
      ensureCounts(blocks, parentBlocks)
    ));

  function ensureCounts(blocks, parentBlocks) {
    console.log(fnName, datasetId, blocks.length);
    const blockCountsP = blocks.reduce((result, block, i) => {
      console.log(fnName, block.id);
      /** select use of blockRecordValue() : blockGet() in blockRecordLookup(). */
      const
      blockId = block.id.toHexString(),
      /** In dev on smaller data parentBlocks is parallel to blocks, but get
       * some re-ordering in a larger db.  Search for matching scope. */
      parentBlock = parentBlocks.find(b => b.scope === block.scope),
      interval = parentBlock?.range;
      if (! interval) {
        console.log(fnName, 'not matched', block.scope, block.name, datasetId, parentBlocks.length);
      } else {
        // maybe : sum counts to check # features in dataset.
        result = result.then((datasetSum) => {
          const
          /** frontend passes useBucketAuto=undefined, and useBucketAuto is
           * included in cacheId, so match that.  interval is required when
           * ! useBucketAuto.
           */
          countsP = blockFeaturesCountsP.apply(
            models.Block,
            [blockId, interval, /*nBins*/100, /*isZoomed*/false,
             /*useBucketAuto*/undefined, options, /*res*/undefined /*,cb*/])
            .then(counts => counts.reduce((blockSum, bin) => blockSum += bin.count, 0))
            .then(blockSum => datasetSum += blockSum);
          return countsP; });
      }
      return result;
    }, Promise.resolve(0));
    return blockCountsP;
  }
  // caller will resultP .then() and .catch()
  return resultP;
}
//------------------------------------------------------------------------------

/** Lookup the blocks of the given datasetId
 * @return a promise yielding [blocks]
 */
function datasetBlocks(models, datasetId) {
  const
  where = {datasetId},
  blocksP = models.Block.find({where}, /*options*/{});
  return blocksP;
}

//------------------------------------------------------------------------------
