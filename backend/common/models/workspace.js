'use strict';

var acl = require('../utilities/acl')

module.exports = function(Workspace) {

  Workspace.observe('before delete', function(ctx, next) {
    var Feature = ctx.Model.app.models.Feature
    Feature.find({
      where: {
        workspaceId: ctx.where.id
      }
    }, ctx.options).then(function(features) {
      features.forEach(function(feature) {
        Feature.destroyById(feature.id, ctx.options, function () {
        });
      })
    })
    next()
  })

  acl.assignRulesRecord(Workspace)
  acl.limitRemoteMethods(Workspace)
  acl.limitRemoteMethodsSubrecord(Workspace)
  acl.limitRemoteMethodsRelated(Workspace)
};
