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

/** Originally written for localise-blocks, these functions could be moved here. */
const { getDatasetsBlocks, datasetsBlocksByBlockId } = require('./localise-blocks');


ApiServer.prototype.datasetsBlocksValue = async function () {
  let apiServer = this;
  if (! apiServer.datasetsBlocks) {
    // ApiServer : could combine value with via promise proxy function
    apiServer.datasetsBlocks = await getDatasetsBlocks(apiServer);
    apiServer.datasetsBlocksByBlockId = datasetsBlocksByBlockId(apiServer.datasetsBlocks);
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

