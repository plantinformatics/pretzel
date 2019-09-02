var ObjectID = require('mongodb').ObjectID;

/*----------------------------------------------------------------------------*/

/* global exports */

/* globals defined in mongo shell */
/* global db ObjectId print */
/*----------------------------------------------------------------------------*/

function toBool(x) {return (typeof x === "string") ? x.toLowerCase().trim() === "true" : x; };

const trace_aggr = 1;

/** ObjectId is used in mongo shell; the equivalent defined by the node js client library is ObjectID; */
const ObjectId = ObjectID;

/*----------------------------------------------------------------------------*/


/** mongo shell script to calculate aliases,
 * doesn't check namespace, only outputs string2
 * 
 * example output :
TraesCS1B01G480400
TraesCS1B01G479800
TraesCS1B01G479700
...
 *
 * @param n to limit result size in testing;  use is commented-out
 * e.g. 
var blockId1 = ObjectId("5b7f8afd43a181430b81394e");
var blockId2 = ObjectId("5b7f8afd43a181430b81394d");
var n = 40; // use of limit n can be commented out after devel
alias1(db.Block, blockId1, blockId2, n)
 */
function alias1(blockCollection, blockId1, blockId2, n) {

var b = blockCollection.aggregate ( [
 { $match : { "_id" : blockId1 } },
 {$lookup: { from: 'Feature', localField: '_id', foreignField: 'blockId', as: 'featureObjects' }}, {$unwind: '$featureObjects' } //, { $limit: n }
, { $group: { _id: null, features : { $addToSet: "$featureObjects.name" } }   }
] );

var bf = new Set();
b.forEach ( function (b0) {b0.features.forEach(function (f) { bf.add(f); }); });

var a = blockCollection.aggregate ( [
 { $match : { "_id" : blockId2 } },
 {$lookup: { from: 'Feature', localField: '_id', foreignField: 'blockId', as: 'featureObjects' }}, {$unwind: '$featureObjects' } // , { $limit: n }
, { $lookup: { from: "Alias", localField: "featureObjects.name", foreignField: "string1", as: "feature_aliases" } }, {$unwind: '$feature_aliases' } // , { $limit: 2 }
, { $group: { _id: null, aliased_features : { $addToSet: "$feature_aliases.string2" } }   }
] );

var i = 0;  a.forEach ( function (a0) {a0.aliased_features.forEach(function (f) { if (bf.has(f) && (i++ < 10)) { print(f);  } }); });
print(i);
}

/** create a temporary collection based on Alias, selecting namespace1 and namespace2.
 * Used in :
 * @see alias1a()
 */
function setup_for_alias1a(namespace1, namespace2) {
  db.Alias.aggregate([
    {$match : {$and : [{ namespace1 : namespace1}, { namespace2 : namespace2 }]}},
    {$out : "aliasesInNamespace" }
  ]);
}
/** @param blockCollection  db.Block in mongo shell, or db.collection("Block") in node
 */
async function blockNamespace0(blockCollection, blockId) {
  /** for node.js, make this function async and await on a promise, resolve instead of return in map. */
  var n = blockCollection.find({_id : ObjectId(blockId)}).map(function (b) { console.log('b=', b); return b.namespace; });
  // or n = ... .find(...).toArray(function (err, items) {console.log(err, items); resolve(items); });
  n = await n;
  let namespace = n.length && n[0];
  console.log('blockNamespace', blockId, n, namespace);
  if (! namespace) {
    debugger;
  }
  return namespace;
}


/** This function can be used in mongo shell; its content is now embodied in pathsAliases().
 * @param domains blockId<i> features are selected within domains[i], for i in [0, 1];
 * i.e. if domains[i][0] <= value[0] && value[1] <= domains[i][1].
 * value[] may have 1, 2, 3 values; if it has 1, then we want to use value[0] in place of value[1];
 * $arrayElemAt : ['$value', -1] is implemented as value[value.length-1], which works for .length == 1 or 2 but not 3.
 */
