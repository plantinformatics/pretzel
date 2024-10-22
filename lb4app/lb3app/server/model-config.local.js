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
  //   "dataSource": "mongoDs",
  //   "public": true
  // },
  "UserCredential": {
    "dataSource": "mongoDs",
    "public": false
  },
  "UserIdentity": {
    "dataSource": "mongoDs",
    "public": false
  },
  //
  "User": {
    "dataSource": "mongoDs",
    "public": false
  },
  "Client": {
    "dataSource": "mongoDs",
    "public": true,
    "options": {
    }
  },
  "Group": {
    "dataSource": "mongoDs",
    "public": true,
    "options": {
    }
  },
  "ClientGroup": {
    "dataSource": "mongoDs",
    "public": true,
    "options": {
    }
  },
  "AccessToken": {
    "dataSource": "mongoDs",
    "public": false
  },
  "ACL": {
    "dataSource": "mongoDs",
    "public": false
  },
  "RoleMapping": {
    "dataSource": "mongoDs",
    "public": false,
    "options": {
      "strictObjectIDCoercion": true
    }
  },
  "Role": {
    "dataSource": "mongoDs",
    "public": false
  },
  "Dataset": {
    "dataSource": "mongoDs",
    "public": true
  },
  "Block": {
    "dataSource": "mongoDs",
    "public": true
  },
  "Feature": {
    "dataSource": "mongoDs",
    "public": true
  },
  "Annotation": {
    "dataSource": "mongoDs",
    "public": true
  },
  "Interval": {
    "dataSource": "mongoDs",
    "public": true
  },
  "Alias": {
    "dataSource": "mongoDs",
    "public": true
  },
  "Email": {
    "dataSource": "email"
  },
  "Configuration": {
    "dataSource": null,
    "public": true
  },
  "Ontology": {
    "dataSource": null,
    "public": true
  }

}

if (process.env.EMAIL_VERIFY != 'NONE') {
  console.log('Assigning email model properties')
  // enable email facilities if header present
  config.Client.options = {
    "emailVerificationRequired": true
  };
} else {
  // no mail validation properties set
  console.log('No email model properties assigned')
}

module.exports = config

