'use strict';

var acl = require('../utilities/acl')
var identity = require('../utilities/identity')
var task = require('../utilities/task')
var pathsAggr = require('../utilities/paths-aggr');
var ObjectId = require('mongodb').ObjectID

module.exports = function(Block) {

  Block.paths = function(left, right, options, cb) {
    task.paths(this.app.models, left, right, options)
    .then(function(data) {
      // completed additions to database
      cb(null, data);
    })
    .catch(function(err) {
      console.log('ERROR', err)
      cb(err);
    })
  };

  Block.pathsProgressive = function(left, right, options, cb) {
      let blockCollection = this.dataSource.connector.collection("Block");
    console.log('pathsProgressive', blockCollection, left, right, options, cb);
      pathsAggr.paths(blockCollection, this.app.models, left, right, options)
    .then(function(data) {
      // completed additions to database
      cb(null, data);
    })
    .catch(function(err) {
      console.log('ERROR', err);
      cb(err);
    });
  };


  Block.pathsViaStream = function(blockId0, blockId1, options, cb) {
    let db = this.dataSource
    let blockCollection = db.connector.collection("Block");
    
    console.log("blockId0", blockId0)
    console.log("blockId1", blockId1)

    var cursor = blockCollection.aggregate ( [
      { $match :  {
          $or : [{ "_id" : ObjectId(blockId0) },
                 { "_id" : ObjectId(blockId1) }]
            }
        },

      {$lookup: { from: 'Feature', localField: '_id', foreignField: 'blockId', as: 'featureObjects' }},
      {$unwind: '$featureObjects' },
      {$limit: 5}
      ]
   )
    cursor.on('data', function(doc) {
      cb(null, doc)
    })

    cursor.once('end', function() {
      // db.close();
    })
  }

  Block.pathsByReference = function(blockA, blockB, referenceGenome, maxDistance, options, cb) {
    task.pathsViaLookupReference(this.app.models, blockA, blockB, referenceGenome, maxDistance, options)
    .then(function(paths) {
      cb(null, paths);
    }).catch(function(err) {
      cb(err);
    });
  }

  Block.observe('before save', function(ctx, next) {
    if (ctx.instance) {
      if (!ctx.instance.name) {
        if (ctx.instance.scope) {
          ctx.instance.name = ctx.instance.scope;
        } else if (ctx.instance.namespace) {
          ctx.instance.name = ctx.instance.namespace;
        }
      }
    }
    next();
  });

  Block.observe('before delete', function(ctx, next) {
    var Block = ctx.Model.app.models.Block
    var Annotation = ctx.Model.app.models.Annotation

    var Feature = ctx.Model.app.models.Feature
    Feature.destroyAll({blockId: ctx.where.id}, ctx.options);

    var Annotation = ctx.Model.app.models.Annotation
    Annotation.find({
      where: {
        blockId: ctx.where.id
      }
    }, ctx.options).then(function(annotations) {
      annotations.forEach(function(annotation) {
        Annotation.destroyById(annotation.id, ctx.options, function () {
        });
      })
    })

    var Interval = ctx.Model.app.models.Interval
    Interval.find({
      where: {
        blockId: ctx.where.id
      }
    }, ctx.options).then(function(intervals) {
      intervals.forEach(function(interval) {
        Interval.destroyById(interval.id, ctx.options, function () {
        });
      })
    })

    next()
  })

  Block.remoteMethod('paths', {
    accepts: [
      {arg: 'blockA', type: 'string', required: true}, // block reference
      {arg: 'blockB', type: 'string', required: true}, // block reference
      {arg: "options", type: "object", http: "optionsFromRequest"},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns paths between the two blocks"
  });

  Block.remoteMethod('pathsProgressive', {
    accepts: [
      {arg: 'blockA', type: 'string', required: true},
      {arg: 'blockB', type: 'string', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns paths between the two blocks, in progressive steps according to given parameters for range / resolution / page"
  });

  Block.remoteMethod('pathsByReference', {
    accepts: [
      {arg: 'blockA', type: 'string', required: true},
      {arg: 'blockB', type: 'string', required: true},
      {arg: 'reference', type: 'string', required: true},
      {arg: 'max_distance', type: 'number', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns paths between blockA and blockB via position on reference blocks blockB and blockC"
  });

  Block.remoteMethod('pathsViaStream', {
    accepts: [
      {arg: 'blockA', type: 'string', required: true},
      {arg: 'blockB', type: 'string', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Streams paths instead of throwing them all back to user"
  })

  Block.syntenies = function(id0, id1, thresholdSize, thresholdContinuity, cb) {
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

  Block.remoteMethod('syntenies', {
    accepts: [
      {arg: '0', type: 'string', required: true}, // block reference
      {arg: '1', type: 'string', required: true}, // block reference
      {arg: 'threshold-size', type: 'string', required: false}, // block reference
      {arg: 'threshold-continuity', type: 'string', required: false}, // block reference
    ],
    returns: {type: 'array', root: true},
    description: "Request syntenic blocks for left and right blocks"
  });

  acl.assignRulesRecord(Block)
  acl.limitRemoteMethods(Block)
  acl.limitRemoteMethodsSubrecord(Block)
  acl.limitRemoteMethodsRelated(Block)
};
