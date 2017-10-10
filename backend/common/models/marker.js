'use strict';

var acl = require('../utilities/acl')

module.exports = function(Marker) {
  var rules = [
    {
      'accessType': '*',
      'principalType': 'ROLE',
      'principalId': '$everyone',
      'permission': 'DENY',
    },
    {
      'accessType': '*',
      'principalType': 'ROLE',
      'principalId': '$authenticated',
      'permission': 'ALLOW',
    },
  ];
  acl.assign(Marker, rules);
};
