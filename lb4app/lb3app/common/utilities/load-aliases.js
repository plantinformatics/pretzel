const { pick } = require('lodash/object');

const { model2db } = require('../utilities/localise-blocks');

/* global require */
/* global exports */

//------------------------------------------------------------------------------

const trace = 1;

/** identity function, same comment as in spreadsheet-read.js */
const I = (x) => x;

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
  if (stringToBoolean(dataset.metadata.delete)) {
    const
    fieldNames = ['string1', 'string2', 'namespace1', 'namespace2', 'datasetId'],
    deleteAllP = aliases
      .map((a) => {
        const
        where = pick(a, fieldNames);
        if (Object.keys(where).length < 5) {
          console.log(fnName, a, 'does not have all 5 required fields');
        }
        return where;
      })
      .filter(I)
      .map((where) => {
        const
        deleteP =
          models.Alias.find({where})
          .then(
            (persistedModels) => 
              /** handle multiple matches, although loadAliases() should not created duplicate. */
            aliasCollection.deleteMany(
              { _id: { $in: persistedModels.map((i) => i.getId()) } }) )
          .then((obj) => {
            console.log(fnName, 'deleted', obj.result);  return obj.result;  } );
      return deleteP;
    });
    promise = Promise.all(deleteAllP)
      .then(
        (counts) => counts.reduce(
          (sum, nOk) => { sum.n += nOk.n; sum.ok += nOk.ok; return sum; },
          {n : 0, ok : 0}));
  } else {
    const
    replace = stringToBoolean(dataset.metadata.replace),
    /** this has no effect - both insert a new copy of the alias regardless of
     * whether it is already in the database.  Can use bulkWrite / upsert. */
    options = replace ? {} : {ordered : false};
    console.log(fnName, aliases.length, options);
    promise =
      aliasCollection.insertMany(aliases, options)
      .then((result) => result.insertedCount);
  }

  return promise;
};

//------------------------------------------------------------------------------

/** Used for boolean flag values, e.g. in metadata : dataset.metadata.delete
 *
 * Related : frontend/app/utils/common/strings.js:toBool(); 
 * using JSON.parse() here is more general, and toBool may return x with unknown type.
 */
function stringToBoolean(text) {
  const value = ((text === undefined) || (text === '')) ? false : JSON.parse(text.toLowerCase());
  return value;
}

//------------------------------------------------------------------------------
