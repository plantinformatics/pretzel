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

/** @return session clientId
 * @desc
 * related : let clientIdString = gatherClientId(options);
 */
function sessionClientId(context) {
  let
  accessToken = context.accessToken || context.req.accessToken, 
  userId = accessToken.userId.toHexString();
}


module.exports = function(Group) {


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
    }
    data.clientId = userId; // ObjectId();
    next();
  });



  // ---------------------------------------------------------------------------

  /** List groups which this user has created / owns
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
    listP = this.app.models.ClientGroup.find(query, options);
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

  /**
   * @param addId clientId of user to add to group
   */
  Group.addMember = function (groupId, addId, cb) {
    const
    fnName = 'addMember';
  };

  /** group/addMember (session clientId), groupId, addId -> message
   */
  Group.remoteMethod('addMember', {
    accepts: [
      {arg: 'groupId', type: 'string', required: true},
      {arg: 'addId', type: 'string', required: true},
    ],
    returns: {type: 'string', root: true},
    description: "Add user to group"
  });

  // ---------------------------------------------------------------------------

  acl.limitRemoteMethodsRelated(Group);

  // Group.disableRemoteMethodByName("create");
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
};
