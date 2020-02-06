var ObjectID = require('mongodb').ObjectID;

/*----------------------------------------------------------------------------*/

/* global exports */

const trace_block = 1;

/** ObjectId is used in mongo shell; the equivalent defined by the node js client library is ObjectID; */
const ObjectId = ObjectID;

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
    matchBlock =
    [
	    { $match :  { "blockId" : {$in : blockIds.map(function (blockId) { return ObjectId(blockId); }) }}},
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


/** Count features of the given block in bins.
 *
 * @param blockCollection dataSource collection
 * @param blockId  id of data block
 * @param nBins number of bins to group block's features into
 *
 * @return cursor	: binned feature counts
 * { "_id" : { "min" : 4000000, "max" : 160000000 }, "count" : 22 }
 * { "_id" : { "min" : 160000000, "max" : 400000000 }, "count" : 21 }
 */
exports.blockFeaturesCounts = function(db, blockId, nBins = 10) {
  // initial draft based on blockFeaturesCount()
  let featureCollection = db.collection("Feature");
  if (trace_block)
    console.log('blockFeaturesCounts', blockId, nBins);
  let ObjectId = ObjectID;

  let
    matchBlock =
    [
      {$match : {blockId :  ObjectId(blockId)}},
      { $bucketAuto: { groupBy: {$arrayElemAt : ['$value', 0]}, buckets: Number(nBins), granularity : 'R5'}  }
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
   */
  let
    group = [
      {$project : {_id : 1, name: 1, blockId : 1, value : {$slice : ['$value', 2]} }},
      {$unwind : '$value'}, 
      {$match: { $or: [ { value: { $ne: null } } ] } },
      {$group : {
        _id : '$blockId' ,
        featureCount : { $sum: 1 },
        max : { "$max": "$value" }, 
        min : { "$min": "$value" }
      }}
    ],
  pipeline = blockId ?
    [
      {$match : {blockId :  ObjectId(blockId)}}
    ]
    .concat(group)
  : group;

  if (trace_block)
    console.log('blockFeatureLimits', pipeline);
  if (trace_block > 1)
    console.dir(pipeline, { depth: null });

  let result =
    featureCollection.aggregate ( pipeline, {allowDiskUse: true} );

  return result;

};


/*----------------------------------------------------------------------------*/
