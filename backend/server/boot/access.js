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

  function blockPermissions(block, userId, permission, context, cb) {
    app.models.Dataset.findById(block.datasetId, {}, context)
    .then(function(map) {
      if (map) {
        cb(permission(map, userId))
      } else {
        throw Error("Dataset not found")
      }
    })
  }

  function featurePermissions(feature, userId, permission, context, cb) {
    app.models.Block.findById(feature.blockId, {}, context)
    .then(function(block) {
      if (block) {
        blockPermissions(block, userId, permission, context, function(allow) {
          cb(allow)
        })
      } else {
        throw Error("Block not found")
      }
    })
  }

  function access(modelName, model, userId, permission, context, cb) {
    if (modelName == "Block") {
      blockPermissions(model, userId, permission, context, function(allow) {
        cb(allow)
      })
    } else if (modelName == "Feature") {
      featurePermissions(model, userId, permission, context, function(allow) {
        cb(allow)
      })
    } else {
      cb(permission(model, userId))
    }
  }

  function genericResolver(role, context, cb) {
    console.log(`resolver ${role}`)
    
    if (!context.accessToken || !context.accessToken.userId) {
      // Not logged in -> deny
      return process.nextTick(() => cb(null, false))
    }
    if (context.property == 'find' ||
      context.property ==  'create' ||
      context.property == 'upload' ||
      context.property == 'tableUpload') {
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