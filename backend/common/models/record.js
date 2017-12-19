'use strict';

var _ = require('lodash')

var acl = require('../utilities/acl')
var identity = require('../utilities/identity')
var upload = require('../utilities/upload')
var load = require('../utilities/load')

module.exports = function(Record) {

  Record.observe('access', function(ctx, next) {
    console.log(`> Record.access ${ctx.Model.modelName}`);
    identity.queryFilterAccessible(ctx)
    next()
  })

  Record.afterRemote('find', function(ctx, modelInstance, next) {
    console.log('> Record.loaded');
    next()
  })

  Record.observe('before save', function(ctx, next) {
    console.log(`> Record.before save ${ctx.Model.modelName}`)
    if (ctx.currentInstance) {
      // assigning creation / update times to resource
      var newDate = Date.now();
      if (!ctx.currentInstance.createdAt) ctx.currentInstance.createdAt = newDate
      ctx.currentInstance.updatedAt = newDate;
    }
    next();
  });
  
};