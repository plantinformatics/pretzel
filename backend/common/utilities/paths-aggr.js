/*----------------------------------------------------------------------------*/

/* global exports */

/* globals defined in mongo shell */
/* global db print */

/*----------------------------------------------------------------------------*/


/*----------------------------------------------------------------------------*/

/** Determine aliases of features of the given block.
 *
 * Usage e.g. var a = alias2("5b7f8afd43a181430b81394d", 3)
 * @return cursor	aliases
 */
function alias2(blockCollection, blockId, n) {
  /**
   * based on 2nd .aggregate from alias1()
   * developed 31 October  14:48 - 2018-10-31T05:21:57
   * commit [develop 452d7d7] in doc/mongo_functions_alias.js
   */
  var a = blockCollection.aggregate ( [
    { $match : { "_id" : blockId } },
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
    } }
    //, {$unwind: '$feature_aliases' }, { $limit: n }
  ]);

  return a;
}

/*----------------------------------------------------------------------------*/

/**
 * Usage e.g. var bfs = blockFeaturesSet("5b7f8afd43a181430b81394e", 3)
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
exports.paths = function(blockCollection, models, id0, id1, options) {
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
