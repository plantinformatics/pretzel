'use strict';

var acl = require('../utilities/acl')

module.exports = function(Workspace) {
  acl.assignRulesRecord(Workspace)
  acl.limitRemoteMethods(Workspace)
  acl.limitRemoteMethodsSubrecord(Workspace)
  acl.limitRemoteMethodsRelated(Workspace)
};
