const { pick } = require('lodash/object');

const { model2db } = require('../utilities/localise-blocks');

/* global require */
/* global exports */

//------------------------------------------------------------------------------

const trace = 1;

//------------------------------------------------------------------------------

/** Insert the given array of aliases.
 * @param dataset result of sheetToAliases()
 * @param models for Alias collection
 */
exports.loadAliases = async function(dataset, models) {
  // related : localiseBlocksAndAliases()
  const
  fnName = 'loadAliases',
  aliases = dataset.aliases,
  /** need collection rather than model for .insertMany() */
  db = await model2db(models.Alias),
  aliasCollection = db.collection('Alias');
  let promise;

  /**	-	split into 3 groups, according to optional columns 'Replace' and 'Delete',
   * and process each separately with different options / functions.
   */
  if (dataset.metadata.delete) {
    const
    fieldNames = ['string1', 'string2', 'namespace1', 'namespace2'],
    deleteAllP = aliases.map((a) => {
      const
      where = pick(a, fieldNames),
      deleteP = models.Alias.find({where})
        .then(
          (persistedModels) => 
            /** handle multiple matches, although loadAliases() should not created duplicate. */
          aliasCollection.deleteMany(
            { _id: { $in: persistedModels.map((i) => i.getId()) } },
            function(err, obj) { if (err) { throw err; } }));
      return deleteP;
    });
    promise = Promise.all(deleteAllP);
  } else {
    const
    replace = dataset.metadata.replace,
    /** this has no effect - both insert a new copy of the alias regardless of
     * whether it is already in the database.  Can use bulkWrite / upsert. */
    options = replace ? {} : {ordered : false};
    promise =
      aliasCollection.insertMany(aliases, options)
      .then((result) => result.insertedCount);
  }

  return promise;
};

//------------------------------------------------------------------------------
