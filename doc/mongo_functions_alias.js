/*----------------------------------------------------------------------------*/

/* globals defined in mongo shell */
/* global db ObjectId print */
/*----------------------------------------------------------------------------*/

function alias1(n) {

var b = db.Block.aggregate ( [
 { $match : { "_id" : ObjectId("5b7f8afd43a181430b81394e") } },
 {$lookup: { from: 'Feature', localField: '_id', foreignField: 'blockId', as: 'featureObjects' }}, {$unwind: '$featureObjects' } //, { $limit: n }
, { $group: { _id: null, features : { $addToSet: "$featureObjects.name" } }   }
] )

var bf = new Set();
b.forEach ( function (b0) {b0.features.forEach(function (f) { bf.add(f); }); });

var a = db.Block.aggregate ( [
 { $match : { "_id" : ObjectId("5b7f8afd43a181430b81394d") } },
 {$lookup: { from: 'Feature', localField: '_id', foreignField: 'blockId', as: 'featureObjects' }}, {$unwind: '$featureObjects' } // , { $limit: 2 }
, { $lookup: { from: "Alias", localField: "featureObjects.name", foreignField: "string1", as: "feature_aliases" } }, {$unwind: '$feature_aliases' } // , { $limit: 2 }
, { $group: { _id: null, aliased_features : { $addToSet: "$feature_aliases.string2" } }   }
 ] )

var i = 0;  a.forEach ( function (a0) {a0.aliased_features.forEach(function (f) { if (bf.has(f) && (i++ < 10)) { print(f);  } }); });
print(i);
}

/*----------------------------------------------------------------------------*/
/*
 * based on 2nd .aggregate from alias1()
 * developed 31 October  14:48 - 2018-10-31T05:21:57
 * Usage e.g. var a = alias2("5b7f8afd43a181430b81394d", 3)
 */
function alias2(blockId, n) {
 var a = db.Block.aggregate ( [
 { $match : { "_id" : ObjectId(blockId) } },
 {$lookup: { from: 'Feature', localField: '_id', foreignField: 'blockId', as: 'featureObjects' }}, {$unwind: '$featureObjects' }, { $limit: n }
, { $lookup: { from: "Alias", localField: "featureObjects.name", foreignField: "string1", as: "feature_aliases" } }
, { "$project": { "_id" : 0, "feature_aliases": { "$slice": ["$feature_aliases", n] },
    "_id" : 1,
    "scope" : 1,
    "name" : 1,
    "namespace" : 1,
    "datasetId" : 1,
    "featureType" : 1,
    "featureObjects" : 1
 } }
//, {$unwind: '$feature_aliases' }, { $limit: n }
]);

  return a;
}

/*----------------------------------------------------------------------------*/

/**
 * Usage e.g. var bfs = blockFeaturesSet("5b7f8afd43a181430b81394e", 3)
 */
function blockFeaturesSet(blockId, n) {
	// based on first half of alias1()
	var b = db.Block.aggregate ( [
		{ $match : { "_id" : ObjectId(blockId) } },
		{$lookup: { from: 'Feature', localField: '_id', foreignField: 'blockId', as: 'featureObjects' }}, {$unwind: '$featureObjects' }, { $limit: n }
		, { $group: { _id: null, features : { $addToSet: "$featureObjects.name" } }   }
	] );

	var bf = new Set();
	b.forEach ( function (b0) {b0.features.forEach(function (f) { bf.add(f); }); });
	return bf;
}

/*----------------------------------------------------------------------------*/
