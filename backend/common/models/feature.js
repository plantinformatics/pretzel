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
  };

  Feature.depthSearch = function(blockId, depth, options, cb) {
    let include_n_level_features = function(includes, n) {
      if (n < 1) {
        return includes;
      }
      return include_n_level_features({'features': includes}, n-1);
    }

    Feature.find({
      "where": {
        "blockId": blockId,
        "parentId": null
      },
      'include': include_n_level_features({}, depth)
    }, options).then(function(features) {
      return process.nextTick(() => cb(null, features));
    });
  };

  Feature.remoteMethod('search', {
    accepts: [
      {arg: 'filter', type: 'array', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {arg: 'features', type: 'array'},
    description: "Returns features and their datasets given an array of feature names"
  });

  Feature.remoteMethod('depthSearch', {
    accepts: [
      {arg: 'blockId', type: 'string', required: true},
      {arg: 'depth', type: 'number', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {arg: 'features', type: 'array'},
    description: "Returns features by their level in the feature hierarchy"
  });
  
  acl.assignRulesRecord(Feature)
  acl.limitRemoteMethods(Feature)
  acl.limitRemoteMethodsSubrecord(Feature)
  acl.limitRemoteMethodsRelated(Feature)
};
