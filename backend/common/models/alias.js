'use strict';

var acl = require('../utilities/acl')

module.exports = function(Alias) {

  Alias.bulkCreate = function(data, options, req, cb) {
    req.setTimeout(0);
    Alias.create(data, options)
    .then(function(aliases) {
      cb(null, aliases.length);
    }).catch(function(e) {
      cb(e);
    })
  }

  Alias.remoteMethod('bulkCreate', {
    accepts: [
      {arg: 'data', type: 'array', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: "req", type: "object", http: {source: "req"}}
    ],
    returns: {arg: 'count', type: 'int'},
    description: "Creates an array of aliases"
  });

  acl.assignRulesRecord(Alias)
  acl.limitRemoteMethods(Alias)
  acl.limitRemoteMethodsSubrecord(Alias)
  acl.limitRemoteMethodsRelated(Alias)
};
