'use strict';

var acl = require('../utilities/acl')

module.exports = function(Marker) {
  acl.assignRulesRecord(Marker)
};
