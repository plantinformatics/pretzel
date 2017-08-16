'use strict';

exports.destroyUserByEmail = function(models, email) {
  // discover used by email, delete if present
  var Client = models.Client;
  return Client.findOne({where: {email: email}})
  .then(function(data) {
    if (data) {
      return Client.destroyById(data.id)
    } else {
      return null
    }
  })
}

exports.destroyGeneticmapsAll = function(models) {
  // empty persisted storage for geneticmaps
  var Geneticmap = models.Geneticmap;
  var Chromosome = models.Chromosome;
  var Marker = models.Marker;
  return Geneticmap.destroyAll()
  .then(function(data) {
    return Chromosome.destroyAll()
  })
  .then(function(data) {
    return Marker.destroyAll()
  })
}