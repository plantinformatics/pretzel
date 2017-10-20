'use strict';

var acl = require('../utilities/acl')
var task = require('../utilities/task')

module.exports = function(Chromosome) {
  // Chromosome.afterRemote('findById', function(ctx, output, next) {
  //   console.log('> Chromosome.findById triggered');
  //   // console.log(output)
  //   ctx.result = {
  //     'chromosome': ctx.result
  //   };
  //   // console.log('next')
  //   next()
  // })
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
      'principalId': '$authenticated',
      'permission': 'ALLOW',
    },
  ];

  acl.assign(Chromosome, rules);

  Chromosome.beforeCreate = function(next, model) {
    var newDate = Date.now();
    model.createdAt = newDate;
    model.updatedAt = newDate;
    next();
  };

  Chromosome.beforeUpdate = function(next, model) {
    model.updatedAt = Date.now();
    next();
  };

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
