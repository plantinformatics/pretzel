'use strict';

module.exports = function enableAuthentication(server) {
  // enable authentication
  if (process.env.AUTH !== 'NONE') {
    server.enableAuth();
  }
};
