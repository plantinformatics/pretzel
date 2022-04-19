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
    const fnName = 'isInGroup';
    /** expect that clientId is BSON; handle either.
     * clientGroups[clientId] is equivalent to clientGroups[clientIdString], but the latter is clearer.
     */
    let clientIdString = clientId.toHexString ? clientId.toHexString() : clientId;
    let ok;
    /** data.groupId is the groupId of the Record (Dataset / Interval / Annotation / ),
     * and Group defines an equivalent getter which accesses data.getId(). */
    let groupId = (typeof data.groupId === 'function') ? data.groupId() : data.groupId;
    if (! groupId) {
      console.log(fnName, clientIdString, JSON.stringify(data));
    } else {
      groupId = '' + groupId;
      /** groups of the logged-in user.  String, from ClientGroups:update()). */
      let groups = clientGroups.clientGroups.clientGroups[clientIdString];
      // console.log('isInGroup', clientIdString, groups, groupId, data);
      // can use ObjectId .equals() for comparing BSON with String
      ok = groups.find((id) => id == groupId);
      if (! ok) {
        cirquePush('isInGroup ' + JSON.stringify(data) + ', ' + clientIdString + ', ' + JSON.stringify(groups));
      }
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
    if (! ok) {
      cirquePush('canRead ' + JSON.stringify(data) + ', ' + userId);
    }
    return ok;
  }

  function canWrite(data, userId) {
    if (isOwner(data, userId)) {
      return true;
    }
    if (isPublic(data) && !isReadOnly(data)) {
      return true;
    }
    if (true /*! ok*/) {
      cirquePush('canWrite ' + JSON.stringify(data) + ', ' + userId);
    }
    return false;
  }

  function datasetPermissions(dataset, userId, permission, context, cb) {
    cb(null, permission(dataset, userId))
  }

  function blockPermissions(block, userId, permission, context, cb) {
    // app.models.Dataset.find({where : {_id : block.datasetId}}, context.options)
    let options = Object.assign({ unfiltered: true }, context.options);
    app.models.Dataset.findById(block.datasetId, {}, options)
    .then(function(dataset) {
      // let dataset = datasets.length && datasets[0];
      console.log('blockPermissions', block.datasetId, dataset);
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
    cb(null, true);
  }

  /**
   * @param role used only in cirque trace, if ! ok
   */
  function access(modelName, model, userId, permission, context, role, cb) {
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
        cirquePush('access ' + [role, context.accessType, context.method, context.modelId, modelName, userId].join(','));
        cirqueTail(10);
      }
      cb(null, ok);
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
//      context.property == 'blockFeaturesCounts' ||
      context.property == 'blockFeatureLimits' ||
      context.property == 'blockValues' ||
//      context.property == 'blockFeaturesInterval' ||
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
        access(modelName, model, userId, permission, context, role, cb);
      } else {
        let error = Error(`${modelName} not found`);
        /** default is 500; 404 seems correct because context.model is defined;
         * change just for Group initially.  */
        if (modelName === 'Group') {
          error.statusCode = 404;
        }
        cb(error, false);
      }
    })
  }

  Role.registerResolver('viewer', genericResolver)
  Role.registerResolver('editor', genericResolver)
};

console.log('lb3app/server/boot/access.js');
