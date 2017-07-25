'use strict';

var env = (process.env.NODE_ENV || 'development');
var isDevEnv = env === 'development' || env === 'test';

// building up the config prior to exporting
// allows for further properties to be added
// using conditional expressions
var config = {
  "restApiRoot": "/api",
  "host": "0.0.0.0",
  "port": process.env.API_PORT_EXT,
  "remoting": {
    "context": false,
    "rest": {
      "handleErrors": false,
      "normalizeHttpPath": false,
      "xml": false
    },
    "json": {
      "strict": false,
      "limit": "200mb"
    },
    "urlencoded": {
      "extended": true,
      "limit": "200mb"
    },
    "cors": false
  }
}

module.exports = config