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
    "database": process.env.DB_NAME || 'pretzel',
    "authSource": "admin",
    "password": process.env.DB_PASS,
    "name": "mongoDs",
    "user": process.env.DB_USER,
    "connector": "mongodb",
    "connectionTimeoutMS": 1800000,
    "socketTimeoutMS": 1800000
  },
  "email": {
    "name": "email",
    "transports": [
      {
        "type": "smtp",
        "tls": {
          rejectUnauthorized: false
        }
      }
    ],
    "connector": "mail"
  }
}

if (process.env.EMAIL_ACTIVE == 'true') {
  console.log('Assigning email datasource properties')
  // enable email if host and port provided
  config.email.transports[0].host = process.env.EMAIL_HOST
  config.email.transports[0].port = process.env.EMAIL_PORT

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
} else {
  // no mail validation or password reset facilities
  console.log('No email datasource properties assigned')
}

// console.log('SET ENVIRONMENT VARIABLES', process.env)
// console.log('CONFIG', config)

module.exports = config