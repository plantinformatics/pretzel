'use strict';

var acl = require('../utilities/acl')
var task = require('../utilities/task')

module.exports = function(Chromosome) {

  Chromosome.observe('access', function(ctx, next) {
    console.log('> Chromosome.access');
    let accessToken = ctx.options.accessToken
    let userId = String(accessToken.userId)

    if (!ctx.query.where) ctx.query.where = {}
    ctx.query.where['or'] = [{clientId: userId}, {public: true}]
    
    if (!ctx.query) {
      ctx.query = {};
    }
    let where = {or: [{clientId: userId}, {public: true}]};
    if (ctx.query && ctx.query.where) {
      where = {and: [where, ctx.query.where]}
    }
    ctx.query.where = where;

    // console.log(ctx.options)
    next()
  })

  Chromosome.observe('loaded', function(ctx, next) {
    // console.log('> Chromosome.loaded');

    next()
  })

  var rules = [
    {
      'accessType': '*',
      'principalType': 'ROLE',
      'principalId': '$everyone',
      'permission': 'DENY',
    },
    {
      'accessType': '*',
      'principalType': 'ROLE',
      'principalId': '$owner',
      'permission': 'ALLOW',
    },
    {
      'accessType': 'READ',
      'principalType': 'ROLE',
      'principalId': 'public',
      'permission': 'ALLOW',
    }
  ];

  acl.assign(Chromosome, rules);

  Chromosome.observe('before save', function(ctx, next) {
    var newDate = Date.now();

    if (ctx.instance) {
      // populate with userId
      // this appears to be sidestepped by populating at upload time
      // TODO revisit this during / after 
      // ctx.Model.clientId = ctx.options.accessToken.userId
      // ctx.instance.createdAt = newDate;
      // ctx.instance.updatedAt = newDate;
    }

    next();
  });

  Chromosome.paths = function(left, right, cb) {
    task.paths(this.app.models, left, right)
    .then(function(data) {
      // completed additions to database
      cb(null, data);
    })
    .catch(function(err) {
      console.log('ERROR', err)
      cb(err);
    })
  }

  Chromosome.remoteMethod('paths', {
    accepts: [
      {arg: '0', type: 'string', required: true}, // chromosome reference
      {arg: '1', type: 'string', required: true}, // chromosome reference
    ],
    returns: {type: 'array', root: true},
    description: "Request paths for left and right chromosomes"
  });

  Chromosome.syntenies = function(id0, id1, thresholdSize, thresholdContinuity, cb) {
    task.syntenies(this.app.models, id0, id1, thresholdSize, thresholdContinuity)
    .then(function(data) {
      // completed additions to database
      cb(null, data);
    })
    .catch(function(err) {
      console.log('ERROR', err)
      cb(err);
    })
  }

  Chromosome.remoteMethod('syntenies', {
    accepts: [
      {arg: '0', type: 'string', required: true}, // chromosome reference
      {arg: '1', type: 'string', required: true}, // chromosome reference
      {arg: 'threshold-size', type: 'string', required: false}, // chromosome reference
      {arg: 'threshold-continuity', type: 'string', required: false}, // chromosome reference
    ],
    returns: {type: 'array', root: true},
    description: "Request syntenic blocks for left and right chromosomes"
  });

};
