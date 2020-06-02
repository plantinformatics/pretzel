const bent = require('bent');
const param = require('jquery-param');

const { ApiServer, apiServers, blockServer } = require('./api-server');

/* global require */
/* global exports */

var { localiseBlocks } = require('./localise-blocks');

const trace = 1;


/** Get all aliases between the 2 given namespaces, which may be the same.
 * @param blockId0, blockId1 one of these is a reference to a remote block.
 * The getAliases request is sent to the server of that remote block.
 * @param namespace0,  namespace1,  namespaces of blockId0 and blockId1 (see pathsAliases).
 * @param intervals passed to localiseBlocks()
 * @return promise, with no result value
 */
exports.localiseBlocksAndAliases = function(db, models, blockId0, blockId1, namespace0,  namespace1, intervals) {
  const fnName = 'localiseBlocksAndAliases';
  let promise;
  /** Current scope is for <=1 of [blockId0, blockId1] to be a remote reference, and the remainder local. */
  let servers = [blockId0, blockId1].map((blockId) => blockServer(blockId))
  /** filter out undefined (local reference). */
    .filter((s) => s);
  if (servers.length === 0) {
    // blockIds are local, nothing to do
    promise = Promise.resolve(0);
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
  let addP = addAliases(db, aliases, apiServer)
    .then((insertedCount) => { console.log('after addAliases', insertedCount); return insertedCount; })
  // trace the promise outcomes
    .then(
      /** For those aliases which are already loaded, the result will be a write error
       */
      function (result) {
        console.log(fnName, '() cb', result);
      })
    .catch(function (err) {
      console.log('err', err.message, err.code);
      if (err.writeErrors) console.log(err.writeErrors.length, err.writeErrors[0]);
      if (err.code === 11000) {
        let dupCount = err.writeErrors && err.writeErrors.length || 0;
        return Promise.resolve(aliases.length - dupCount);
      }
      else return Promise.reject(err);
    });
  return addP;
}

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
  let augmented = aliases.map((a) => {
    let
      host = apiServer.host,
    imported = Date.now();
    a.origin = {host, imported};
    return a;
  });
    
  /** duplicates don't prevent insertion of following documents, because of option ordered : false  */
  let promise =
    db.collection('Alias').insertMany(augmented, {ordered : false})
    .then((result) => result.insertedCount);
  return promise;
}

/** call remoteNamespacesGetAliases() if not already requested.
 */
function remoteNamespacesAliasesValue(db, apiServer, namespaces) {
  let requests = apiServer.requests.aliases || (apiServer.requests.aliases = {}),
  requestId = namespaces.join(','),
  promise = requests[requestId] ||
    (requests[requestId] = remoteNamespacesGetAliases(apiServer, namespaces)
    .then((aliases) => addAliasesMaybeDup(db, apiServer, aliases)));
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

  let queryParams = param({namespaces, access_token : accessToken}),
  headers = {'Authorization' : accessToken},
  endPoint = '/api/Aliases/namespacesAliases';

  console.log(host, endPoint, namespaces, accessToken);
  let promise =
    getJSON(endPoint + '?' + queryParams, /*body*/undefined, headers);
  return promise;
}




/** This function is the endpoint called by the above
 * remoteNamespacesGetAliases(), i.e. this is the server side and the above is
 * the client.
 *
 * @return promise, yielding a cursor : aliases
 *
 * equivalent in mongo shell :
 *  db.Alias.aggregate ( {$match : {namespace1 : "90k", namespace2 : "90k"}}, {$limit : 1})
 */
exports.getAliases = function(db, namespaces) {
  let aliasCollection = db.collection('Alias');

  if (trace)
    console.log('getAliases', namespaces[0],  namespaces[1]);

  var b = aliasCollection.aggregate ( [

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
        },
      }
    }
    , {$limit : 1000}
  ]);

  return b;
};
