'use strict';

var fs = require('fs');

/**
 * Send a json geneticmap structure to the database
 * @param {Object} msg - The geneticmap object to be processed
 * @param {Object} models - Loopback database models
 */
exports.json = (msg, models) => {
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

  let jobsP = models.Geneticmap.create(arrayGeneticmaps)
  return jobsP
  .then(function(data) {
    // gather the genetic map identifiers to attach to chromosomes
    console.log('created geneticmaps')
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
    console.log('created chromosomes')
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
  })
  .catch(function(err) {
    console.log('ERROR', err)
    cb(err);
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

  models.Geneticmap.find({where: {name: name}, limit: 3})
  .then(function(results) {
    // console.log(results)
    if (results.length < 1) {
      return exports.json(data, models)
    } else {
      throw Error(`entry already in database!`)
    }
  })
  .catch(console.log.bind.console)
}