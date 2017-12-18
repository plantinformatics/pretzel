'use strict';

var acl = require('../utilities/acl')

module.exports = function(Annotation) {
  Annotation.beforeCreate = function(next, model) {
    next();
  };

  Annotation.beforeUpdate = function(next, model) {
    next();
  };

  acl.assignRulesRecord(Annotation)
  acl.limitRemoteMethods(Annotation)
};
