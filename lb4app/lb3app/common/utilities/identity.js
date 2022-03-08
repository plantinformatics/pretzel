'use strict';

/* global exports */
/* global require */

var clientGroups = require('./client-groups');

/**
 * Find the client id from loopback context, if exists
 * @param {Object} data - ctx - loopback method context
 * @returns clientId
 */
exports.gatherClientId = (data) => {
  var accessToken = null
  if (data.options && data.options.accessToken) {
    // built-in remote methods provide token via ctx.options
    accessToken = data.options.accessToken
  } else if (data.accessToken) {
    // app-defined remote methods provide token via options
    accessToken = data.accessToken
  } 
  if (accessToken != null) {
    let clientId = String(accessToken.userId)
    return clientId
  } else {
    return null
  }
}

/**
 * Apply filters to return only owned or public resources
 * @param {Object} ctx - loopback method context
 * @returns clientId
 */
exports.queryFilterAccessible = (ctx) => {
  const fnName = 'queryFilterAccessible';
  let clientId = exports.gatherClientId(ctx)
  if (! clientGroups.clientGroups?.clientGroups) {
    console.log(fnName, ctx, clientId, this, clientGroups);
    debugger;
  }
  let groups = clientGroups.clientGroups.clientGroups[clientId];
  console.log(fnName, clientId, groups);

  if (!ctx.query) {
    ctx.query = {};
  }
  // let groupsNull = groups.slice().push(null);
  let where = {or: [{clientId: clientId}, {public: true}]};
  if (groups?.length) {
    where.or.push({groupId : {$in : groups}});
    console.dir(where);
  }
  if (ctx.query.where) {
    where = {and: [where, ctx.query.where]}
  }
  ctx.query.where = where;
}
