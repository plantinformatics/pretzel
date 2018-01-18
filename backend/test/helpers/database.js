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

exports.destroyDatasetsAll = function(models) {
  // empty persisted storage for datasets
  var Dataset = models.Dataset;
  var Block = models.Block;
  var Feature = models.Feature;
  return Dataset.destroyAll()
  .then(function(data) {
    return Block.destroyAll()
  })
  .then(function(data) {
    return Feature.destroyAll()
  })
}