'use strict';

var _ = require('lodash');

var acl = require('../utilities/acl');
var identity = require('../utilities/identity');
var upload = require('../utilities/upload');
var load = require('../utilities/load');

module.exports = function(Dataset) {

  Dataset.upload = function(msg, options, req, cb) {
    req.setTimeout(0);
    var models = this.app.models;
    // Common steps for both .json and .gz files after parsing
    const uploadParsed = (jsonMap) => {
      if(!jsonMap.name){
        cb(Error('Dataset JSON has no "name" field (required)'));
      } else {
        // Check if dataset name already exists
        // Passing option of 'unfiltered: true' overrides filter for public/personal-only
        models.Dataset.exists(jsonMap.name, { unfiltered: true }).then((exists) => {
          if (exists) {
            cb(Error(`Dataset name "${jsonMap.name}" is already in use`));
          } else {
            // Should be good to process saving of data
            upload.uploadDataset(jsonMap, models, options, cb);
          }
        })
        .catch((err) => {
          console.log(err);
          cb(Error('Error checking dataset existence'));
        });
      }
    };
    // Parse as either .json or .gz
    if (msg.fileName.endsWith('.json')) {
      try {
        let jsonMap = JSON.parse(msg.data);
        uploadParsed(jsonMap);
      } catch (e) {
        console.log(e);
        cb(Error("Failed to parse JSON"));
      }
    } else if (msg.fileName.endsWith('.gz')) {
      var buffer = new Buffer(msg.data, 'binary');
      load.gzip(buffer).then(function(json) {
        let jsonMap = json;
        uploadParsed(jsonMap);
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
            scope: name,
            datasetId: datasetGroup.id,
            namespace: data.namespace
          }
          new_blocks.push(payload);
        }
      });
      // create new blocks
      return models.Block.create(new_blocks, options);
    })
    .then(function(new_blocks) {
      new_blocks.forEach(function(block) {
        blocks_by_name[block.name] = block.id;
      });
      var array_features = [];
      data.features.forEach(function(feature) {
        array_features.push({
          name: feature.name,
          value: [feature.val],
          blockId: blocks_by_name[feature.block]
        });
      });
      // create new features
      return models.Feature.create(array_features);
    })
    .then(function(new_features) {
      cb(null, "Successfully uploaded " + new_features.length + " features");
    });
  }

  Dataset.createComplete = function(data, options, req, cb) {
    req.setTimeout(0);
    var models = this.app.models;
    upload.uploadDataset(data, models, options, cb);
  }

  Dataset.observe('before delete', function(ctx, next) {
    var Block = ctx.Model.app.models.Block
    Block.find({
      where: {
        datasetId: ctx.where.and[1].name
      }
    }, ctx.options).then(function(blocks) {
      blocks.forEach(function(block) {
        Block.destroyById(block.id, ctx.options, function () {
        });
      })
    })
    next()
  })

  Dataset.remoteMethod('upload', {
    accepts: [
      {arg: 'msg', type: 'object', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: "req", type: "object", http: {source: "req"}}
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
  Dataset.remoteMethod('createComplete', {
    accepts: [
      {arg: 'data', type: 'object', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: "req", type: "object", http: {source: "req"}}
    ],
    returns: {arg: 'id', type: 'string'},
    description: "Creates a dataset and all of its children"
  });

  acl.assignRulesRecord(Dataset);
  acl.limitRemoteMethods(Dataset);
  acl.limitRemoteMethodsRelated(Dataset);
};
