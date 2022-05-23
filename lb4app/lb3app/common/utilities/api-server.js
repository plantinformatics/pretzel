const bent = require('bent');
const param = require('jquery-param');

/* global exports */
/* global require */


class ApiServer {
  constructor (host, accessToken) {
    this.host = host;
    this.accessToken = accessToken;
    this.requests = {};
  }
};
exports.ApiServer = ApiServer;

/** [host] -> ApiServer
*/
var apiServers = {};
exports.apiServers = apiServers;

/** Map the given blockIds to undefined, if blockId is local, or an ApiServer, if blockId is a remote reference.
 */
exports.blockServer = function(blockId) {
  let b = blockId,
    /** -  index by session instead, so that 2 sessions for the same host don't share tokens;
     * but in the first instance (public data);  want to share the cached data.
     */
  server =
    b.host && (apiServers[b.host] || (apiServers[b.host] = new ApiServer(b.host, b.token)));
  return server;
};

/*----------------------------------------------------------------------------*/

/** Construct an origin value which is added to Dataset / Block / Alias to
 * indicate they are copied / cached / localised from a secondary api server.
 * ._origin is added in Dataset.meta / Block.meta / Alias.
 */
ApiServer.prototype.makeOrigin = function() {
  let
    host = this.host,
  imported = Date.now(),
  origin = {host, imported};
  return origin;
}

/*----------------------------------------------------------------------------*/

/** Construct a hash of datasetsBlocks (result of getDatasetsBlocks(), by datasetName
 * @return [datasetName] -> dataset
 */
ApiServer.prototype.datasetsBlocksByDatasetNameCollate = function() {
  this.datasetsBlocksByDatasetName = 
    this.datasetsBlocks.reduce(
      function (result, dataset) { result[dataset.name] = dataset; return result; },
      {});
};

/** Construct a hash of datasetsBlocks (result of getDatasetsBlocks(), by blockId
 * @return [blockId] -> { block, dataset}
 */
ApiServer.prototype.datasetsBlocksByBlockIdCollate = function() {
  this.datasetsBlocksByBlockId = 
    this.datasetsBlocks.reduce(
      (result, dataset) => dataset.blocks.reduce((resultB, block) => {
        let bd = {block, dataset};
        if (dataset.parent)
          bd.parent = this.datasetsBlocksByDatasetName[dataset.parent];
        resultB[block.id] = bd; return resultB; }, result), {});
};


/*----------------------------------------------------------------------------*/

/** 
 * @return the list of datasets, including their blocks, from this ApiServer.
 * @desc
 * If a request for this value has been sent, return that promise, with the
 * exception that a new request is sent if refresh.
 *
 * @param refresh if true, send a request regardless of presence of existing value .datasetsBlocks
 */
ApiServer.prototype.datasetsBlocksValue = async function (refresh) {
  const fnName = 'datasetsBlocksValue';
  if (!refresh && this.requests.datasetsBlocks) {
    console.log(fnName, 'already in progress');
  } else {
    console.log(fnName, refresh);
    this.requests.datasetsBlocks = 
      this.getDatasetsBlocks().then((datasetsBlocks) => {
        console.log(fnName, datasetsBlocks.length);
        this.datasetsBlocks = datasetsBlocks;
        this.datasetsBlocksByDatasetNameCollate();
        this.datasetsBlocksByBlockIdCollate();
      });
  }
  return this.requests.datasetsBlocks;
};

/*----------------------------------------------------------------------------*/

/** Get Datasets and Blocks from the given Pretzel API server.
 * @return promise yielding an array of datasets, with their blocks included.
 */
ApiServer.prototype.getDatasetsBlocks = function () {
  let promise;
  console.log('getDatasetsBlocks', 'send request');
  const getJSON = bent(this.host, 'json');
  const params = {filter : {'include': 'blocks'}},
  headers = {'Authorization' : this.accessToken};
  promise = getJSON('/api/datasets' + '?' + param(params),  /*body*/undefined, headers);
  promise.then((datasetsBlocks) => console.log('datasetsBlocks', datasetsBlocks.length, datasetsBlocks[0].name));
  return promise;
};

/*----------------------------------------------------------------------------*/

/**
 * @param blockId string, just the local blockId not a remote reference
 */
ApiServer.prototype.datasetAndBlock = async function (blockId) {
  if (blockId.blockId) {
    console.log('datasetAndBlock', blockId);
    debugger;
  }
  const datasetAndBlockGet = async (blockId, refresh) => {
    let datasetsBlocks = await this.datasetsBlocksValue(refresh),
    datasetBlock = this.datasetsBlocksByBlockId[blockId];
    if (! datasetBlock) {
      console.log('datasetAndBlockGet', datasetBlock, blockId, refresh);
    }
    return datasetBlock;
  };
  let datasetBlock = await datasetAndBlockGet(blockId, false);
  console.log('datasetAndBlockGet', blockId,
              datasetBlock && [datasetBlock.block.name, datasetBlock.dataset.name]);
  if (! datasetBlock) {
    /** If a new block is added / uploaded to the server, this.datasetsBlocks
     * will need to be refreshed.
     */

    /** To avoid repeated retries, a retry may be sent for each blockId which is
     * not found in this.datasetsBlocks.
     * this.requests.block_retry[blockId] records a refresh sent for blockId.
     */
    let block_retry = this.requests.block_retry || (this.requests.block_retry = {}),
    tried = block_retry[blockId];

    /* requests.datasetsBlocks is set by getDatasetsBlocks(), which is called
     * via datasetsBlocksValue(), so at this point, expect that it is defined;
     * simply log the retry. */
    if (! tried && this.requests.datasetsBlocks) {
      console.log('datasetAndBlock replacing previous result', this.datasetsBlocks && this.datasetsBlocks.length, blockId);
    }

    let
    datasetBlockP = tried ||
      (block_retry[blockId] = datasetAndBlockGet(blockId, true));
    datasetBlock = await datasetBlockP;
  }
  console.log('datasetAndBlock', blockId, datasetBlock !== undefined);
  return datasetBlock;
};


/*----------------------------------------------------------------------------*/

