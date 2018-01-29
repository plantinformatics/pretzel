'use strict';

var fs = require('fs');
var Promise = require('bluebird')

/**
 * Divide array into smaller chunks
 * @param {Array} arr - array of data to be processed
 * @param {String} len - array chunk length
 */
function chunk (arr, len) {
  var chunks = [];
  var i = 0;
  var n = arr.length;
  while (i < n) {
    chunks.push(arr.slice(i, i += len));
  }
  return chunks;
}

/**
 * Perform chunked database object creation
 * @param {Array} data - array of objects / object
 * @param {Object} model - Loopback database model
 * @param {String} len - array chunk length
 */
function createChunked (data, model, len) {
  console.log('createChunked')
  var dataChunked = chunk(data, len)
  console.log('creating data', data.length)
  console.log('creating data chunked', dataChunked.length)

  // dataChunked = dataChunked.slice(0, 2)

  return model.create(data)

  // return Promise.all(dataChunked.map(model.create)).then(data => {
  //   console.log('num jobs' + data.length);
  //   return 'done'
  // });

  // var promises = []

  // dataChunked.forEach(function(chunk) {
  //   console.log('model create')
  //   promises.push(
  //     model.create(chunk)
  //     .then(function(data) {
  //       console.log('done chunk')
  //       return 'done'
  //     })
  //   )
  // })

  // // console.log(promises)

  // return Promise.all(promises)
  // .catch(function(err) {
  //   console.log('ERROR', err)
  // })


  // return Promise.reduce(dataChunked, function(total, chunk) {
  //   console.log('promise')
  //   return model.create(chunk)
  //   .then(function(data) {
  //     console.log('done data batch')
  //     return 'done'
  //   })
  // })
  // .then(function(results) {
  //   console.log('done with upload')
  //   return true
  // })
}

/**
 * Send a json dataset structure to the database
 * @param {Object} data - The dataset object to be processed
 * @param {Object} models - Loopback database models
 */
exports.uploadDataset = (data, models, options, cb) => {
  try {
    //create dataset
    models.Dataset.create(data, options)
    .then(function(dataset) {
      if (dataset.__cachedRelations.blocks) {
        dataset.__cachedRelations.blocks.forEach(function(json_block) {
          json_block.datasetId = dataset.id
        })
        //create blocks
        models.Block.create(dataset.__cachedRelations.blocks, options)
        .then(function(blocks) {
          let json_workspaces = []
          blocks.forEach(function(block) {
            if (block.__cachedRelations.workspaces) {
              block.__cachedRelations.workspaces.forEach(function(json_workspace) {
                json_workspace.blockId = block.id
                json_workspaces.push(json_workspace)
              })
            }
          })
          if (json_workspaces.length > 0) {
            //create workspaces
            models.Workspace.create(json_workspaces, options)
            .then(function(workspaces) {
              let json_features = [];
              workspaces.forEach(function(workspace) {
                if (workspace.__cachedRelations.features) {
                  workspace.__cachedRelations.features.forEach(function(json_feature) {
                    json_feature.workspaceId = workspace.id
                    json_features.push(json_feature)
                  })
                }
              })
              if (json_features.length > 0) {
                //create features
                models.Feature.create(json_features, options)
                .then(function(features) {
                  cb(null, dataset.id)
                })
              } else {
                cb(null, dataset.id)
              }
            })
          } else {
            cb(null, dataset.id)
          }
        })
      } else {
        cb(null, dataset.id)
      }
    })
    .catch(function(e) {
      cb(e)
    })
  } catch(e) {
    cb(e)
  }
}

/**
 * Check whether the specified dataset already exists in the db
 * @param {Object} name - the name of dataset to check
 * @returns {boolean} - true if exists
 */
function checkDatasetExists(name, models) {
  return models.Dataset.find({where: {name: name}, limit: 1})
  .then(function(results) {
    return results.length > 0;
  });
}
