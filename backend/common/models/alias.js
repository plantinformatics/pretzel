'use strict';

/* global require */
/* global module */

var acl = require('../utilities/acl')

const { getAliases, cacheClearAliases } = require('../utilities/localise-aliases');

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

  Alias.namespacesAliases = function(namespaces, limit, options, res, cb) {
    console.log('namespacesAliases', namespaces);
    Alias.dataSource.connector.connect(function(err, db) {
      getAliases(db, namespaces, limit)
        .toArray()
        .then(function(result) {
          cb(null, result);
        })
        .catch(function(err) {
          console.log('namespacesAliases', 'ERROR', err, namespaces, limit);
          cb(err);
        });

    });
  };

  Alias.remoteMethod('namespacesAliases', {
    accepts: [
      {arg: 'namespaces', type: 'array', required: true}, // namespace0,1 reference
      {arg: 'limit', type: 'number', required: false},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', http: {source: 'res'}}
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns aliases between the two namespaces"
  });

  /*--------------------------------------------------------------------------*/


  Alias.cacheClear = function(time, options, cb) {
    let db = this.dataSource.connector;
    cacheClearAliases(db, time)
      .then((removed) => cb(null, removed))
      .catch((err) => cb(err));
  };
  


  Alias.remoteMethod('cacheClear', {
    accepts: [
      {arg: 'time', type: 'number', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {type: 'any', root: true},
   description: "Clear cached copies of aliases from a secondary Pretzel API server."
  });


  /*--------------------------------------------------------------------------*/


  acl.assignRulesRecord(Alias)
  acl.limitRemoteMethods(Alias)
  acl.limitRemoteMethodsSubrecord(Alias)
  acl.limitRemoteMethodsRelated(Alias)
};
