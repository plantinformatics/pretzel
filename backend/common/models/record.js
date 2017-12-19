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

  // var rules = [
  //   {
  //     'accessType': '*',
  //     'principalType': 'ROLE',
  //     'principalId': '$everyone',
  //     'permission': 'DENY',
  //   },
  //   {
  //     'accessType': '*',
  //     'principalType': 'ROLE',
  //     'principalId': '$owner',
  //     'permission': 'ALLOW',
  //   },
  //   {
  //     'accessType': 'READ',
  //     'principalType': 'ROLE',
  //     'principalId': 'public',
  //     'permission': 'ALLOW',
  //   }
  // ];
  // acl.assign(Record, rules);

  Record.observe('before save', function(ctx, next) {
    console.log('Record.before save')
    var newDate = Date.now();

    if (ctx.instance) {
      // ctx.instance.createdAt = newDate;
      // ctx.instance.updatedAt = newDate;
    }

    next();
  });
  
};