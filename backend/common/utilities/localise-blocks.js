const bent = require('bent');
const param = require('jquery-param');

/* global exports */
/* global require */
/* global Promise */

const upload = require('./upload');
const { ApiServer } = require('./api-server');
const { insert_features_recursive } = require('./upload');

const { ObjectID } = require('mongodb');
/** ObjectId is used in mongo shell; the equivalent defined by the node js client library is ObjectID;
 * Using ObjectId here makes it simple to copy/paste mongo calls between here and mongo shell.
 */
const ObjectId = ObjectID;


/** [host] -> ApiServer
*/
var apiServers = {};


/** If any of the blockIds are references to remote blocks, map them to local
 * cached blocks by requesting the blocks and adding them to the db.
 * @return same format as input, except that remote block references are replaced with local block ids.
 */
exports.localiseBlocks = function(models, blockIds, intervals) {
  /** use intervals.axes[i], which corresponds to blockIds[i]. */
  function intervals_axis(intervals, i) {
    let intervals_i = Object.assign({}, intervals);
    /* blockFeaturesInterval() only uses axes[0]; it expects axes to be an array. */
    intervals_i.axes  = [intervals.axes[i]];
    return intervals_i;
  }
  let locP = blockIds.map((b, i) => localiseBlock(models, b, intervals_axis(intervals, i)) ),
  blockIdsLocal = Promise.all(locP);
  return blockIdsLocal;
};

const blockSplitChar = '@';

/*----------------------------------------------------------------------------*/

/** Add a cached copy of a remote dataset.
 *
 * @param {Object} data - The dataset object to be added
 * @param {Object} models - Loopback database models
 * @desc based on @see uploadDataset()
 */
async function localiseDataset(data, models, options) {
  let dataset_id;

  //create dataset
  await
  models.Dataset.create(data, options)
  .then(function(dataset) {
    dataset_id = dataset.name;
    if (dataset.__cachedRelations.blocks) {
      dataset.__cachedRelations.blocks.forEach(function(json_block) {
        json_block.datasetId = dataset.id;
      });
    }
  });
  return dataset_id;
};
exports.localiseDataset = localiseDataset;

/*----------------------------------------------------------------------------*/

const hostSplitChar = '#';

/** Drafted to handle remote block references encoded as strings, e.g.
 * but now have switched to encoding them as an object, e.g. 
 *  {blockId: "24 hex chars", host: "https://plantinformatics.io", token: "64 alphanumeric, mixed case" }
 * in which case this function won't be required.
 * @param b
 * @return {blockId, host, token} or b if not a remote reference, just a blockId
 */
function splitBlockString(b) {
  const fName = 'splitBlockString';
  // mongoDb ID e.g. 5ce235d2aac7a3752080ed4c
  let
    parts = b.split(blockSplitChar);
  if (parts.length === 1) {
    // parts[0].match(/^[0-9a-f]{24}$/)
  } else if (parts.length > 2) {
    // extra '@' - invalid blockId - would fail in mongoDb lookup
    console.log(fName + ' excess ', blockSplitChar ,' in blockId', b, parts);
    b = null;
  } else {
    let blocks = parts[0],
    /** later, host can be a name lookup of registered hosts. */
    hostParts = parts[1].split(hostSplitChar),
    host,
    accessToken;
    if (hostParts.length === 1) {
      // perhaps hosted isolated from internet, with no authentication.
      console.log(fName + ' no ', hostSplitChar ,' in host#accessToken', parts[1]);
    } else {
      if (hostParts.length > 2) {
        // extra '#' - invalid accessToken ?
        console.log(fName + ' excess ', hostSplitChar ,' in host#accessToken', host, hostParts);
      } else if (! hostParts[0].match(/^[A-Za-z0-9_.:]+$/)) {
        console.log(fName + ' invalid host ', hostParts[0], 'in', parts[1]);
      } else if (! hostParts[1].match(/^[A-Za-z0-9]{64}/)) {
        console.log(fName + ' invalid accessToken ', hostParts[1], 'in', parts[1]);
      } else {
        host = hostParts[0];
        accessToken = hostParts[1];
      }
    }
    b = {blockId : blocks, host, token : accessToken};
  }
  return b;
}

