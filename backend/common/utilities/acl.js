'use strict';

/**
 * Assign ACL rules to model according to environment configuration
 * @param {Object} model - Loopback database model
 * @param {Array} acls - array of ACL objects as per loopback configuration
 * @returns data
 */
exports.assign = (model, acls) => {
  if (process.env.AUTH !== 'NONE') {
    for (var index = 0; index < acls.length; index++) {
      var rule = acls[index];
      model.settings.acls.push(rule);
    }
  } else {
    console.warn(`No ACL assigned for ${model.modelName}`);
  }
};

/**
 * Assign ACL rules according to desired Record ownership structure
 * @param {Object} model - Loopback database model
 */
exports.assignRulesRecord = (model) => {
  var rules = [
    {
      'accessType': '*',
      'principalType': 'ROLE',
      'principalId': '$everyone',
      'permission': 'DENY',
    },
    {
      'accessType': 'READ',
      'principalType': 'ROLE',
      'principalId': 'viewer',
      'permission': 'ALLOW',
    },
    {
      'accessType': 'WRITE',
      'principalType': 'ROLE',
      'principalId': 'editor',
      'permission': 'ALLOW',
    }
  ];
  exports.assign(model, rules);
};


/**
 * Limit model methods to those required for Pretzel application
 * @param {Object} model - Loopback database model
 */
exports.limitRemoteMethods = (model) => {

  var methodNames = [
    // 'create',
    'upsert',
    // 'deleteById',
    'updateAll',
    // 'updateAttributes',
    // 'patchAttributes',
    'createChangeStream',
    'findOne',
    // 'find',
    // 'findById',
    'count',
    'exists',
    'replace',
    'replaceById',
    'upsertWithWhere',
    'replaceOrCreate'
  ];

  methodNames.forEach(function (methodName) {
    if (!!model.prototype[methodName]) {
      model.disableRemoteMethodByName('prototype.' + methodName);
    } else {
      model.disableRemoteMethodByName(methodName);
    }
  });

}

/**
 * Limit subrecord model methods to those required for Pretzel application
 * @param {Object} model - Loopback database model
 */
exports.limitRemoteMethodsSubrecord = (model) => {

  var methodNames = [
    // 'create',
    // 'deleteById',
    // 'updateAttributes',
    // 'patchAttributes',
    'find',
    // 'findById',
  ];

  methodNames.forEach(function (methodName) {
    if (!!model.prototype[methodName]) {
      model.disableRemoteMethodByName('prototype.' + methodName);
    } else {
      model.disableRemoteMethodByName(methodName);
    }
  });

}

/**
 * Limit related model methods to those required for Pretzel application
 * @param {Object} model - Loopback database model
 */
exports.limitRemoteMethodsRelated = (model) => {

  var relationMethods = [];
  
  try {
    Object.keys(model.definition.settings.relations).forEach(function(relation) {

      var nameMethods = ['findById', 'destroyById', 'updateById', 'exists',
        'link', 'get', 'create', 'update', 'destroy', 'unlink', 'count', 'delete']
      
      nameMethods.forEach(function(method) {
        relationMethods.push({ name: `prototype.__${method}__${relation}`});
      });
    });
  } catch(err) {
    throw err
  }

  relationMethods.forEach(function(method) {
    var methodName = method.name;
    model.disableRemoteMethodByName(methodName);
  });

}