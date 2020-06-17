var _ = require('lodash');

const bent = require('bent');
const param = require('jquery-param');

const { ApiServer, apiServers, blockServer } = require('./api-server');

/* global require */
/* global exports */

var { localiseBlocks } = require('./localise-blocks');

/** limit the # aliases in the result of /api/namespacesAliases : getAliases(). */
const namespacesAliasesLimit = 1e5;

const trace = 1;


/** Get all aliases between the 2 given namespaces, which may be the same.
 * @param blockId0, blockId1 one of these is a reference to a remote block.
 * The getAliases request is sent to the server of that remote block.
 * @param namespace0,  namespace1,  namespaces of blockId0 and blockId1 (see pathsAliases).
 * @param intervals passed to localiseBlocks()
 * @return promise yielding localised form of params [blockId0, blockId1]
 */
exports.localiseBlocksAndAliases = function(db, models, blockId0, blockId1, namespace0,  namespace1, intervals) {
  const fnName = 'localiseBlocksAndAliases';
  let promise;
  let blockIds = [blockId0, blockId1];
  /** Current scope is for <=1 of blockIds to be a remote reference, and the remainder local. */
  let servers = blockIds.map((blockId) => blockServer(blockId))
  /** filter out undefined (local reference). */
    .filter((s) => s);
  if (servers.length === 0) {
    // blockIds are local, nothing to do
    promise = Promise.resolve(blockIds);
  }
  else if (servers.length > 1) {
    console.warn('localiseBlocksAndAliases', 'expected <= 1 remote blocks', blockId0, blockId1);
    promise = Promise.reject();
  }
  else {
    let
      apiServer = servers[0],
    /** call getAliases */
    aliases = remoteNamespacesAliasesValue(db, apiServer, [namespace0, namespace1]);
    promise = aliases.then(() => localiseBlocks(models, [blockId0, blockId1], intervals));
  }
  return promise;
};

/** Wrap addAliases(), catch duplicate key and don't treat it as an error.
 */
function addAliasesMaybeDup(db, apiServer, aliases) {
  const fnName = 'addAliasesMaybeDup';
  console.log('aliases', aliases.length);
  /* aliases[*].namespace0,1 matches params namespace0,1.       */
  let addP = addAliasesChunks(db, aliases, apiServer)
    .then((insertedCount) => { console.log('after addAliases', insertedCount); return insertedCount; })
  // trace the promise outcomes
    .then(
      /** For those aliases which are already loaded, the result will be a write error
       */
      function (result) {
        console.log(fnName, '() cb', result);
      })
    .catch(function (err) {
      console.log('addAliasesMaybeDup err', err.message, err.code);
      if (err.writeErrors) console.log(err.writeErrors.length, err.writeErrors[0]);
      if (err.code === 11000) {
        let dupCount = err.writeErrors && err.writeErrors.length || 0;
        return Promise.resolve(aliases.length - dupCount);
      }
      else return Promise.reject(err);
    });
  return addP;
}

/** Wrap addAliases() - split aliases[] into chunks if large.
 * Work-around a limit on inserting many aliases.
 * Alias.bulkCreate (backend/common/models/alias.js) does not have this problem;
 * seems the only difference is ordered:false here.
 * error is : UnhandledPromiseRejectionWarning: MongoError: BSONObj size: 16960202 (0x102CACA) is invalid. Size must be between 0 and 16793600(16MB) First element: insert: "Alias"
 */
function addAliasesChunks(db, aliases, apiServer) {
  console.log('addAliasesChunks', aliases.length /*,aliases[0]*/);
  let chunks = _.chunk(aliases, 1e4),
  promises = chunks.map((c) => addAliases(db, c, apiServer));
  return Promise.all(promises);
};
/** Cache the aliases which have been received from a secondary server.
 * Any of these aliases which are already loaded, i.e. if the key fields match
 * an alias already loaded, will not be loaded.
 *
 * Augment the alias data with .origin{host and imported (time)} to indicate
 * these are cached aliases from a secondary server; this enables them to be
 * removed after their cache expiry time.
 *
 * @param aliases array of alias data received.  This function modifies each alias, adding .origin.
 * @return promise, yielding count of aliases inserted.
 * @desc
 * similar to models/alias.js : Alias.bulkCreate()
 */
