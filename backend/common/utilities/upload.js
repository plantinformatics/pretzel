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
 * @param {Object} msg - The dataset object to be processed
 * @param {Object} models - Loopback database models
 */
exports.json = (msg, models, options) => {
  // current json spec has high level dataset map prop with data nested
  var content = msg.dataset
  if (!content || !content.name) {
    throw Error("Unable to extract dataset from json");
  }
  return checkDatasetExists(content.name, models)
  .then(function(exists) {
    if (exists) {
      throw Error("Duplicate dataset");
    }
    var arrayDatasets = [{
      name: content.name,
    }]
    var arrayBlocks = content.blocks.map(function(block) {
      return {
        name: block.name,
      }
    })
    var arrayFeatures = content.blocks.map(function(block) {
      return block.features.map(function(features) {
        return features
      })
    })
  
    return models.Dataset.create(arrayDatasets, options)
    .then(function(data) {
      // gather the dataset map identifiers to attach to blocks
      let datasetId = data[0].id
      // attaching id to blocks
      arrayBlocks = arrayBlocks.map(function(block) {
        block.datasetId = datasetId
        return block
      })
      return models.Block.create(arrayBlocks, options)
    })
    .then(function(data) {
      // gather the dataset map identifiers to attach to features
      // attaching id to features
      arrayFeatures = arrayFeatures.map(function(blockFeatures, idx) {
        let blockId = data[idx].id
        return blockFeatures.map(function(feature) {
          if (!feature.aliases) feature.aliases = []
          feature.blockId = blockId
          return feature
        })
      })
      // concatenate the array features into a flat array
      arrayFeatures = [].concat.apply([], arrayFeatures);
      return models.Feature.create(arrayFeatures)
  
      // return createChunked(arrayFeatures, models.Feature, 5000)
    })
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