/** If b is a (local) blockId, return it;
 * otherwise
 * . get the block features (as scoped by interval) from its api server, if not already done, and add them to the database as cached objects;
 * . add the block and its dataset, if not already done, to the database as cached objects.
 * . the blockId is now available in the local db, so simply return the .blockId, without the remote reference (.host, .token).
 * @return blockId
 * @param b  blockId or 
{blockId: "5b75410b6b8f8d13f4c9bc2a", host: "https://dev.plantinformatics.io", token: "IIXWI1iWL3mvZ3uxkGCUXdpnoUWH84a8BEXgNamedBbS9B46E1GQZd2M3fjlCOES"}
 * @return promise
 */
function localiseBlock(models, b, interval)
{
  // or remoteRefn = splitBlockString(b);
  if (typeof b === 'string') {
    // block is already local
  }
  else {
    /** -  index by session instead, so that 2 sessions for the same host don't share tokens;
     * but in the first instance (public data);  want to share the cached data.
     */
    let apiServer = apiServers[b.host] || (apiServers[b.host] = new ApiServer(b.host, b.token));
    /** will add tracking of request completion; also if interval.axes is the same as last request then no point in starting it.
     * If it is different then either use e.g. promise-throttle or follow the previous promise.
     */
    b = apiServer.requests[b.blockId] ||
      (apiServer.requests[b.blockId] = localiseBlockGet(models, apiServer, b, interval));
  }

  return b;
};

/** get features
 */
function remoteBlockGetFeatures(blockRemoteRefn, interval)
{
  let b = blockRemoteRefn,
  blocks = [b.blockId],
  host = b.host,
  accessToken = b.token;

  const getJSON = bent(host, 'json');

  /** interval.axes is passed through for domain limit, whereas nSamples,
   * nFeatures are set to a large number to get "all" the features.  */
  let {nSamples, nFeatures, ...intervals} = interval;
  intervals.nSamples = intervals.nFeatures = 400; // 1e4 maybe
  let queryParams = param({blocks, intervals}),
  headers = {'Authorization' : accessToken};
  console.log('/api/Blocks/blockFeaturesInterval', blocks, interval, accessToken);
  let promise =
    getJSON('/api/Blocks/blockFeaturesInterval' + '?' + queryParams, /*body*/undefined, headers);
  return promise;
}

/** Convert a remote reference for a block to a local blockId,
 * by caching the block locally.
 * @return promise, with value blockId
 */
async function localiseBlockGet(models, apiServer, blockRemoteRefn, interval) {
  const fnName = 'localiseBlockGet';
  let b = blockRemoteRefn;

  /**
   * await getDatasetsBlocks()
   * lookup block & dataset;  add them as required
   * this can be a parallel thread, started when block server (->b.host) is known, and results are required for uploadBlock.
   */
  let
    db = await model2db(models.Block),
  /** models is used for .find(), db is used for .insertOne() */
  ok = await localiseDatasetForBlock(apiServer, models, db, b.blockId);
  console.log('localiseBlockGet(), after localiseDatasetForBlock', b.blockId);

  let promise;
  if (! ok) {
    promise = Promise.reject();
  } else {
    promise = 
    remoteBlockGetFeatures(blockRemoteRefn, interval).then((features) => {
      console.log('features', features.length);
      /* features[*].blockId is the same as block._id, b.blockId.       */
      /** For those features which are already loaded, the result will be a write error
       */
      function cb(err, result) {
        console.log(fnName, '() cb', result);
        if (err) console.log('err', err.message, err.code, err.writeErrors.length, err.writeErrors[0]);
      };
      /** insert_features_recursive() does not use dataset_id; it passes it to cb() as result. 
       * datasetId is not handy, so pass b instead.
       */
      return blockAddFeatures(db, /*datasetId*/b, features, cb)
        .then(() => { console.log('after blockAddFeatures', b); return b.blockId; });
    });
  }

  return promise;
}

/*----------------------------------------------------------------------------*/

