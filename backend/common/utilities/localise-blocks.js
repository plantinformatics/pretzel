const bent = require('bent');
const param = require('jquery-param');

/* global exports */
/* global require */
/* global Promise */

const upload = require('./upload');
const { ApiServer, apiServers, blockServer } = require('./api-server');
const { insert_features_recursive } = require('./upload');

const { ObjectID } = require('mongodb');
/** ObjectId is used in mongo shell; the equivalent defined by the node js client library is ObjectID;
 * Using ObjectId here makes it simple to copy/paste mongo calls between here and mongo shell.
 */
const ObjectId = ObjectID;


/*----------------------------------------------------------------------------*/

/** Context : Datasets / Blocks / Features are copied from a secondary Pretzel
 * API server to enable paths (direct and aliases) to be calculated using db
 * query.  This is a simple selective on-demand replication; the data is stable
 * (could be immutable), so update is not required; to balance space / time
 * efficiency, and to handle updates if required, the copied data is
 * time-stamped, and cleared periodically.
 *
 * The term 'localise' is used to refer to this process of adding a copy of data
 * from secondary server to this server database.  It means that a ID of a block
 * on the secondary can be used in db query for paths.
 * DB IDs are GUID so duplicate IDs are not a problem.
 */

/*----------------------------------------------------------------------------*/


/** If any of the blockIds are references to remote blocks, map them to local
 * cached blocks by requesting the blocks and adding them to the db.
 * @return promise yielding local blockIds equivalent to the input params;
 * remote block references are replaced with local block ids.
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
 * @return promise not yielding a value
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
  })
    .catch((err) => {
      console.log('localiseDataset', err.message, data);
      if (err.code === 11000) {
        return Promise.resolve();
      }
      else return Promise.reject(err);
    });
  return dataset_id;
};
exports.localiseDataset = localiseDataset;

/*----------------------------------------------------------------------------*/

/** Extract the blockId out of a block remote reference.
 * The id is GUID, so the remote id is used locally without clash.
 */
exports.blockLocalId = function(blockId) {
  return blockId.blockId || blockId;
};


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
    let apiServer = blockServer(b);

    /** will add tracking of request completion; also if interval.axes is the same as last request then no point in starting it.
     * If it is different then either use e.g. promise-throttle or follow the previous promise.
     */
    b = apiServer.requests[b.blockId] ||
      (apiServer.requests[b.blockId] = localiseBlockGet(models, apiServer, b, interval));
  }

  return b;
};

/** After a localised block is cleared from the cache, if it is requested by the
 * client again then it will need to be localised again.  This function achieves
 * that by clearing the reference to the localiseBlockGet() request.
 */
function forgetBlockRequest(blockId, host) {
  let apiServer = apiServers[host],
  requests = Reflect.get(apiServer, 'requests');
  // using ObjectId in [] e.g. requests[blockId] seems equivalent to blockId.toHexString().
  console.log('forgetBlockRequest', blockId.toHexString(), host, /*apiServer,*/ requests && requests[blockId]);
  if (requests) {
    delete requests[blockId];
  }
}

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
    getJSON('/api/Blocks/blockFeaturesInterval' + '?' + queryParams, /*body*/undefined, headers)
    .catch(function (err) {
      console.log('remoteBlockGetFeatures', 'blockFeaturesInterval', b.blockId, queryParams, headers, err);
   });
  return promise;
}

/** Convert a remote reference for a block to a local blockId,
 * by caching the block locally.
 * @return promise, with value blockId
 */
async function localiseBlockGet(models, apiServer, blockRemoteRefn, interval) {
  console.log('localiseBlockGet', blockRemoteRefn);
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
        if (err) console.log('localiseBlockGet() err', err.message, err.code, err.writeErrors.length, err.writeErrors[0]);
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
    let ok;
    let datasetBlock = await apiServer.datasetAndBlock(blockId);
    if (! datasetBlock) {
      console.log('localiseDatasetForBlock', datasetBlock, apiServer, blockId);
      debugger;
      ok = false;
    } else {
    let
    dataset = datasetBlock.dataset,
  block = datasetBlock.block;
  // console.log('localiseDatasetForBlock', block, datasetBlock);

    if (datasetBlock.parent)
      await ensureDataset(apiServer, models, datasetBlock.parent);
    await ensureDataset(apiServer, models, dataset);

  let blocks = await models.Block.find({where: {_id: blockId}, limit: 1}),
  blockIdInLocal = blocks.length > 0;
  ok = blockIdInLocal || await uploadBlock(db, apiServer.host, block);
    }
  console.log('localiseDatasetForBlock', ok);
  return ok;
}

/**
 * @return promise not yielding a value
 */
