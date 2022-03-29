'use strict';

/* global require */
/* global module */

var ObjectId = require('mongodb').ObjectID;

var acl = require('../utilities/acl');

const { gatherClientId } = require('../utilities/identity');


module.exports = function(ClientGroup) {

  // ---------------------------------------------------------------------------

  /** Add the given email to the group, i.e. create a ClientGroup.
   * @param groupId
   * @param clientEmail
   * @param options
   *
   * @param cb node response callback
   */
  ClientGroup.addEmail = function(groupId, clientEmail, options, cb) {
    const fnName = 'addEmail';
    const models = this.app.models;

    /** log the error message and call cb(error) */
    function cbL(statusCode, errorText) {
      console.log(fnName, clientEmail, groupId, statusCode, errorText);
      const error = new Error(errorText);
      error.statusCode = statusCode;
      cb(error);
    }
    models.Client.find({where: {email: clientEmail}, limit: 1})
      .catch((err) => cb(err))
      .then(function(clients) {
        if (! clients.length) {
          // may add a param to indicate : queue this email for addition when client is created.
          cbL(404, 'Email ' + clientEmail + ' not found');
        } else if (clients.length > 1) {
          cbL(409, 'Email ' + clientEmail + ' found ' + clients.length + ' matches' );
        } else {
          let
          client = clients[0],
          /**  Could use .toHexString().  groupId is string - it seems either are OK in create(). */
          clientId = client.getId();
          ClientGroup.find({where : {groupId : ObjectId(groupId), clientId}})
            .then((clientGroups) => {
                console.log(fnName, clientGroups, clientId);
              if (clientGroups.length) {
                cbL(409, 'Email ' + clientEmail + ' already in group.');
              } else {
                ClientGroup.create({groupId, clientId}, options, cb);
              }
            })
            .catch((err) => cb(err));
        };
      });
    // result is via cb().
  };

  ClientGroup.remoteMethod('addEmail', {
    accepts: [
      {arg: 'groupId', type: 'string', required: true},
      {arg: 'clientEmail', type: 'string', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    // post
    returns: {type: 'object', root: true},
   description: "Add the given email to the group, i.e. create a ClientGroup."
  });

  // ---------------------------------------------------------------------------

  /** Prevent deletion if the group is not owned by the logged-in user.
   * Permission and other errors are reported via next(error).
   */
  ClientGroup.observe('before delete', function(ctx, next) {
    const
    fnName = 'ClientGroup:before delete',
    models = ctx.Model.app.models,
    ClientGroup = ctx.Model,
    Group = models.Group,
    clientGroupId = ctx.where.id;

    console.log(fnName, clientGroupId);
    ClientGroup.find({
      where : { id : ObjectId(clientGroupId) },
      include : { group : 'owner' },
    })
      .catch((error) => next(error))
      .then(function(clientGroups) {
        if (! clientGroups.length) {
          const err = new Error('Given ClientGroup id ' + clientGroupId + ' does not refer to an existing Group');
          err.statusCode = 409; // Conflict
          console.log(err.toString());
          next(err);
        } else if (clientGroups.length > 1) {
          const err = new Error('Given ClientGroup id ' + clientGroupId + ' is not unique');
          err.statusCode = 409; // Conflict
          console.log(err.toString());
          next(err);
        } else {
          console.log(fnName, clientGroupId, clientGroups);

          let userId = gatherClientId(ctx); // related : sessionClientId()
          /** equivalant without .toObject() :
           * clientGroup.__cachedRelations.group.__cachedRelations.owner
           */
          let clientGroup = clientGroups[0].toObject(),
              groupOwnerId = clientGroup?.group?.owner?.id;
          if (groupOwnerId?.equals(userId)) {
            next();
          } else  {
            // Stop the deletion of this ClientGroup
            const
            text = "Group is not owned by logged-in user; rejecting deletion request",
            /** maybe : , {cause : text}.  The error payload becomes detail: "[object Object]" in normalizeErrorResponse(). */
            err = new Error(text);
            err.statusCode = 403; // Forbidden
            console.log(err.toString(), userId, clientGroup.group.owner.id);
            next(err);
          }

        }
      });
  });


  // ---------------------------------------------------------------------------

  acl.assignRulesRecord(ClientGroup);
  acl.limitRemoteMethods(ClientGroup);
  acl.limitRemoteMethodsRelated(ClientGroup);

};