function alias1a(featureCollection, blockId0, blockId1, domains, n) {
  var namespace0 = blockNamespace(/*blockCollection,*/ blockId0);
  var namespace1 = blockNamespace(/*blockCollection,*/ blockId1);
  var b = featureCollection.aggregate ( [
    { $match : {$expr : {$or : [
      {$and : [{$eq : [ "$blockId", blockId0 ]}, {$gte : [ {$arrayElemAt : ['$value', 0]}, domains[0][0]]}, {$lte : [ {$arrayElemAt : ['$value', 0]}, domains[0][1]]}]},
      {$and : [{$eq : [ "$blockId", blockId1 ]}, {$gte : [ {$arrayElemAt : ['$value', -1]}, domains[1][0]]}, {$lte : [ {$arrayElemAt : ['$value', -1]}, domains[1][1]]}]}
    ]} }},
    // { $limit: n },

    {$lookup:
           {
             from: "Alias", // or aliasesInNamespace
             let: {
               name : "$name"
             },
             pipeline: [
               { $match:
                 { $expr:
                   { $and :
                     [
                       { $eq: [ "$namespace1", namespace0 ] },
                       { $eq: [ "$namespace2", namespace1 ] },
                       { $or:
                         [
                           { $eq: [ "$string1", "$$name" ] },
                           { $eq: [ "$string2", "$$name" ] }
                         ]
                       }
                     ]
                   }
                 }
               }//,
               // { $limit : n },
               // { $project: { _id : 1 } }
             ],
             as: "feature_aliases"
           }
    },
    {$match : {$expr: {$gt: [{$size: "$feature_aliases"}, 0]}}},

    { $unwind: '$feature_aliases' }, // { $limit: n },
    // { $lookup: { from: "Feature", localField: "features_alias._id", foreignField: "_id", as: "aliased_feature" } }
 { $group: { _id: "$feature_aliases._id", aliased_features :  {$push : '$$ROOT'} }   },
 {$match : {$expr: {$gt: [{$size: "$aliased_features"}, 1]}}}
  ]) .pretty();

  return b;
}

/*----------------------------------------------------------------------------*/

/** Determine aliases of features of the given block.
 *
 * The result is equivalent to alias1a(), but this is slower, so alias1a() is
 * used as the basis for pathsAliases().  This can be used for verification etc.
 *
 * Usage in mongo shell   e.g.
 DBQuery.shellBatchSize = 3;
 var blockId0 = ObjectId("5cc69ed7de8ab9393f45052c");
 var blockId1 = ObjectId("5cc69ed7de8ab9393f45052d");
 var a = alias2(db.Block, blockId0, blockId1, 40)
 a.next()
 *
 * @return cursor	of { block attributes, featureObjects, feature_aliases, aliased_feature }
 */
function alias2(blockCollection, blockId0, blockId1, n) {
  /**
   * based on 2nd .aggregate from alias1()
   * developed 31 October  14:48 - 2018-10-31T05:21:57
   * commit [develop 452d7d7] in doc/mongo_functions_alias.js
   */
  var a = blockCollection.aggregate ( [
    { $match : { "_id" : blockId0 } },
    {$lookup: { from: 'Feature', localField: '_id', foreignField: 'blockId', as: 'featureObjects' }}, {$unwind: '$featureObjects' }, { $limit: n }
    , { $lookup: { from: "Alias", localField: "featureObjects.name", foreignField: "string1", as: "feature_aliases" } }
    , { "$project": {
      // "_id" : 0,
      "feature_aliases": { "$slice": ["$feature_aliases", n] },
      "scope" : 1,
      "name" : 1,
      "namespace" : 1,
      "datasetId" : 1,
      "featureType" : 1,
      "featureObjects" : 1
    } },
    {$unwind: '$feature_aliases' }, { $limit: n },
    {$match : {$expr : {$or : [{$eq : [ "$namespace", "$feature_aliases.namespace1" ]  } ]  } } },

    { $lookup: { from: "Feature", localField: "feature_aliases.string2", foreignField: "name", as: "aliased_feature" } },
    {$unwind: '$aliased_feature' }, { $limit: n },

    {$match : {$expr : {$or : [{$eq : [ "$aliased_feature.blockId", blockId1 ]  } ]  } } },

  ]);

  return a;
}

/*----------------------------------------------------------------------------*/

/**
 * Usage in mongo shell   e.g. var bfs = blockFeaturesSet(ObjectId("5b7f8afd43a181430b81394e"), 3);
 * var blockCollection = db.Block;
 */
