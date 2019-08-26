module.exports = function(app) {
  var Role = app.models.Role;

  function isOwner(data, userId) {
    let clientId = String(data.clientId)
    return clientId == userId
  }

  function isPublic(data) {
    return data.public
  }

  function isReadOnly(data) {
    return data.readOnly
  }

  function canRead(data, userId) {
    return isOwner(data, userId) || isPublic(data)
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

  function access(modelName, model, userId, permission, context, cb) {
    if (modelName == 'Dataset') {
      datasetPermissions(model, userId, permission, context, cb)
    } else if (modelName == 'Block') {
      blockPermissions(model, userId, permission, context, cb)
    } else if (modelName == 'Feature') {
      featurePermissions(model, userId, permission, context, cb)
    } else {
      cb(permission(model, userId))
    }
  }

  function genericResolver(role, context, cb) {    
    if (!context.accessToken || !context.accessToken.userId) {
      // Not logged in -> deny
      return process.nextTick(() => cb(null, false))
    }
    if (context.property == 'find' ||
      context.property ==  'create' ||
      context.property == 'upload' ||
      context.property == 'tableUpload' ||
      context.property == 'createComplete' ||
      context.property == 'search' ||
      context.property == 'depthSearch' ||
      context.property == 'bulkCreate' ||
      context.property == 'paths' ||
      context.property == 'pathsProgressive' ||
      context.property == 'blockFeaturesCount' ||
      context.property == 'blockFeaturesInterval' ||
      context.property == 'pathsByReference' ||
      context.property == 'pathsViaStream' ||
      context.property == 'pathsAliasesProgressive' ||
      context.property == 'pathsAliasesViaStream'
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
