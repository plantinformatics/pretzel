// Copyright IBM Corp. 2014,2015. All Rights Reserved.
// Node module: loopback-example-offline-sync
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var env = (process.env.NODE_ENV || 'development');
var isDevEnv = env === 'development' || env === 'test';

// building up the config prior to exporting
// allows for further properties to be added
// using conditional expressions
var config = {
  "db": {
    "name": "db",
    "connector": "memory"
  },
  "mongoDs": {
    "host": process.env.DB_HOST,
    "port": process.env.DB_PORT,
    "url": "",
    "database": "admin",
    "password": process.env.DB_PASS,
    "name": "mongoDs",
    "user": process.env.DB_USER,
    "connector": "mongodb"
  },
  "email": {
    "name": "email",
    "transports": [
      {
        "type": "smtp",
        "host": process.env.EMAIL_HOST,
        "port": process.env.EMAIL_PORT,
      }
    ],
    "connector": "mail"
  }
}

// add the 'secure' bool if not on port 25
if (parseInt(process.env.EMAIL_PORT) !== 25) {
  config.email.transports[0].secure = true
}

// add authentication object if env vars present
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  config.email.transports[0].auth = {
    "user": process.env.EMAIL_USER,
    "pass": process.env.EMAIL_PASS
  }
}

module.exports = config