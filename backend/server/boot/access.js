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

  function chromosomePermissions(chrom, userId, permission, context, cb) {
    app.models.Geneticmap.findById(chrom.geneticmapId, {}, context)
    .then(function(map) {
      if (map) {
        cb(permission(map, userId))
      } else {
        throw Error("Geneticmap not found")
      }
    })
  }

  function markerPermissions(marker, userId, permission, context, cb) {
    app.models.Chromosome.findById(marker.chromosomeId, {}, context)
    .then(function(chrom) {
      if (chrom) {
        chromosomePermissions(chrom, userId, permission, context, function(allow) {
          cb(allow)
        })
      } else {
        throw Error("Chromsome not found")
      }
    })
  }

  function access(modelName, model, userId, permission, context, cb) {
    if (modelName == "Chromsome") {
      chromosomePermissions(model, userId, permission, context, function(allow) {
        cb(allow)
      })
    } else if (modelName == "Marker") {
      markerPermissions(model, userId, permission, context, function(allow) {
        cb(allow)
      })
    } else {
      cb(permission(model, userId))
    }
  }

  Role.registerResolver('viewer', function(role, context, cb) {
    console.log(`resolver ${role}`)
    
    if (!context.accessToken || !context.accessToken.userId) {
      // Not logged in -> deny
      return process.nextTick(() => cb(null, false))
    }
    if (context.property == 'find') {
      // allow find request
      return process.nextTick(() => cb(null, true))
    }

    let userId = context.accessToken.userId
    let modelName = context.modelName

    let permission = canRead;

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
  })

  Role.registerResolver('editor', function(role, context, cb) {
    console.log(`resolver ${role}`)
    
    if (!context.accessToken || !context.accessToken.userId) {
      // Not logged in -> deny
      return process.nextTick(() => cb(null, false))
    }
    if (context.property == 'find') {
      // allow find request
      return process.nextTick(() => cb(null, true))
    }

    let userId = context.accessToken.userId
    let modelName = context.modelName

    let permission = canWrite;

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
  })
};