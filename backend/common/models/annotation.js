'use strict';

var acl = require('../utilities/acl')

module.exports = function(Interval) {
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
  acl.assign(Interval, rules);

  Interval.beforeCreate = function(next, model) {
    var newDate = Date.now();
    model.createdAt = newDate;
    model.updatedAt = newDate;
    next();
  };

  Interval.beforeUpdate = function(next, model) {
    model.updatedAt = Date.now();
    next();
  };
};
