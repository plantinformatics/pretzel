'use strict';

var acl = require('../utilities/acl')

module.exports = function(Interval) {
  Interval.beforeCreate = function(next, model) {
    next();
  };

  Interval.beforeUpdate = function(next, model) {
    next();
  };

  acl.assignRulesRecord(Interval)
  acl.limitRemoteMethods(Interval)
  acl.limitRemoteMethodsSubrecord(Interval)
  acl.limitRemoteMethodsRelated(Interval)
};
