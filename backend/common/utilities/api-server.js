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
 * .origin is added in Dataset.meta / Block.meta / Alias.
 */
ApiServer.prototype.makeOrigin = function() {
  let
    host = this.host,
  imported = Date.now(),
  origin = {host, imported};
  return origin;
}

/*----------------------------------------------------------------------------*/

/** Originally written for localise-blocks, this function could be moved here,
 * and probably made a method of ApiServer. */
const { getDatasetsBlocks } = require('./localise-blocks');

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

ApiServer.prototype.datasetsBlocksValue = async function () {
  let apiServer = this;
  if (! apiServer.datasetsBlocks) {
    // ApiServer : could combine value with via promise proxy function
    apiServer.datasetsBlocks = await getDatasetsBlocks(apiServer);
    apiServer.datasetsBlocksByDatasetNameCollate();
    apiServer.datasetsBlocksByBlockIdCollate();
  }
  return apiServer.datasetsBlocks;
};

/**
 * @param blockId string, just the local blockId not a remote reference
 */
ApiServer.prototype.datasetAndBlock = async function (blockId) {
  if (blockId.blockId) {
    console.log('datasetAndBlock', blockId);
    debugger;
  }
  let datasetsBlocks = await this.datasetsBlocksValue(),
  datasetBlock = this.datasetsBlocksByBlockId[blockId];
  console.log('datasetAndBlock', blockId /*, datasetBlock*/);
  return datasetBlock;
};


/*----------------------------------------------------------------------------*/

