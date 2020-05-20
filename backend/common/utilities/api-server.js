/* global exports */

class ApiServer {
  constructor (host, accessToken) {
    this.host = host;
    this.accessToken = accessToken;
    this.requests = {};
  }
};
exports.ApiServer = ApiServer;