function blockFeaturesSet(blockCollection, blockId, n) {
	// based on first half of alias1()
	var b = blockCollection.aggregate ( [
		{ $match : { "_id" : blockId } },
		{$lookup: { from: 'Feature', localField: '_id', foreignField: 'blockId', as: 'featureObjects' }}, {$unwind: '$featureObjects' }, { $limit: n }
		, { $group: { _id: null, features : { $addToSet: "$featureObjects.name" } }   }
	] );

	var bf = new Set();
	b.forEach ( function (b0) {b0.features.forEach(function (f) { bf.add(f); }); });
	return bf;
}

/*----------------------------------------------------------------------------*/

function aliasesTo(blockCollection, blockA, blockB)
{
  /** blockA : 1A : "5b7f8afd43a181430b81394d"
   * blockB : 1B : "5b7f8afd43a181430b81394e"
   */
  let a = alias2(blockCollection, blockA, 3 );
  let ai= a.next() ;
  let a2= a.next() ;

  let bfs = blockFeaturesSet(blockCollection, blockB, 30000);

  let aliases = [];
  a2.feature_aliases.forEach(
    function (fa) {
      if (bfs.has(fa.string2)) {
        aliases.push(fa);
        // print (fa.string2);
      }
    }
  );
  return aliases;
}
exports.paths = function(blockCollection, id0, id1, options) {
  /** also aliasesTo(id1, id0) */
  let aliases = aliasesTo(blockCollection, id0, id1),
  links = aliases.map(function (a) { return {
    // map to same format as task.js:add_link()
    featureA: a.string1, 
    featureB: a.string2, 
    aliases: [{evidence: a.evidence}]
  };});

  return links;
};

/*----------------------------------------------------------------------------*/

/** Calculations to support selecting a subset of the results, sized to meet the
 * screen display space.
 *
 * This calculation seems workable for getting a subset of features of a block,
 * because the # of features in a block can be determined efficiently using the
 * index, but getting a subset of paths between 2 blocks has the complication
 * that the # of paths can't be predicted.
 * So something like this will probably be used ... still a work in progress.
 *
user slider density factor : increase density by 1/2 * or 2 *
count = # features in domain interval / (screen pixel interval / 5px)
Want to take 1 feature per count.
Have count on both B0 & B1 so calc sqrt(count0 * count1), round to integer.
 */
function densityCount(totalCounts, intervals) {
  if (trace_aggr)
    console.log('totalCounts DC => ', totalCounts);
  // console.log('intervals.axes => ', intervals.axes);
  let pixelspacing = 5;
  // using total in block instead of # features in domain interval.
  function blockCount(total, domain, range) {
    if (trace_aggr)
      console.log('total, domain, range => ', total, domain, range);
    return total * pixelspacing / (range[1] - range[0]);
  }
  let count,
  counts = [0, 1].map(i => {
    return blockCount(totalCounts[i], intervals.axes[i].domain, intervals.axes[i].range);
  });
    /* intervals.axes.map(function (interval) {   })*/
  count = Math.sqrt(counts[0] * counts[1]);
  count = count / intervals.page.thresholdFactor;
  count = Math.round(count);
  if (trace_aggr)
    console.log('densityCount', count, intervals);
  return count;
}

function blockFeatures(db, blockId) {
  let featureCollection = db.collection("Feature");
  // console.log('blockFeatures', db, featureCollection);
  let nFeatures = featureCollection
    // .countDocuments( )
    .aggregate([
      { $match: {blockId : ObjectID(blockId)} },
      { $group: { _id: null, n: { $sum: 1 } } }
    ]);
  nFeatures = nFeatures.toArray();
  if (trace_aggr)
    nFeatures.then(function (v) { console.log(`Features for ${blockId} => `, v[0].n); });
  // .estimatedDocumentCount()
  return nFeatures;
}

/*----------------------------------------------------------------------------*/
// construct pipeline from intervals param.  developed within pathsDirect() then
// split out for use in blockFeaturesInterval().

function keyValue (k,v) { let r = {}; r[k] = v; return r; };
/** construct the expression for one end of the interval constraint on 1 block
 * @param b 0 for blockId0, axes[0]
 * @param l limit : 0 for domain[0] and lte, 1 for domain[1] and gte
 */
