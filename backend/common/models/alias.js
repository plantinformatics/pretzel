'use strict';

var acl = require('../utilities/acl')

module.exports = function(Alias) {

  Alias.bulkCreate = function(data, options, req, cb) {
    req.setTimeout(0);
    //validate
    data.forEach(function(row, i) {
      if (!row['string1'] || !row['string2']) {
        return process.nextTick(() => cb('Error in row ' + i + '. Alias requires string1 and string2 to be defined'));
      }
    });

    //insert many using connector for performance reasons
    Alias.dataSource.connector.connect(function(err, db) {
      db.collection('Alias').insertMany(data)
      .then(function(result) {
        cb(null, result.insertedCount);
      })
    });
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
