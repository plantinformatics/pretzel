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
  let dataset_id
  let json_blocks = []
  let json_annotations = []
  let json_intervals = []
  let json_features = []

  //create dataset
  models.Dataset.create(data, options)
  .then(function(dataset) {
    dataset_id = dataset.name
    if (dataset.__cachedRelations.blocks) {
      dataset.__cachedRelations.blocks.forEach(function(json_block) {
        json_block.datasetId = dataset.id
        if (json_block.namespace == null && data.namespace != null) {
          json_block.namespace = data.namespace;
        }
        json_blocks.push(json_block)
      })
    }
    //create blocks
    return models.Block.create(json_blocks, options)
  }).then(function(blocks) {
    blocks.forEach(function(block) {
      if (block.__cachedRelations.annotations) {
        block.__cachedRelations.annotations.forEach(function(json_annotation) {
          json_annotation.blockId = block.id
          json_annotations.push(json_annotation)
        })
      }
      if (block.__cachedRelations.intervals) {
        block.__cachedRelations.intervals.forEach(function(json_interval) {
          json_interval.blockId = block.id
          json_intervals.push(json_interval)
        })
      }
      if (block.__cachedRelations.features) {
        block.__cachedRelations.features.forEach(function(json_feature) {
          json_feature.blockId = block.id;
          json_feature.parentId = null;
          json_features.push(json_feature);
        })
      }
    })
    //create annotations
    return models.Annotation.create(json_annotations, options)
  }).then(function(annotations) {
    //create intervals
    return models.Interval.create(json_intervals, options)
  }).then(function(intervals) {
    //create features using connector for performance
    models.Feature.dataSource.connector.connect(function(err, db) {

      let insert_features_recursive = function(features_to_insert) {
        // no more features
        if (features_to_insert.length == 0) {
          return process.nextTick(() => cb(null, dataset_id));
        }

        let next_level_features = [];
        // collect and prepare next level features
        features_to_insert.forEach(function(feature, i) {
          if (feature.features) {
            feature.features.forEach(function(child_feature) {
              child_feature.blockId = feature.blockId;
              // save parent index to link with children after insertion
              child_feature.parentIndex = i;
              next_level_features.push(child_feature);
            });
            delete feature.features;
          }
        })

        // insert current features
        db.collection('Feature').insertMany(features_to_insert)
        .then(function(result) {
          // console.log(result);
          // link parent ids
          next_level_features.forEach(function(child_feature) {
            child_feature.parentId = result.insertedIds[child_feature.parentIndex];
            delete child_feature.parentIndex;
          });
          // insert next level
          insert_features_recursive(next_level_features);
        })

      };

      insert_features_recursive(json_features);
    });
  }).catch(function(e){
    cb(e)
  });
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