function ensureDataset(apiServer, models, dataset) {
  /** -	make datasetId unique by appending @host  (and possibly later @user)
   * Change dataset.name and block.datasetId
   */
  let datasetId = dataset.name; // block.datasetId;
  console.log('ensureDataset', datasetId);
  let datasetIsLoaded = models.Dataset.exists(datasetId)
    .then((datasetIdInLocal) => {
      /** @param datasetIdInLocal true if the block's dataset is cached in local. based on checkDatasetExists(). */
      console.log('ensureDataset', datasetIdInLocal);
      let promise;
      if (datasetIdInLocal) {
        promise = Promise.resolve();
      } else {
        let meta = dataset.meta || (dataset.meta = {});
        meta.origin = apiServer.makeOrigin();
        promise = localiseDataset(dataset, models, /*options*/undefined);
      }
      return promise;
    });
  return datasetIsLoaded;
}
/*----------------------------------------------------------------------------*/

/** Cache the block in the db.
 * @param block_json
 * @return promise
 */
function uploadBlock(db, host, block_json) {
  let meta = block_json.meta || (block_json.meta = {}),
  imported = Date.now();
  meta.origin = {host, imported};
  function cb(err, result) { console.log('uploadBlock() cb', err, result); };

  let promise = datasetAddBlock(db, block_json, cb);

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
function datasetAddBlock(db, blockData, cb) {
    // create block using connector to enable id to be provided by blockData.
  console.log('datasetAddBlock', blockData.id, blockData._id);
  if (blockData.id && ! blockData._id)
    blockData._id = blockData.id;
  if (typeof blockData._id === "string")
    blockData._id = ObjectId(blockData._id);
  delete blockData.id;

  let
    promise = db.collection('Block').insertOne(blockData)
    .then(function(result) {
      console.log('datasetAddBlock', blockData.datasetId /*,result*/);
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

/** See also file header comment for context.
 *
 * This function clears Datasets / Blocks / Features copied from a secondary if
 * their copy time and last-use are older than a given time.
 * The last-use time will probably not be updated in the database - it is
 * sufficient to record this within the server; if the server is restarted, data
 * may be cleared which was recently used, but it is OK to simply re-read the
 * data.
 *
 * @param db  database handle
 * @param time  clear data older than this time.  milliseconds since start of epoch, e.g. 1591779301486
 */
exports.cacheClearBlocks = async function (db, models, time) {
  let
  datasetCollection = db.collection("Dataset"),
  blockCollection = db.collection("Block"),
  featureCollection = db.collection("Feature"),
  match = {'meta.origin.imported' : {$lte : time}},
  idsToRemovePipeline =  [ {$match : match}, {$project : {'meta.origin' : 1 }} ],
  blocks = await blockCollection.aggregate(idsToRemovePipeline).toArray(),
  blockIds = blocks.map((block) => block._id),
  /** result {_id, meta.origin}[], not currently used - just trace.   */
  datasets = await datasetCollection.aggregate(idsToRemovePipeline).toArray();
  console.log('cacheClearBlocks', time, blocks.length, datasets.map((d) => d._id),
              blockIds.map((id) => id.toHexString()));
  let featuresRemoved = await featureCollection.remove({blockId : {$in : blockIds}})
    .then(function (removed) {
      console.log('featuresRemoved', removed.result || removed);
    }),
  blocksRemoved = await blockCollection.remove(match)
    .then(function (removed) {
      console.log('blocksRemoved', removed.result || removed);
      /** @param block this is not the loopback object (with .__data), it is
       * the result of idsToRemovePipeline. */
      blocks.forEach(function (block) {
        forgetBlockRequest(block._id, block.meta.origin.host);
      });
    }),
  datasetsRemoved = await models.Dataset.find({include: 'blocks', where: /*match*/ {'meta.origin.imported' : {lte : time}}}, /*options*/{})
    .then(function(datasets) {
      return datasets.filter(function(dataset) {
        let d = dataset.__data;
        console.log('cacheClearBlocks', 'dataset', d.name, d.blocks.length, d.meta.origin);
        return d.blocks.length === 0;
        })
        .map((dataset) => { return {
          // '_id' because this is used in mongoDb query
          _id : dataset.name,
          'meta.origin.host' : dataset.__data.meta.origin.host
        };   });
    })
    .then(function (datasetsToRemove) {
      console.log('datasetsToRemove', datasetsToRemove);
      return Promise.all(
        datasetsToRemove.map((datasetToRemove) => {
          console.log('datasetToRemove', datasetToRemove);
          return datasetCollection.remove(datasetToRemove);
        }));
    })
    .catch((err) => {
      console.log('cacheClearBlocks', err);
    });

  return datasetsRemoved;
};

/*----------------------------------------------------------------------------*/
