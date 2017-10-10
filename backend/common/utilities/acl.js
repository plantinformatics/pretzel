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
