'use strict';

// building up the config prior to exporting
// allows for further properties to be added
// using conditional expressions
var config = {
  "_meta": {
    "sources": [
      "loopback/common/models",
      "loopback/server/models",
      "../common/models",
      "./models",
      // for third-party auth handling
      "./node_modules/loopback-component-passport/lib/models"
    ],
    "mixins": [
      "loopback/common/mixins",
      "loopback/server/mixins",
      "../common/mixins",
      "./mixins"
    ]
  },
  // for third-party auth handling
  // "user": {
  //   "dataSource": "db",
  //   "public": true
  // },
  "UserCredential": {
    "dataSource": "db",
    "public": false
  },
  "UserIdentity": {
    "dataSource": "db",
    "public": false
  },
  //
  "User": {
    "dataSource": "mongoDs",
    "public": false
  },
  "AccessToken": {
    "dataSource": "mongoDs",
    "public": false
  },
  "ACL": {
    "dataSource": "db",
    "public": false
  },
  "RoleMapping": {
    "dataSource": "db",
    "public": false,
    "options": {
      "strictObjectIDCoercion": true
    }
  },
  "Role": {
    "dataSource": "db",
    "public": false
  },
  "Geneticmap": {
    "dataSource": "mongoDs",
    "public": true
  },
  "Chromosome": {
    "dataSource": "mongoDs",
    "public": true
  },
  "Marker": {
    "dataSource": "mongoDs",
    "public": true
  },
  "Client": {
    "dataSource": "mongoDs",
    "public": true,
    "options": {
    }
  },
}

if (process.env.EMAIL_VERIFY != 'NONE') {
  console.log('Assigning email model properties')
  // enable email facilities if header present
  config.Client.options = {
    "emailVerificationRequired": true
  }
  config.Email = {
    "dataSource": "email"
  }
} else {
  // no mail validation properties set
  console.log('No email model properties assigned')
}

module.exports = config