function valueBound(intervals, b, l) {
  let r = keyValue(
    l ? '$lte' : '$gte',
    [ keyValue('$arrayElemAt', ['$value', l ? -1 : 0]),
      +intervals.axes[b].domain[l]]
  );
  return r;
};
/** If axis b is zoomed, append conditions on location (value[]) to the given array eq.
 *
 * If the axis has not been zoomed then Stacked : zoomed will be undefined,
 * and the result of axisDimensions() will include zoomed:undefined, which is
 * omitted in the API URL, so a.hasOwnProperty('zoomed') can be false.
 *
 * @param intervals interval params
 * @param eq  first part of block condition; append to this array and return result
 * @param b axis index - 0 or 1
 * @return array
 */
function blockFilter(intervals, eq, b) {
  if (! intervals.axes || ! intervals.axes[b]) {
    console.log('blockFilter', intervals, eq, b);
  }
  let a = intervals.axes[b],
  /** if axisBrush, then zoom is not required. */
  axisBrush = intervals.axes.length === 1,
  r = (axisBrush || a.zoomed) && a.domain ?
    eq.concat([valueBound(intervals, b, 0), valueBound(intervals, b, 1)]) :
    eq;
  return r;
};
/*----------------------------------------------------------------------------*/

/** The interval params passed to .pathsDirect() and .blockFeaturesInterval()
 * may have the value 'false' which is truthy, so convert flags to boolean
 * values.
 *
 * This function does not return a result - the raw 'false' values could cause
 * bugs if they are inadvertently used.
 */
function parseIntervalFlags(intervals) {
  intervals.axes.forEach(function (a) {
    if (a.zoomed)
      a.zoomed = toBool(a.zoomed);
  });
  if (intervals.dbPathFilter)
    intervals.dbPathFilter = toBool(intervals.dbPathFilter);
}

/*----------------------------------------------------------------------------*/

/** Construct the start of the aggregate pipeline for pathsDirect() and pathsAliases().
 * This part starts from a db.Feature.aggregate() (in pipelineLimits()), selects
 * to match either block, and also filters by feature value (location) if
 * intervals.axes[i] defines zoomed / domain.
 */
function featuresByBlocksAndDomains(blockId0, blockId1, intervals) {
  /* Earlier version (until aa9c2ed) matched Blocks first, then did lookup() to
   * join to Features; changed so that the first step in .aggregate() filters
   * locations based on blockId, thus getting the benefit of the Feature index,
   * and also optionally Feature location, against intervals.axes[].domain[].
   */
  let
    matchBlock =
    [
	    { $match :  {
        $or : [{ "blockId" : ObjectId(blockId0) },
               { "blockId" : ObjectId(blockId1) }]}}
    ],

  /** filter : value[0] and value[1] should be within :
   * blockId0 : [intervals.axes[0].domain[0], intervals.axes[0].domain[1]]
   * blockId1 :  [intervals.axes[1].domain[0], intervals.axes[1].domain[1]]
   * This incorporates the blockId match - matchBlock, above.
   *
   * This tests if the feature interval is in the filter interval; a better test
   * would allow for part of the feature interval to lie outside the filter
   * interval; i.e. (f0 < d0) !== (f1 < d1) or-ed with (current) :
   * (f0 > d0) && (f1 < d1)
   */
  filterValue =
    [
      { $match : {$expr : {$or : [
        {$and : blockFilter(intervals, [{$eq : [ "$blockId", ObjectId(blockId0) ]}], 0) },
        {$and : blockFilter(intervals, [{$eq : [ "$blockId", ObjectId(blockId1) ]}], 1) },
      ]} }},
    ];
  /** The aggregate pipeline is assembled in this array. */
  let pipeline;

  let dbPathFilter = intervals.dbPathFilter;
  let useDomainFilter = dbPathFilter && (intervals.axes[0].zoomed || intervals.axes[1].zoomed);
  pipeline = useDomainFilter ? filterValue : matchBlock;

  if (useDomainFilter) {
    if (trace_aggr)
      log_filterValue_intervals(filterValue, intervals);
  }

  return pipeline;
};


