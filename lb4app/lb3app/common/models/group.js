'use strict';

/* global require */
/* global module */
/* global process */
/* global __dirname */

var ObjectId = require('mongodb').ObjectID;

var path = require('path');

var loopback = require('loopback'); // for rendering template in custom methods

var acl = require('../utilities/acl');
const { gatherClientId } = require('../utilities/identity');

// -----------------------------------------------------------------------------

/** If false then datasets with .public===false have .groupId === null
 * Same as in frontend/app/controllers/group/edit.js
 */
const allowGroupsWhenPrivate = false;

// -----------------------------------------------------------------------------

/** @return session clientId
 * @desc
 * related : let clientIdString = gatherClientId(options);
 */
function sessionClientId(context) {
  let
  accessToken = context.accessToken || context.req.accessToken, 
  userId = accessToken.userId.toHexString();
  return userId;
}


module.exports = function(Group) {


  // ---------------------------------------------------------------------------

  Group.prototype.groupId = function get() {
    return this.getId();
  };

  // ---------------------------------------------------------------------------

        
  /** group/add  (session clientId), groupName -> message
   * Set ownerClientId to session clientId
   */
  Group.beforeRemote('create', function(context, result, next) {
    let userId = sessionClientId(context);

    /** group */
    let data = context.args.data;
    console.log('Group beforeRemote create', data, data.clientId, userId);
    if (userId != data.clientId) {
      console.log('Group beforeRemote create', userId);
      // next('session clientId ' + userId + ' does not match data.clientId ' + data.clientId);
      // 403 ?
    }
    data.clientId = userId; // ObjectId();
    next();
  });



  // ---------------------------------------------------------------------------

  /** List groups which this user has created / owns
   * @return promise yielding groups which have .clientId === the userId of request accessToken.
   */
  Group.own = function (options, cb) {
    const
    fnName = 'own',
    clientIdString = gatherClientId(options),
    query = {
      where: {
        clientId: ObjectId(clientIdString)
      },
      include : 'clients'
    },
    listP = Group.find(query, options);
    listP.then((list) => console.log(fnName, clientIdString, list.length || JSON.stringify([query, options]) ));

    return listP;
  };

  /** group/own (session clientId) -> [groupName, .. ] and/or groupId
   */
  Group.remoteMethod('own', {
    http: {verb: 'get'},
    accepts: [
      {arg: "options", type: "object", http: "optionsFromRequest"},
    ],
    returns: {type: 'object', root: true},
    description: "List groups which this user has created / owns"
  });

  // ---------------------------------------------------------------------------

  /** List groups which this user is in
   * @return promise yielding client-groups which have .clientId === the userId of request accessToken.
   */
  Group.in = function (options, cb) {
    const
    fnName = 'in',
    clientIdString = gatherClientId(options),
    query = {
      where: {
        clientId: ObjectId(clientIdString)
      },
      include : 'group'
    },
    listP = this.app.models.ClientGroup.find(query, options)
      .then(function(clientGroups) {
        let
        filtered = clientGroups
          .filter((clientGroup) => {
            /** .group() accesses (equivalent) clientGroup.__cachedRelations?.group */
            let ok = !!clientGroup.group(); 
            if (! ok) {
              console.log('Group.in', ok, clientGroup);
            }
            return ok;
          });
        return filtered;
      });
    listP.then((list) => console.log(fnName, clientIdString, list.length || JSON.stringify([query, options]) ));

    return listP;
  };

  /** group/in (session clientId) -> [groupName, .. ] and/or groupId
   */
  Group.remoteMethod('in', {
    http: {verb: 'get'},
    accepts: [
      {arg: "options", type: "object", http: "optionsFromRequest"},
    ],
    returns: {type: 'object', root: true},
    description: "List groups which this user is in"
  });

  // ---------------------------------------------------------------------------

  /** Add the given clientId to the Group, i.e. create a ClientGroup.
   * @param id  groupId
   * @param addId clientId of user to add to group
   * @param options
   * The params id and addId are already checked by access.js : genericResolver()
   */
  Group.addMember = function (groupId, addId, options, cb) {
    const
    fnName = 'addMember',
    clientId = addId,
    models = this.app.models,
    ClientGroup = models.ClientGroup;
    // based on ClientGroup.addEmail()

    /** log the error message and call cb(error) */
    function cbL(statusCode, errorText) {
      console.log(fnName, groupId, clientId, statusCode, errorText);
      const error = new Error(errorText);
      error.statusCode = statusCode;
      cb(error);
    }

    ClientGroup.groupAddMember(groupId, clientId, options, cbL, cb);

    // result is via cb().  All cases call cb().
  };

  /** group/addMember (session clientId), groupId, addId -> message or ClientGroup
   */
  Group.remoteMethod('addMember', {
    accepts: [
      {arg: 'id', type: 'string', required: true},
      {arg: 'addId', type: 'string', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
    ],
    returns: {type: 'object', root: true},
    description: "Add user to group, i.e. create a ClientGroup."
    // http: {verb: 'post'},  (default)
  });

  // ---------------------------------------------------------------------------

  /** Lookup Client by email;  if not found, create it.
   * Call cb() if error.
   * @param groupId The client is being created to add to this group
   * @param options optionsFromRequest
   * @return promise yielding clientId, or undefined if error
   */
  Group.retrieveEmailOrCreate = function(Client, email, groupId, options, cb) {
    const fnName = 'retrieveEmailOrCreate';

    /** log the error message and call cb(error) */
    function cbL(statusCode, errorText) {
      console.log(fnName, email, statusCode, errorText);
      const error = new Error(errorText);
      error.statusCode = statusCode;
      cb(error);
    }

    let promise =
        Client.find({where : {email : {like : email, options : 'i'} }})
      .then((clients) => {
        console.log(fnName, clients, email);
        if (clients.length === 1) {
          return clients[0];
        } else if (clients.length) {
          cbL(409, 'There are multiple Users with email ' + email + '.');
          return undefined;
        } else if (! process.env.enableClientCreate) {  // can be enabled by a User admin role.
          cbL(404, 'There are no Users with email ' + email + '.');
          return undefined;
        } else {
          /** may use random text instead of groupId for password.  Possibly this .create() will not be enabled.
           * Possibly a better workflow would be 2 step : first request reports back that the user doesn't exist,
           * then (admin) user is able to click a checkbox enabling create and resend the request.
           */
          let clientP = Client.create({email, emailVerified : true, password: groupId, forGroup : true, options});
          clientP.then((client) => { console.log(fnName, 'created', client.id.toHexString(), email); });
          return clientP;
        }
      })
      .catch((err) => cb(err));
    return promise;
  };

  /** Add the given clientId to the Group, i.e. create a ClientGroup.
   * @param id  groupId
   * @param addEmail email of user to add to group
   * @param options
   * The params id and addId are already checked by access.js : genericResolver()
   */
  Group.addMemberEmail = function (groupId, addEmail, options, cb) {
    const
    fnName = 'addMemberEmail',
    clientId = addEmail,
    models = this.app.models,
    ClientGroup = models.ClientGroup;
    // based on ClientGroup.addEmail()

    /** log the error message and call cb(error) */
    function cbL(statusCode, errorText) {
      console.log(fnName, groupId, clientId, statusCode, errorText);
      const error = new Error(errorText);
      error.statusCode = statusCode;
      cb(error);
    }

    this.retrieveEmailOrCreate(models.Client, addEmail, groupId, options, cb)
      .then((client) => {
        ClientGroup.groupAddMember(groupId, client.id, options, cbL, cb); })
      .catch((err) => cb(err));

    // result is via cb().  All cases call cb().
  };

  /** group/addMember (session clientId), groupId, addId -> message or ClientGroup
   */
  Group.remoteMethod('addMemberEmail', {
    accepts: [
      {arg: 'id', type: 'string', required: true},
      {arg: 'addEmail', type: 'string', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
    ],
    returns: {type: 'object', root: true},
    description: "Add user email to group, i.e. create a ClientGroup."
    // http: {verb: 'post'},  (default)
  });

  // ---------------------------------------------------------------------------

  /** Prevent Group deletion when there are Datasets which are in this group.
   *
   * This is only applicable if allowGroupsWhenPrivate; otherwise users are able
   * to delete (their) groups which have datasets, with the effect that .groupId
   * of those datasets is set to null.
   *
   * The frontend client disables the 'Delete Group' button when there are
   * Datasets in the Group (deleteGroupDisabled() in controllers/group/edit.js).
   * Potentially another user could add a datset to the Group after that page is
   * displayed, and also this guard prevents API calls not from the frontend
   * from creating inconsistent data relationships.
   */
  if (allowGroupsWhenPrivate) {
  Group.observe('before delete', function(ctx, next) {
    const
    fnName = 'Group:before delete',
    models = ctx.Model.app.models,
    Group = ctx.Model,
    Dataset = models.Dataset,
    groupId = ctx.where.id; // ctx.instance is undefined in this case.

    console.log(fnName, groupId, ctx.instance);
    Dataset.find({
      where: {
        groupId
      }
    }, ctx.options)
      .then(function(datasets) {
        if (! datasets.length) {
          next();
        } else {
          // Stop the deletion of this Group
          var err = new Error("There are " + datasets.length + " Datasets with this Group; rejecting deletion request");
          err.statusCode = 400;
          console.log(err.toString());
          next(err);
        }
      });


  });

  } else {  // ! allowGroupsWhenPrivate

    /** 
     * If ! allowGroupsWhenPrivate, users are able to delete (their) groups
     * which have datasets, with the effect that .groupId of those datasets is
     * set to null.
     */
  Group.observe('after delete', function(ctx, next) {
    const
    fnName = 'Group:after delete',
    models = ctx.Model.app.models,
    Dataset = models.Dataset,
    Group = ctx.Model,
    groupId = ctx.where.id;
    let group;
    if (! groupId) {
      console.log(fnName, ctx.isNewInstance, ctx.instance, ctx.currentInstance, ctx.where, ctx.data);
    } else {
      let where = {groupId : ctx.where.id};
      console.log(fnName, where, ctx.isNewInstance, ctx.instance, ctx.currentInstance, ctx.where, ctx.data);

      let promise = Dataset.update(where, {groupId : null}, ctx.options);
      promise.then((done) => console.log(fnName, done))
        .catch((error) => console.log(fnName, 'error', error));
    }

    next();
  });
  }

  // ---------------------------------------------------------------------------


  acl.assignRulesRecord(Group);
  acl.limitRemoteMethods(Group);
  acl.limitRemoteMethodsRelated(Group);

  // Group.disableRemoteMethodByName("create");
/*
  Group.disableRemoteMethodByName("upsert");
  Group.disableRemoteMethodByName("updateAll");
  Group.disableRemoteMethodByName("prototype.updateAttributes");

  Group.disableRemoteMethodByName("find");
  // Group.disableRemoteMethodByName("findById");
  Group.disableRemoteMethodByName("findOne");

  Group.disableRemoteMethodByName("deleteById");

  Group.disableRemoteMethodByName("createChangeStream");

  Group.disableRemoteMethodByName("confirm");
  Group.disableRemoteMethodByName("count");
  Group.disableRemoteMethodByName("exists");
  Group.disableRemoteMethodByName("resetPassword");
  Group.disableRemoteMethodByName("upsertWithWhere");
*/
};