/**
     * await getDatasetsBlocks()
     * lookup block & dataset;  add them as required
 */
  async function localiseDatasetForBlock (apiServer, models, db, blockId) {
  console.log('localiseDatasetForBlock', blockId);
  if (! apiServer.datasetsBlocks) {
    // ApiServer : could combine value with via promise proxy function
    apiServer.datasetsBlocks = await getDatasetsBlocks(apiServer);
    apiServer.datasetsBlocksByBlockId = datasetsBlocksByBlockId(apiServer.datasetsBlocks);
    console.log('datasetsBlocks', apiServer.datasetsBlocks.length, apiServer.datasetsBlocks[0]);
  }

  let datasetBlock = apiServer.datasetsBlocksByBlockId[blockId],
  block = datasetBlock.block;
  console.log('localiseDatasetForBlock', block, datasetBlock);
  /** -	make datasetId unique by appending @host  (and possibly later @user)
   * Change dataset.name and block.datasetId
   */
  let datasetId = block.datasetId;

  let datasets = await models.Dataset.find({where: {_id: datasetId}, limit: 1}),
  /** true if the block's dataset is cached in local. based on checkDatasetExists(). */
  datasetIdInLocal = datasets.length > 0;
  if (! datasetIdInLocal) {
    let
    dataset = datasetBlock.dataset,
    host = apiServer.host,
    imported = Date.now();
    dataset.meta.origin = {host, imported};
    let datasetId = localiseDataset(dataset, models, /*options*/undefined);
  }

  let blocks = await models.Block.find({where: {_id: blockId}, limit: 1}),
  blockIdInLocal = blocks.length > 0,
  ok = blockIdInLocal || await uploadBlock(db, datasetId, apiServer.host, block);
  console.log('localiseDatasetForBlock', ok);
  return ok;
}

/*----------------------------------------------------------------------------*/

/** Cache the block in the db.
 * @param block_json
 * @return promise
 */
function uploadBlock(db, datasetId, host, block_json) {
  let meta = block_json.meta || (block_json.meta = {}),
  imported = Date.now();
  meta.origin = {host, imported};
  function cb(err, result) { console.log('uploadBlock() cb', err, result); };

  let promise = datasetAddBlock(db, datasetId, block_json, cb);

  return promise;
}

/** lookup db from model.
 * @return promise
 */
function model2db(model) {
  return new Promise(
    function (resolve, reject) {
      model.dataSource.connector.connect(function(err, db) {
        if (err) reject(err);
        else resolve(db);
      });
    }
  );
}

/**
 * @param blockData .id is a string blockId and ._id is undefined
 * @return promise -> true if insert OK.
 */
function datasetAddBlock(db, datasetId, blockData, cb) {
    // create block using connector to enable id to be provided by blockData.
  console.log('datasetAddBlock', datasetId, blockData.id, blockData._id);
  if (blockData.id && ! blockData._id)
    blockData._id = blockData.id;
  if (typeof blockData._id === "string")
    blockData._id = ObjectId(blockData._id);
  delete blockData.id;

  let
    promise = db.collection('Block').insertOne(blockData)
    .then(function(result) {
      console.log('datasetAddBlock', datasetId /*,result*/);
      // maybe change ok -> resolve/reject
      return result.insertedCount === 1;
    })
    .catch(function(e){
      cb(e);
    });

  return promise;
}

/** Add features.
 * @param features  array of features to add.
 *  each feature defines .blockId
 * @return promise (no value)
 */
function blockAddFeatures(db, datasetId, features, cb) {
  /** convert the ._id and .blockId fields from hex string to ObjectId,
   * and shallow-copy the other fields. */
  let featuresId = features.map((f) => { 
    let {_id, blockId, ...rest} = f;
    rest._id = ObjectId(_id);
    rest.blockId = ObjectId(blockId);
    return rest;
  });

  return insert_features_recursive(db, datasetId, featuresId, false, cb);
}


/*----------------------------------------------------------------------------*/

/** Get Datasets and Blocks from the given Pretzel API server.
 * @return promise
 */
function getDatasetsBlocks (apiServer) {
  let promise;
  if (apiServer.requests.datasetsBlocks) {
    promise = apiServer.requests.datasetsBlocks;
  } else {
    const getJSON = bent(apiServer.host, 'json');
    const params = {filter : {'include': 'blocks'}},
    headers = {'Authorization' : apiServer.accessToken};
    promise = getJSON('/api/datasets' + '?' + param(params),  /*body*/undefined, headers);
    apiServer.requests.datasetsBlocks = promise;
  }
  return promise;
};
exports.getDatasetsBlocks = getDatasetsBlocks;

/** Construct a hash of datasetsBlocks (result of getDatasetsBlocks(), by blockId
 * @return [blockId] -> { block, dataset}
 */
function datasetsBlocksByBlockId(datasetsBlocks) {
  return datasetsBlocks.reduce(
    (result, dataset) => dataset.blocks.reduce(function (resultB, block) {
      resultB[block.id] = {block,dataset}; return resultB; }, result), {});
}


/*----------------------------------------------------------------------------*/
