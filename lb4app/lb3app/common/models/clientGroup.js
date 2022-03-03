'use strict';

/* global require */
/* global module */

var acl = require('../utilities/acl');

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
    const models = this.app.models;

    models.Client.find({where: {email: clientEmail}, limit: 1})
      .catch((err) => cb(err))
      .then(function(clients) {
        if (! clients.length) {
          // may add a param to indicate : queue this email for addition when client is created.
          cb(new Error('Email ' + clientEmail + ' not found'));
        } else if (clients.length > 1) {
          cb(new Error('Email ' + clientEmail + ' found ' + clients.length + ' matches' ));
        } else {
          let
          client = clients[0],
          /**  Could use .toHexString().  groupId is string - seems either are OK. */
          clientId = client.getId();
          ClientGroup.create({groupId, clientId}, options, cb);
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

  acl.assignRulesRecord(ClientGroup);
  acl.limitRemoteMethods(ClientGroup);
  acl.limitRemoteMethodsRelated(ClientGroup);

};
