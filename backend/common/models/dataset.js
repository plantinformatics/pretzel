'use strict';

var _ = require('lodash')

var acl = require('../utilities/acl')
var identity = require('../utilities/identity')
var upload = require('../utilities/upload')
var load = require('../utilities/load')

module.exports = function(Dataset) {

  Dataset.observe('access', function(ctx, next) {
    console.log('> Dataset.access');
    // identity.queryFilterAccessible(ctx)
    next()
  })

  Dataset.afterRemote('find', function(ctx, modelInstance, next) {
    console.log('> Dataset.loaded');
    next()
  })

  Dataset.observe('before save', function(ctx, next) {
    if (ctx.instance) {
      var newDate = Date.now();  
      // ctx.instance.createdAt = newDate;
      // ctx.Model.updatedAt = newDate;

      let clientId = identity.gatherClientId(ctx)
      if (clientId) {
        ctx.instance.clientId = clientId
      }
    }
    next();
  });

  Dataset.upload = function(msg, options, cb) {
    let clientId = identity.gatherClientId(options)
    var models = this.app.models;
    if (msg.fileName.endsWith('.json')) {
      try {
        var jsonMap = JSON.parse(msg.data);
      } catch (e) {
        console.log(e);
        cb(Error("Failed to parse JSON"));
      }
      upload.json(jsonMap, models, clientId)
      .then(function(data) {
        cb(null, 'Success');
      })
      .catch(function(err) {
        console.log(err);
        cb(err);
      })
    } else if (msg.fileName.endsWith('.gz')) {
      var buffer = new Buffer(msg.data, 'binary');
      load.gzip(buffer).then(function(json) {
        jsonMap = json;
        upload.json(jsonMap, models)
        .then(function(data) {
          cb(null, 'Success');
        })
        .catch(function(err) {
          console.log(err);
          cb(err);
        })
      })
      .catch(function(err) {
        console.log(err);
        cb(Error("Failed to read gz file"));
      })
    } else {
      cb(Error('Unsupported file type'));
    }
  }

  Dataset.tableUpload = function(data, options, cb) {
    let clientId = identity.gatherClientId(options)

    var models = this.app.models;
    var blocks = {};
    var datasetGroup = null;
    var blocks_by_name = [];
    var existing_blocks = [];

    models.Dataset.findById(data.dataset_id, {include: "blocks"}, options)
    .then(function(dataset) {
      if (dataset) {
        datasetGroup = dataset;
        data.features.forEach(function(feature) {
          blocks[feature.block] = false;
        });
        dataset.blocks().forEach(function(block) {
          if (block.name in blocks) {
            blocks[block.name] = true;
            existing_blocks.push(block.id);
            blocks_by_name[block.name] = block.id;
          }
        });
        // delete old features
        return models.Feature.deleteAll({blockId: {inq: existing_blocks}}, options)
      } else {
        cb(Error("Dataset not found"));
      }
    })
    .then(function(deleted_features) {
      return models.Block.updateAll({id: {inq: existing_blocks}}, {updatedAt: new Date()}, options)
    }).then(function(updated_blocks) {
      var new_blocks = [];
      Object.keys(blocks).forEach(function(name) {
        if (blocks[name] === false) {
          let payload = {
            name: name,
            datasetId: datasetGroup.id
          }
          if (clientId) {
            payload['clientId'] = clientId
          }
          new_blocks.push(payload);
        }
      });
      // create new blocks
      return models.Block.create(new_blocks);
    })
    .then(function(new_blocks) {
      new_blocks.forEach(function(block) {
        blocks_by_name[block.name] = block.id;
      });
      var array_features = [];
      data.features.forEach(function(feature) {
        array_features.push({
          name: feature.name,
          position: feature.pos,
          blockId: blocks_by_name[feature.block],
          aliases: []
        });
      });
      // create new features
      return models.Feature.create(array_features);
    })
    .then(function(new_features) {
      cb(null, "Successfully uploaded " + new_features.length + " features");
    });
  }

  Dataset.remoteMethod('upload', {
    accepts: [
      {arg: 'msg', type: 'object', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {arg: 'status', type: 'string'},
    description: "Perform a bulk upload of a dataset with associated blocks and features"
  });
  Dataset.remoteMethod('tableUpload', {
    accepts: [
      {arg: 'data', type: 'object', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {arg: 'status', type: 'string'},
    description: "Perform a bulk upload of a features from tabular form"
  });

  acl.assignRulesRecord(Dataset)
  acl.limitRemoteMethods(Dataset)
  acl.limitRemoteMethodsRelated(Dataset)
};
