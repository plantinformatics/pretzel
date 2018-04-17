'use strict';

var acl = require('../utilities/acl')

module.exports = function(Feature) {
  Feature.search = function(filter, options, cb) {
    Feature.find({
        "include": 
        {
          "block": "dataset"
        },
        "where":
        {
          "name":
          {
            "inq": filter
          }
        }
    }, options).then(function(features) {
      // filter out the features for which the user doesn't have access to the dataset
      features = features.filter(function(feature) {
        return feature.__data.block.__data.dataset
      })
      return process.nextTick(() => cb(null, features))
    })
  }

  Feature.remoteMethod('search', {
    accepts: [
      {arg: 'filter', type: 'array', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {arg: 'features', type: 'array'},
    description: "Returns features and their datasets given an array of feature names"
  });
  
  acl.assignRulesRecord(Feature)
  acl.limitRemoteMethods(Feature)
  acl.limitRemoteMethodsSubrecord(Feature)
  acl.limitRemoteMethodsRelated(Feature)
};
