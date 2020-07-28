'use strict';

var acl = require('../utilities/acl');

/* global process */
/* global require */
/* global module */

module.exports = function(Configuration) {

  /*--------------------------------------------------------------------------*/

  Configuration.runtimeConfig = function (cb) {
    let handsOnTableLicenseKey = process.env.handsOnTableLicenseKey,
    config = {handsOnTableLicenseKey};
    console.log('runtimeConfig', config);
    cb(null, config);
  };

  /*--------------------------------------------------------------------------*/

  Configuration.remoteMethod('runtimeConfig', {
    accepts: [
    ],
    returns: {type: 'object', root: true},
    description: "Request run-time environment configuration of backend server, including handsOnTableLicenseKey"
  });

  /*--------------------------------------------------------------------------*/

  acl.assignRulesRecord(Configuration);

  Configuration.disableRemoteMethodByName("findById");

};