/** Match features by name between the 2 given blocks.  The result is the alignment, for drawing paths between blocks.
 * Usage in mongo shell  e.g.
 *  db.Block.find({"scope" : "1A"})  to choose a pair of blockIds
 *  var blockId1 = ObjectId("5b74f4c5b73fd85c2bcbc660");
 *  var blockId0 = ObjectId("5b74f4c5b73fd85c2bcb97f9");
 *  var n = 10 ;
 *  var featureCollection = db.Feature, instead of db.collection("Feature")
 *  pathsDirect(db, blockId0, blockId1, n)
 *
 * @param db dataSource
 * @param blockId0, blockId1 If the paths sought are symmetric, then pass blockId0 < blockId1.
 * @param intervals  domain and range of axes, to limit the number of features in result.
 * If intervals.dbPathFilter then intervals.axes[{0,1}].domain[{0,1}] are included in the aggregrate filter.
 * The domain[] is in the same order as the feature.value[], i.e. increasing order : 
 * domain[0] < domain[1] (for all intervals.axes[]).
 * @return cursor	: direct paths
 */
exports.pathsDirect = function(db, blockId0, blockId1, intervals) {
  parseIntervalFlags(intervals);
  let featureCollection = db.collection("Feature");
  if (trace_aggr)
    console.log('pathsDirect', /*featureCollection,*/ blockId0, blockId1, intervals);

  if (false) {  // work in progress @see densityCount()
    let totalCounts = [blockId0, blockId1].map((blockId) => {
      return blockFeatures(db, blockId);
    });
    let count
    Promise.all(totalCounts)
    .then(totalCounts => {
      totalCounts = totalCounts.map(item => item[0].n)
      count = densityCount(totalCounts, intervals)
      console.log('count => ', count);
    })
    // Note: an "await" on this function will work if the whole method is an async method
    // console.log('count 2 => ', count);

  }

  let pipeline = featuresByBlocksAndDomains(blockId0, blockId1, intervals),

  group = 
    [
	    { $group: {
        _id: {name : '$name', blockId : '$blockId'},
        features : { $push: '$$ROOT' },
        count: { $sum: 1 },
      }   }

      , { $group: {
        _id: { name: "$_id.name" },
        alignment: { $push: { blockId: '$_id.blockId', repeats: "$$ROOT" }}
      }}

      , { $match : { alignment : { $size : 2 } }}
    ];

  pipeline = pipeline.concat(group);
  if (trace_aggr > 1)
    console.dir(pipeline, { depth: null });

  let result = pipelineLimits(featureCollection, intervals, pipeline);

  return result;
};
/** Match features by name between the 2 given blocks.  The result is the alignment, for drawing paths between blocks.
 *
 * This implements alias1a() above - this function is used in the node server,
 * whereas alias1a() is useful for prototyping changes directly in mongo shell
 * during development. (alias1a() could be used in the node server, but instead
 * featuresByBlocksAndDomains() is factored out.)
 *
 * @param blockId0, blockId1 If the paths sought are symmetric, then pass blockId0 < blockId1.
 * @param namespace0,  namespace1,  namespaces of blockId0 and blockId1
 * @param intervals  domain and range of axes, to limit the number of features in result.
 * If intervals.dbPathFilter then intervals.axes[{0,1}].domain[{0,1}] are included in the aggregrate filter.
 * The domain[] is in the same order as the feature.value[], i.e. increasing order : 
 * domain[0] < domain[1] (for all intervals.axes[]).
 * @return cursor	: direct paths
 */
