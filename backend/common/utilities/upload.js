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
 * Send a json geneticmap structure to the database
 * @param {Object} msg - The geneticmap object to be processed
 * @param {Object} models - Loopback database models
 */
exports.json = (msg, models) => {
  console.log('start uploading json to database')
  // current json spec has high level genetic map prop with data nested
  var content = msg.geneticmap
  console.log(content)
  var arrayGeneticmaps = [{
    name: content.name
  }]
  var arrayChromosomes = content.chromosomes.map(function(chromosome) {
    return {
      name: chromosome.name
    }
  })
  var arrayMarkers = content.chromosomes.map(function(chromosome) {
    return chromosome.markers.map(function(markers) {
      return markers
    })
  })

  return models.Geneticmap.create(arrayGeneticmaps)
  .then(function(data) {
    // gather the genetic map identifiers to attach to chromosomes
    console.log('created geneticmaps', data)
    let geneticmapId = data[0].id
    // attaching id to chromosomes
    arrayChromosomes = arrayChromosomes.map(function(chromosome) {
      chromosome.geneticmapId = geneticmapId
      return chromosome
    })
    return models.Chromosome.create(arrayChromosomes)
  })
  .then(function(data) {
    // gather the genetic map identifiers to attach to markers
    console.log('created chromosomes', data)
    // attaching id to markers
    arrayMarkers = arrayMarkers.map(function(chromosomeMarkers, idx) {
      let chromosomeId = data[idx].id
      return chromosomeMarkers.map(function(marker) {
        if (!marker.aliases) marker.aliases = []
        marker.chromosomeId = chromosomeId
        return marker
      })
    })
    // concatenate the array markers into a flat array
    arrayMarkers = [].concat.apply([], arrayMarkers);
    return models.Marker.create(arrayMarkers)

    // return createChunked(arrayMarkers, models.Marker, 5000)
  })
  .catch(function(err) {
    console.log('ERROR', err)
    throw err
  })
}

/**
 * Perform upload after confirming data not already uploaded
 * @param {string} data - path to load the file
 * @callback cb
 */
exports.jsonCheckDuplicate = (data, models) => {

  console.log('jsonCheckDuplicate')
  let name = data.geneticmap.name

  console.log(name)

  return models.Geneticmap.find({where: {name: name}, limit: 3})
  .then(function(results) {
    // console.log(results)
    if (results.length < 1) {
      console.log('uploading json to database')
      return exports.json(data, models)
    } else {
      throw Error(`entry already in database!`)
    }
  })
  .then(function(results) {
    console.log('done with upload')
    return true
  })
}