function addAliases(db, aliases, apiServer) {
  console.log('addAliases', aliases.length /*,aliases[0]*/);
  let origin = apiServer.makeOrigin();
  let augmented = aliases.map((a) => {
    a.origin = origin;
    return a;
  });
  console.log('augmented', augmented.length, augmented[0]);
    
  /** duplicates don't prevent insertion of following documents, because of option ordered : false  */
  let promise =
    db.collection('Alias').insertMany(augmented, {ordered : false})
    .then((result) => result.insertedCount);
  return promise;
}

/*----------------------------------------------------------------------------*/

/** call remoteNamespacesGetAliases() if not already requested.
 */
function remoteNamespacesAliasesValue(db, apiServer, namespaces) {
  console.log('remoteNamespacesAliasesValue', namespaces);
  let requests = apiServer.requests.aliases || (apiServer.requests.aliases = {}),
  requestId = namespaces.join(','),
  promise = requests[requestId] ||
    (requests[requestId] = remoteNamespacesGetAliases(apiServer, namespaces)
     .then((aliases) => ! aliases.length || addAliasesMaybeDup(db, apiServer, aliases)));
  return promise;
}
/** from apiServer, get aliases between the given namespaces
 */
function remoteNamespacesGetAliases(apiServer, namespaces)
{
  console.log('remoteNamespacesGetAliases', namespaces);
  let
  host = apiServer.host,
  accessToken = apiServer.accessToken;

  const getJSON = bent(host, 'json');

  let queryParams = param({namespaces, limit : namespacesAliasesLimit, access_token : accessToken}),
  headers = {'Authorization' : accessToken},
  endPoint = '/api/Aliases/namespacesAliases';

  console.log(host, endPoint, namespaces, accessToken);
  let promise =
    getJSON(endPoint + '?' + queryParams, /*body*/undefined, headers);
  promise.then((aliases) => console.log('remoteNamespacesGetAliases', aliases.length));
  return promise;
}




/** This function is the endpoint called by the above
 * remoteNamespacesGetAliases(), i.e. this is the server side and the above is
 * the client.
 *
 * @param namespaces  array[2] of string; aliases whose .namespace{1,2} do not
 * match (in either order) are filtered out.
 * @param limit maximum number of aliases in reply
 * This is expected to be only useful in development; to be able to limit download size in tests.
 * @return promise, yielding a cursor : aliases
 *
 * equivalent in mongo shell :
 *  db.Alias.aggregate ( {$match : {namespace1 : "90k", namespace2 : "90k"}}, {$limit : 1})
 */
exports.getAliases = function(db, namespaces, limit) {
  let aliasCollection = db.collection('Alias');

  if (trace)
    console.log('getAliases', namespaces[0],  namespaces[1]);

  let pipeline = [
    { $match:
      { $expr:

        { $or:
          [
            { $and :
              [
                { $eq: [ "$namespace1", namespaces[0] ] },
                { $eq: [ "$namespace2", namespaces[1] ] }
              ]
            },
            { $and :
              [
                { $eq: [ "$namespace2", namespaces[0] ] },
                { $eq: [ "$namespace1", namespaces[1] ] }
              ]
            }
          ]
        }
      }
    },
    {$limit : limit}
  ];
  var b = aliasCollection.aggregate (pipeline);

  return b;
};

/*----------------------------------------------------------------------------*/

/**
 * This function clears Aliases copied from a secondary if
 * their copy time and last-use are older than a given time.
 * Also comment re. last-use time in (localise-blocks.js) @see cacheClearBlocks
 * @desc
 *
 * @param db  database handle
 * @param time  clear data older than this time.  milliseconds since start of epoch, e.g. 1591779301486
 */
exports.cacheClearAliases = function (db, time) {
  let
  aliasCollection = db.collection("Alias"),
  match = {'meta.origin.imported' : {$lte : time}};
  console.log('cacheClearAliases', time);

  let aliasesRemoved = 
    aliasCollection.remove({'origin.imported' : {$lte : time}});
  aliasesRemoved
    .then(function (aliasesRemoved) {
      let result = aliasesRemoved.result || aliasesRemoved;
      console.log('cacheClearAliases aliasesRemoved', result);
      return result;
    })
    .catch((err) => {
      console.log('cacheClearAliases', err);
    });

  return aliasesRemoved;
};

/*----------------------------------------------------------------------------*/