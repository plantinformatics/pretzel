/* global process */
/* global module */
/* global require */

var clientGroups = require('../../common/utilities/client-groups');
var { ObjectId_equals } = require('../../common/utilities/mongoDB-driver-lib');

var { cirquePush, cirqueTail } = require('../../common/utilities/cirque');


module.exports = function(app) {
  var Role = app.models.Role;

  function isOwner(data, userId) {
    let ok = ObjectId_equals(data.clientId, userId);
    if (! ok) {
      cirquePush('isOwner ' + data.clientId + ', ' + userId);
    }
    return ok;
  }

  /**
   * @param data.groupId and clientId are BSON
   */
  function isInGroup(data, clientId) {
    /** expect that clientId is BSON; handle either.
     * clientGroups[clientId] is equivalent to clientGroups[clientIdString], but the latter is clearer.
     */
    let clientIdString = clientId.toHexString ? clientId.toHexString() : clientId;
    /** groupId of the Record (Dataset / Interval / Annotation / ). */
    let groupId = String(data.groupId);
    /** groups of the logged-in user.  String, from ClientGroups:update()). */
    let groups = clientGroups.clientGroups.clientGroups[clientIdString];
    console.log('isInGroup', clientIdString, groups, data);
    // can use ObjectId .equals() for comparing BSON with String
    let ok = groups.find((id) => id == groupId);
    if (! ok) {
      cirquePush('isInGroup ' + data.groupId + ', ' + clientId + ', ' + clientIdString + ', ' + JSON.stringify(groups));
    }
    return ok;
  }

  function isPublic(data) {
    return data.public
  }

  function isReadOnly(data) {
    return data.readOnly
  }

  function canRead(data, userId) {
    let ok = isOwner(data, userId) || isInGroup(data, userId) || isPublic(data);
    return ok;
  }

  function canWrite(data, userId) {
    if (isOwner(data, userId)) {
      return true;
    }
    if (isPublic(data) && !isReadOnly(data)) {
      return true;
    }
    return false;
  }

  function datasetPermissions(dataset, userId, permission, context, cb) {
    cb(permission(dataset, userId))
  }

  function blockPermissions(block, userId, permission, context, cb) {
    app.models.Dataset.findById(block.datasetId, {}, context)
    .then(function(dataset) {
      if (dataset) {
        datasetPermissions(dataset, userId, permission, context, cb)
      } else {
        return process.nextTick(() => cb(Error("Dataset not found"), false));
      }
    })
  }

  function featurePermissions(feature, userId, permission, context, cb) {
    app.models.Block.findById(feature.blockId, {}, context)
    .then(function(block) {
      if (block) {
        blockPermissions(block, userId, permission, context, cb)
      } else {
        return process.nextTick(() => cb(Error("Block not found"), false));
      }
    })
  }

  function clientPermissions(client, userId, permission, context, cb) {
    /** may check that client is in a group owned by userId.
     */
    cb(true);
  }

  function access(modelName, model, userId, permission, context, cb) {
    if (modelName == 'Dataset') {
      datasetPermissions(model, userId, permission, context, cb)
    } else if (modelName == 'Block') {
      blockPermissions(model, userId, permission, context, cb)
    } else if (modelName == 'Feature') {
      featurePermissions(model, userId, permission, context, cb)
    } else if (modelName == 'Client') {
      clientPermissions(model, userId, permission, context, cb)
    } else {
      const ok = permission(model, userId);
      if (! ok) {
        cirquePush('access ' + modelName + ', ' + userId);
        cirqueTail(10);
      }
      cb(ok);
    }
  }

  function genericResolver(role, context, cb) {    
    if (!context.accessToken || !context.accessToken.userId) {
      // Not logged in -> deny
      return process.nextTick(() => cb(null, false))
    }
    if (context.property == 'find' ||
      context.property ==  'create' ||
        // Dataset
      context.property == 'upload' ||
      context.property == 'tableUpload' ||
      context.property == 'createComplete' ||
        // Feature
      context.property == 'search' ||
      context.property == 'aliasSearch' ||
      context.property == 'depthSearch' ||
      context.property == 'dnaSequenceSearch' ||
      context.property == 'dnaSequenceLookup' ||
        // Alias
      context.property == 'bulkCreate' ||
        // Block
      context.property == 'paths' ||
      context.property == 'pathsProgressive' ||
      context.property == 'blockFeaturesAdd' ||
      context.property == 'blockFeaturesCount' ||
      context.property == 'blockFeaturesCounts' ||
      context.property == 'blockFeatureLimits' ||
      context.property == 'blockValues' ||
      context.property == 'blockFeaturesInterval' ||
      context.property == 'pathsByReference' ||
      context.property == 'pathsViaStream' ||
      context.property == 'pathsAliasesProgressive' ||
      context.property == 'pathsAliasesViaStream' ||
      context.property == 'namespacesAliases' ||
        // Configuration
      context.property === 'runtimeConfig' ||
        // Ontology
      context.property === 'getTree' ||
        // Dataset
      context.property === 'cacheClear' ||
      context.property === 'cacheClearRequests' ||
        // Group 
      context.property === 'own' ||
      context.property === 'in' ||
        // addMember not used
        // ClientGroup 
      context.property === 'addEmail' ||

        // end of list
        false
       ) {
      // allow find, create and upload requests
      return process.nextTick(() => cb(null, true))
    }
    if (!context.modelId) {
      // No model id -> deny
      return process.nextTick(() => cb(null, false))
    }

    let userId = context.accessToken.userId
    let modelName = context.modelName

    let permission = canWrite;
    if (role == 'viewer') {
      permission = canRead;
    }

    //Retrieve the model
    context.model.findById(context.modelId, {}, context)
    .then(function(model) {
      if (model) {
        access(modelName, model, userId, permission, context, function(allow) {
          cb(null, allow)
        })
      } else {
        cb(Error(`${modelName} not found`), false)
      }
    })
  }

  Role.registerResolver('viewer', genericResolver)
  Role.registerResolver('editor', genericResolver)
};

console.log('lb3app/server/boot/access.js');
