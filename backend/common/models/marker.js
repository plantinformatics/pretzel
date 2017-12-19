'use strict';

var acl = require('../utilities/acl')

module.exports = function(Marker) {
  acl.assignRulesRecord(Marker)
  acl.limitRemoteMethods(Marker)
  acl.limitRemoteMethodsSubrecord(Marker)
  acl.limitRemoteMethodsRelated(Marker)
};
