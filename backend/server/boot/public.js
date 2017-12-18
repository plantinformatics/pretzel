module.exports = function(app) {
  var Role = app.models.Role;

  // the intent of this resolver is to give availability
  // of publicised resources to other users on the instance.
  // another ACL will give write access if it is provided

  function publicityDecision(data, userId) {
    let clientId = String(data.clientId)
    let publicity = data.public

    let checkMatchUser = clientId == userId
    let checkPublic = publicity == true

    if (checkMatchUser || checkPublic) {
      return true
    } else {
      return false
    }
  }

  Role.registerResolver('public', function(role, context, cb) {
    console.log(`resolver ${role}`)

    var modelName = context.modelName

    // building options object to pass through to DB calls, as collection
    // observers may require accessToken for visibility checks
    let options = {}
    if (context.accessToken) options.accessToken = context.accessToken

    //Q: Is the user logged in? (there will be an accessToken with an ID if so)
    var clientId = context.accessToken.userId
    var checkIdMissing = !clientId;
    var checkAuth = process.env.AUTH == 'ALL'
    if (checkAuth && checkIdMissing) {
      //A: No, user is NOT logged in: callback with FALSE
      return process.nextTick(() => cb(null, false));
    }
    

    // Q: Is the request not looking for a specific resource?
    if (context.property == 'find') {
      // A: Yes. Have no way to check specific resource.
      // Delegate visibility filtering of results to access observers
      return process.nextTick(() => cb(null, true));
    }

    // separate handling for geneticmap and chromosome models
    if (modelName == 'Chromosome') {
      // need to gather both chromosome and geneticmap to confirm publicity
      context.model.findById(context.modelId, {}, options)
      .then(function(data) {
        if (data) {
          if (publicityDecision(data, clientId)) {
            // check geneticmap for same conditions
            var Geneticmap = app.models.Geneticmap
            var geneticmapId = data.geneticmapId
            return Geneticmap.findById(geneticmapId, {}, options)
          } else {
            cb(null, false)
          }
        } else {
          cb(Error(`${modelName} not found`));
        }
      })
      .then(function(data) {
        if (data) {
          if (publicityDecision(data, clientId)) {
            cb(null, true)
          } else {
            cb(null, false)
          }
        } else {
          cb(Error(`Geneticmap not found`));
        }
      })
      .catch(function(err) {
        console.log('ERROR', err)
        cb(err);
      })
    } else if (modelName == 'Marker') {
      // need to gather both chromosome and geneticmap to confirm publicity
      context.model.findById(context.modelId, {}, options)
      .then(function(data) {
        // Marker data, no publicity check since it's ties to Chromosome
        if (data) {
          // check chromosome for same conditions
          var Chromosome = app.models.Chromosome
          var chromosomeId = data.chromosomeId
          return Chromosome.findById(chromosomeId, {}, options)
        } else {
          cb(Error(`${modelName} not found`));
        }
      })
      .then(function(data) {
        // Chromosome data
        if (data) {
          if (publicityDecision(data, clientId)) {
            // check geneticmap for same conditions
            var Geneticmap = app.models.Geneticmap
            var geneticmapId = data.geneticmapId
            return Geneticmap.findById(geneticmapId, {}, options)
          } else {
            cb(null, false)
          }
        } else {
          cb(Error(`Chromosome not found`));
        }
      })
      .then(function(data) {
        // Geneticmap data
        if (data) {
          if (publicityDecision(data, clientId)) {
            cb(null, true)
          } else {
            cb(null, false)
          }
        } else {
          cb(Error(`Geneticmap not found`));
        }
      })
      .catch(function(err) {
        console.log('ERROR', err)
        cb(err);
      })

    } else {
      // check publicity on particular model with no dependencies
      // it is assumed that the model has client ownership properties
      context.model.findById(context.modelId, {}, options)
      .then(function(data) {
        if (data) {
          if (publicityDecision(data, clientId)) {
            cb(null, true)
          } else {
            cb(null, false)
          }
        } else {
          cb(Error(`${modelName} not found`));
        }
      })
      .catch(function(err) {
        console.log('ERROR', err)
        cb(err);
      })
    }
  });
};