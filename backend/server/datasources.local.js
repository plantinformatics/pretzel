// Copyright IBM Corp. 2014,2015. All Rights Reserved.
// Node module: loopback-example-offline-sync
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var env = (process.env.NODE_ENV || 'development');
var isDevEnv = env === 'development' || env === 'test';

module.exports = {
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
  }
}
