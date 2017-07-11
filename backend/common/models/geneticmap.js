'use strict';

// var async = require('async');
var Promise = require('bluebird')

module.exports = function(Geneticmap) {
  Geneticmap.afterRemote('find', function(ctx, output, next) {
    // console.log('> Geneticmap.find triggered');
    // console.log(output)
    ctx.result = {
      'geneticmaps': ctx.result
    };
    // console.log('next')
    next()
  })

  Geneticmap.upload = function(msg, cb) {

    msg = msg.geneticmap

    var arrayGeneticmaps = [{
      name: msg.name
    }]

    var arrayChromosomes = msg.chromosomes.map(function(chromosome) {
      return {
        name: chromosome.name
      }
    })

    var arrayMarkers = msg.chromosomes.map(function(chromosome) {
      return chromosome.markers.map(function(markers) {
        return markers
      })
    })

    var models = this.app.models;

    let jobsP = models.Geneticmap.create(arrayGeneticmaps)
    jobsP.then(function(data) {
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
    .then(function(data) {
      // completed additions to database
      cb(null, 'Success');
    })
    .catch(function(err) {
      console.log('ERROR', err)
      cb(err);
    })
  }

  Geneticmap.remoteMethod('upload', {
        accepts: { arg: 'data', type: 'object', http: { source: 'body' } },
        returns: {arg: 'greeting', type: 'string'},
        description: "Perform a bulk upload of a genetic map with associated chromosomes and markers"
  });
};

// NOTES
// the 'scope' property in the associated json file allows us to add in the
// relation to chromosomes. If this property is not added, then all we will receive
// is the high-level geneticmap info, and will have to perform another call to gather
// the chromosome info. While this is suitable in the short-term, in the long-term
// this may need to be changed if the number of chromosomes is high for the geneticmaps
// in aggregate