exports.pathsAliases = function(db, blockId0, blockId1, namespace0,  namespace1, intervals) {
  parseIntervalFlags(intervals);
  let featureCollection = db.collection("Feature");
  let blockCollection = db.collection("Block");
  if (trace_aggr)
    console.log('pathsAliases', blockId0, blockId1, namespace0,  namespace1, intervals);
  let pipeline = featuresByBlocksAndDomains(blockId0, blockId1, intervals);

  /** lookup aliases of the feature, group by alias id, match when both features
   * of the alias have looked it up.
   * The data has aliases between gene names which are specific to a chromosome
   * (block), so does not contain aliases within a block, so if both features
   * of the alias have looked it up then the alias is between the 2 requested
   * blocks.
   */
  let group = 
    [
      {$lookup:
       {
         from: "Alias", // or aliasesInNamespace
         let: {
           name : "$name"
         },
         pipeline: [
           { $match:
             { $expr:
               { $and :
                 [
                   { $or:
                     [
                       { $and :
                         [
                           { $eq: [ "$namespace1", namespace0 ] },
                           { $eq: [ "$namespace2", namespace1 ] }
                         ]
                       },
                       { $and :
                         [
                           { $eq: [ "$namespace2", namespace0 ] },
                           { $eq: [ "$namespace1", namespace1 ] }
                         ]
                       }
                       ]
                   },
                   { $or:
                     [
                       { $eq: [ "$string1", "$$name" ] },
                       { $eq: [ "$string2", "$$name" ] }
                     ]
                   }
                 ]
               }
             }
           }//,
           // { $limit : n },
           // { $project: { _id : 1 } }
         ],
         as: "feature_aliases"
       }
      },
      {$match : {$expr: {$gt: [{$size: "$feature_aliases"}, 0]}}},
      { $unwind: '$feature_aliases' }, // { $limit: n },

      { $group: { _id: "$feature_aliases._id", aliased_features :  {$push : '$$ROOT'} }   },
      {$match : {$expr: {$gt: [{$size: "$aliased_features"}, 1]}}},
    ];

  pipeline = pipeline.concat(group);
  if (trace_aggr > 1)
    console.dir(pipeline, { depth: null });

  let result = pipelineLimits(featureCollection, intervals, pipeline);

  return result;
};

/** log the given filterValue, (which is derived from) intervals */
function log_filterValue_intervals(filterValue, intervals) {
    let l = ['filterValue', filterValue];
    intervals.axes.map(function (a) {
      /** log a.{zoomed,domain}  .domain may be undefined or [start,end]. */
      l.push(a.zoomed);
      if (a.domain)
        l = l.concat([a.domain[0], '-', a.domain[1]]);
    });
    console.log.apply(undefined, l);
}

function pipelineLimits(featureCollection, intervals, pipeline) {
  // console.log('intervals.nSamples => ', intervals.nSamples);
  if (intervals.nSamples)
    pipeline.push({ '$sample' : {size : +intervals.nSamples}});
  if (intervals.nFeatures !== undefined)
    pipeline.push({ $limit: +intervals.nFeatures });

  let result =
    featureCollection.aggregate ( pipeline, {allowDiskUse: true} );

  return result;
};

/** Collect features of the given block, possibly constrained to the optional domain interval.
 *
 * If intervals.nSamples is not given, calculate it from densityFactor *
 * axisInterval.range / pixelspacing; this provides an even spread of features
 * with the required density across the specified domain.  (This logic could be
 * moved to the client side.)
 *
 * @param blockCollection dataSource collection
 * @param blockIds  ids of data blocks
 * @param intervals  domain and range of axis of block, to limit the number of features in result.

 * @return cursor	: features
 */
exports.blockFeaturesInterval = function(db, blockIds, intervals) {
  parseIntervalFlags(intervals);
  let featureCollection = db.collection("Feature");
  if (trace_aggr)
    console.log('blockFeaturesInterval', /*featureCollection,*/ blockIds, intervals);
  let ObjectId = ObjectID;

  let
    matchBlock =
    [
	    { $match :  { "blockId" : {$in : blockIds.map(function (blockId) { return ObjectId(blockId); }) }}}
    ],

  blockFilters = blockIds.map(function (blockId) {
    return {$and : blockFilter(intervals, [{$eq : [ "$blockId", ObjectId(blockId) ]}], 0) };
  }),
  filterValue =
    [
      { $match : {$expr : {$or : 
        blockFilters
      } }},
    ];


  let pipeline;

  let axisInterval = intervals.axes[0];
  let dbPathFilter = toBool(intervals.dbPathFilter);
  // .zoomed does not need to be true - features are requested when axis is
  // brushed;   does not wait for user to click zoom.
  if (dbPathFilter && intervals.axes[0].domain) {
    if (trace_aggr)
      log_filterValue_intervals(filterValue, intervals);
    pipeline = filterValue;
  }
  else
    pipeline = matchBlock;

  if (trace_aggr)
    console.log('blockFeaturesInterval', pipeline);
  if (trace_aggr > 1)
    console.dir(pipeline, { depth: null });

  if (intervals.nSamples === undefined) {
    /** possibly same value as in @see densityCount() */
    let pixelspacing = 5;
    let nSamples = intervals.page.densityFactor * axisInterval.range / pixelspacing;
    console.log(
      axisInterval, intervals.page.densityFactor, axisInterval.range, 'nSamples', nSamples
    );
    intervals.nSamples = nSamples;
  }
  // if (intervals.nSamples < intervals.nFeatures) then $limit could be omitted.
  let result = pipelineLimits(featureCollection, intervals, pipeline);

  return result;
};


