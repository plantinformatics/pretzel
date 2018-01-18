'use strict';

var _ = require('lodash')

var acl = require('../utilities/acl')
var identity = require('../utilities/identity')
var upload = require('../utilities/upload')
var load = require('../utilities/load')

module.exports = function(Record) {

  Record.observe('access', function(ctx, next) {
    console.log(`> Record.access ${ctx.Model.modelName}`);
    if (ctx.Model.modelName != 'Block') {
      identity.queryFilterAccessible(ctx)
    }
    next()
  })

  Record.afterRemote('find', function(ctx, modelInstance, next) {
    console.log('> Record.loaded');
    next()
  })

  Record.observe('before save', function(ctx, next) {
    console.log(`> Record.before save ${ctx.Model.modelName}`)
    var newDate = Date.now();
    if (ctx.currentInstance) {
      // update
      ctx.currentInstance.updatedAt = newDate;
    } else if (ctx.isNewInstance) {
      // create
      let clientId = identity.gatherClientId(ctx)
      if (clientId) ctx.instance.clientId = clientId
      ctx.instance.createdAt = newDate
      ctx.instance.updatedAt = newDate;
    }
    next();
  });
  
};