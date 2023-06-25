/* global process */
/* global module */
/* global require */

var clientGroups = require('../../common/utilities/client-groups');
var { clientIsInGroup } = require('../../common/utilities/identity');
var { ObjectId_equals } = require('../../common/utilities/mongoDB-driver-lib');
var ObjectId = require('mongodb').ObjectID;

var { cirquePush, cirqueTail } = require('../../common/utilities/cirque');


module.exports = function(app) {
  var Role = app.models.Role;

  /** @return true if data.clientId equals userId.
   * @param data may be Record (Dataset, Annotation, Interval) or Group,
   * which all have property .clientId
   * @param userId  clientId
   */
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
      ok = clientIsInGroup(clientId, groupId);
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

  function canWriteModel(modelName) {
  return function canWrite(data, userId) {
    if (isOwner(data, userId)) {
      return true;
    }
    if (modelName !== 'group') {
      if (isPublic(data) && !isReadOnly(data)) {
        return true;
      }
    }
    if (true /*! ok*/) {
      cirquePush('canWrite ' + JSON.stringify(data) + ', ' + userId);
    }
    return false;
  };
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
      console.log('blockPermissions', block.datasetId, dataset?.groupId);
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

  /** Check : only group owner can write to a group;  group members can read. */
  function groupPermissions(group, userId, permission, context, cb) {
    const ok = permission(group, userId);
    if (! ok) {
      cirqueTail(10);
    }
    cb(null, ok);
  }

  /** Functions which check the access permissions for a given model.
   * Signature is : (model, userId, permission, context, cb);
   * Each function is required to call cb().
   */
  const modelPermissions = {
    datasetPermissions,
    blockPermissions,
    featurePermissions,
    clientPermissions,
    groupPermissions,
  };

  /**
   * @param model object found from id param (context.modelId).
   * This is not context.model which is the class of the object.
   * @param role used only in cirque trace, if ! ok
   */
  function access(modelName, model, userId, permission, context, role, cb) {
    const
    pfnName = modelName.toLowerCase() + 'Permissions',
    modelPermissionsFn = modelPermissions[pfnName];
    if (modelPermissionsFn) {
      modelPermissionsFn(model, userId, permission, context, cb);
    } else {
      const ok = permission(model, userId);
      if (! ok) {
        cirquePush('access ' + [role, context.accessType, context.method, context.modelId, modelName, userId].join(','));
        cirqueTail(10);
      }
      cb(null, ok);
    }
    /** cb() is called in all cases. */
  }

  /**
   * @return undefined
   *
   * @desc
   * process.nextTick() does not return a value.  refn : node:internal/process/task_queues
   * genericResolver() is called from Role.isInRole() (node_modules/loopback/common/models/role.js)
   *   const promise = resolver(role, context, callback);
   * which does not use an undefined result.
   *
   * Possibly uses of nextTick() can be replaced with setImmediate(), refn:
   * https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/#process-nexttick-vs-setimmediate
   */
  function genericResolver(role, context, cb) {
    const fnName = 'genericResolver';
    if (!context.accessToken || !context.accessToken.userId) {
      // Not logged in -> deny
      return process.nextTick(() => cb(null, false))
    }

    if (
      context.property == 'find' ||
      context.property ==  'create' ||
        // Dataset
      context.property == 'upload' ||
      context.property == 'tableUpload' ||
      context.property == 'createComplete' ||
        // Feature
      context.property == 'search' ||
      context.property == 'searchPost' ||
      context.property == 'aliasSearch' ||
      context.property == 'depthSearch' ||
      context.property == 'dnaSequenceSearch' ||
      context.property == 'dnaSequenceLookup' ||
      context.property == 'genotypeSamples' ||
      context.property == 'vcfGenotypeLookup' ||
      context.property == 'vcfGenotypeLookupPost' ||
        // Alias
      context.property == 'bulkCreate' ||
        // Block
      context.property == 'blockFeaturesAdd' ||
      context.property == 'blockFeaturesCount' ||
//      context.property == 'blockFeaturesCounts' ||
      context.property == 'blockFeatureLimits' ||
      context.property == 'blockValues' ||
//      context.property == 'blockFeaturesInterval' ||
      context.property == 'namespacesAliases' ||
        // Configuration
      context.property === 'runtimeConfig' ||
      context.property === 'version' ||
        // Ontology
      context.property === 'getTree' ||
        // Dataset
      context.property === 'cacheClear' ||
      context.property === 'cacheClearRequests' ||
      context.property === 'naturalSearch' ||
      context.property === 'text2Commands' ||
        // Group 
      context.property === 'own' ||
      context.property === 'in' ||
        /*  additional resolve check for /addMember : param addId.        */
      context.property === 'addMemberEmail' ||
        // ClientGroup 
      context.property === 'addEmail' ||

        // end of list
        false
       ) {
      // allow find, create and upload requests
      return process.nextTick(() => cb(null, true))
    } else if (context.property.startsWith('paths')) {
      resolve2Blocks(role, context, cb);
    }
    else {

      if (!context.modelId) {
        // No model id -> deny
        return process.nextTick(() => cb(null, false))
      }

      let userId = context.accessToken.userId;
      let modelName = context.modelName

      let permission = canWriteModel(modelName);
      if (role == 'viewer') {
        permission = canRead;
      }

      /** Check the primary model, then if OK, afterPrimaryModel() will check
       * param addId if Group/addMember.
       */

      function checkAccess(object) {
        access(modelName, object, userId, permission, context, role, cb);
      }

      function afterPrimaryModel(primaryObject) {
        if (context.property === 'addMember') {
          const
          clientModel = context.model.app.models.Client,
          /* The authenticated clientId can be accessed from these equivalents :
           *   context.getUserId().toHexString()
           *   context.getUser().id.toHexString()
           *   context.principals[0].id.toHexString()
           * This is the addId parameter of the API request.
           */
          clientId = context.remotingContext.args.addId;

          retrieveModel(
            context, 'Client', clientModel, clientId, cb,
            (object) => checkAccess(primaryObject));
        } else {
          checkAccess(primaryObject);
        }
      }

      //Retrieve the model
      retrieveModel(
        context, modelName, context.model, context.modelId, cb, afterPrimaryModel);

    }
    /** cb() should be called in all cases.
     * As noted in header comment, process.nextTick() does not return a value.
     */
  }

  /** Retrieve a model
   * Call either cb or okFn
   * @param modelName e.g. 'Client', 'Group', 
   * @param model Model definition class
   * @param modelId string id of object 
   * @param cb
   * @param okFn  (object)
   */
  function retrieveModel(context, modelName, model, modelId, cb, okFn)
  {
    const fnName = 'retrieveModel';
    // context.property === 'addMember'
    model.findById(modelId, {}, context)
      .then(function(object) {
        if (object) {
          okFn(object);
          // access(modelName, object, userId, permission, context, role, cb);
        } else {
          let error = Error(`${modelName} ${modelId} not found`);
          error.statusCode = 404;
          cb(error, false);
        }
      })
      .catch((error) => {
        console.log(fnName, error, modelName, modelId);
        /** default statusCode is 500; */
        cb(error, false);
      });
  }

  /** Used by genericResolver(), this handles the paths* APIs,
   * for which id is an array of 2 string blockIds.
   * Similar to genericResolver(), use .findByIds() and cbWrap() to report
   * OK if all the ids are OK.
   *
   * Block is the only model which Pretzel API currently requires this function
   * for, but it can equally handle other models.
   */
  function resolve2Blocks(role, context, cb) {
    const fnName = 'resolve2Blocks';

    // Block : id is 2 Block Ids
    /*
      context.property == 'paths' ||
      context.property == 'pathsProgressive' ||
      context.property == 'pathsByReference' ||
      context.property == 'pathsViaStream' ||
      context.property == 'pathsAliasesProgressive' ||
      context.property == 'pathsAliasesViaStream' ||
    */
    const
    permission = canRead,
    userId = context.accessToken.userId,
    /** expect === 'Block' */
    modelName = context.modelName,
    /** expect that model === Block */
    Block = context.model.app.models.Block,
    blockIds = context.modelId;
    if (! Array.isArray(blockIds) || blockIds.length !== 2) {
      console.log(fnName, 'modelId', blockIds);
      let error = Error(`${modelName} expect id to be 2 BlockIds : ` + blockIds);
      error.statusCode = 400; // Bad Request
      process.nextTick(() => cb(error, false));
    } else {
      const
      /** filter out remote blockIds - the secondary server will check those. */
      blockIdsLocal = blockIds.filter((id) => !id.blockId),
      blockObjectIds = blockIdsLocal.map(ObjectId),
      blockIdsText = blockIdsLocal.join(',');
      /**
         .pathsByReference = function(blockA, blockB
         .paths = function(left, right
         .pathsProgressive = function(left, right
         .pathsViaStream = function(blockId0, blockId1
         .pathsAliasesProgressive
         .pathsAliasesViaStream = function(blockIds
      */
      context.model.findByIds(blockObjectIds, {}, context/*.options ?*/)
        .then(function(models) {
          if (models?.length === blockIdsLocal.length) {
            let allOk = true;
            function cbWrap(i) {
              return function (error, ok) {
                console.log('cbWrap', i, blockIdsLocal[i], models[i], error, ok);
                if (error || ! ok) {
                  allOk = false;
                  process.nextTick(() => cb(error, ok));
                }
                else {
                  if ((i === models.length-1) && allOk) {
                    process.nextTick(() => cb(null, true));
                  }
                }
              };
            }
            models.forEach(
              (model, i) => access(modelName, model, userId, permission, context, role, cbWrap(i)));
          } else {
            let error = Error(`${modelName} not found : ${blockIdsText}`);
            error.statusCode = 404;
            process.nextTick(() => cb(error, false));
          }})
        .catch((error) => {
          console.log('findByIds', error, blockIdsText);
          process.nextTick(() => cb(error, false));
        });
    }
    // cb() will be called by one of the above cases
  }

  Role.registerResolver('viewer', genericResolver)
  Role.registerResolver('editor', genericResolver)
};

console.log('lb3app/server/boot/access.js');