/* example output; contains ObjectId() which is defined in mongo shell, not in
 * node.js, so wrap with if (false) { } */
if (false) {
var example_output_pathsDirect = 
  { "_id" : { "name" : "RAC875_rep_c72774_131" },
    "alignment" : [
      { "blockId" : ObjectId("5b74f4c5b73fd85c2bcb97f9"), "repeats" : {
        "_id" : { "name" : "RAC875_rep_c72774_131", "blockId" : ObjectId("5b74f4c5b73fd85c2bcb97f9") },
        "features" : [
          /* When the data is cleaned up it won't contain these duplicates, but if the .aggregrate can filter them out without a significant performance cost it should do so. */
          { "_id" : ObjectId("5b74f4c5b73fd85c2bcb98f4"), "name" : "RAC875_rep_c72774_131", "value" : [ 37.07 ], "blockId" : ObjectId("5b74f4c5b73fd85c2bcb97f9") },
          { "_id" : ObjectId("5b74f4c5b73fd85c2bcb98f9"), "name" : "RAC875_rep_c72774_131", "value" : [ 37.07 ], "blockId" : ObjectId("5b74f4c5b73fd85c2bcb97f9") },
          { "_id" : ObjectId("5b74f4c5b73fd85c2bcb98fa"), "name" : "RAC875_rep_c72774_131", "value" : [ 37.07 ], "blockId" : ObjectId("5b74f4c5b73fd85c2bcb97f9") } ], "count" : 3 } },
      { "blockId" : ObjectId("5b74f4c5b73fd85c2bcbc660"), "repeats" : {
        "_id" : { "name" : "RAC875_rep_c72774_131", "blockId" : ObjectId("5b74f4c5b73fd85c2bcbc660") },
        "features" : [ {
          "_id" : ObjectId("5b74f4c5b73fd85c2bcbc7bb"), "value" : [ 98 ], "name" : "RAC875_rep_c72774_131", "blockId" : ObjectId("5b74f4c5b73fd85c2bcbc660") } ], "count" : 1 } } ] }
/* { "_id" : { "name" : "wsnp_Ex_c4612_8254533" },
   ...  } */
  ;
}


/*----------------------------------------------------------------------------*/

/** Count Features within evenly sized bins (buckets) on the given block.
 * Usage e.g.
 *  var blockId="5b74f4c5b73fd85c2bcb97f9";
 *  ...
 *  var blockCollection = db.Block
 *  blockBinFeatureCount(blockCollection, blockId, 200)
 * Defaults for nBuckets and granularity are 200 and 'E192', which produces a reasonable number of buckets.
 *
 * @param blockCollection db.Block or dataSource.connector.collection("Block")
 * @param blockId
 * @param nBuckets
 * @param granularity
 * @return cursor	: feature counts
 */
function blockBinFeatureCount(blockCollection, blockId, nBuckets, granularity) {
  if (nBuckets === undefined)
    nBuckets = 200;
  if (granularity)
    granularity = 'E192';
  let result =
    blockCollection.aggregate ( [
	    {$match : { "_id" : ObjectId(blockId) } },
	    {$lookup: { from: 'Feature', localField: '_id', foreignField: 'blockId', as: 'featureObjects' }},
      {$unwind: '$featureObjects' },
      { $bucketAuto: { groupBy: {$arrayElemAt : ['$featureObjects.value', 0]}, buckets: nBuckets, granularity : granularity}  }
      , { $limit: 3 } // remove or comment-out after devel.
    ] );
  return result;
}


/*----------------------------------------------------------------------------*/
