
//------------------------------------------------------------------------------
// Added
/* global module */
/* global process */
//------------------------------------------------------------------------------

'use strict';

module.exports = function(environment) {
  const env = process.env;
  var ENV = {
    modulePrefix: 'pretzel-frontend',
    environment: environment,
    apiHost: process.env.API_URL || 'http://localhost:5000',
    // apiHost: 'http://sc-15-cdc.it.csiro.au:7000',
    apiNamespace: 'api', // adding to the host for API calls
    rootURL: '/', // used with Ember local routing
    locationType: 'auto',
    handsOnTableLicenseKey: null,

    'ember-local-storage': {
      namespace: true, // will use the modulePrefix e.g. 'pretzel-frontend'
      // keyDelimiter: '/' // will use / as a delimiter - the default is :
    },


    EmberENV: {
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
      },
      EXTEND_PROTOTYPES: {
        // Prevent Ember Data from overriding Date.parse.
        Date: false
      }, 
    },
    'ember-simple-auth': {
      /* these configuration values are moved to the routes :
       *  authenticationRoute, routeAfterAuthentication, routeIfAlreadyAuthenticated
       * as per : https://github.com/simplabs/ember-simple-auth/blob/master/guides/upgrade-to-v3.md
       */
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
    }
  };

  if (environment === 'development') {
    // ENV.APP.LOG_RESOLVER = true;
    // ENV.APP.LOG_ACTIVE_GENERATION = true;
    // ENV.APP.LOG_TRANSITIONS = true;
    // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    // ENV.APP.LOG_VIEW_LOOKUPS = true;

    // if defined, add $germinate_{username,password} in ENV.germinate.
    if (env.germinate_username) {
      const
      username = env.germinate_username,
      password = env.germinate_password;
      ENV.germinate = {username, password};
    }
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
    ENV.APP.autoboot = false;
  }

  if (environment === 'production') {
    // here you can enable a production-specific feature
    //--------------------------------------------------------------------------
    // Added for Pretzel :
    ENV.apiHost = '';
  }
  /** If handsOnTableLicenseKey is defined in the environment of npm / ember,
   * HandsOnTable is used for the spreadsheet-style tables in :
   *  components/panel/paths-table.js
   *  components/panel/upload/data-csv.js
   *  components/table-brushed.js
   * otherwise ember-contextual-table is used.
   *
   * In the last non-commercial HandsOnTable version 6.2.2, multiColumnSorting
   * is present but didn't work with 'multiColumnSorting:true'; it is fine for
   * all other features used.  To use this version, change "handsontable"
   * version dependency in frontend/bower.json (later this will be in
   * package.json)
   *
   * Also see : https://handsontable.com/blog/articles/2019/3/handsontable-drops-open-source-for-a-non-commercial-license
   * https://handsontable.com/docs/7.4.2/tutorial-license-key.html
   */
  ENV.handsOnTableLicenseKey = process.env.handsOnTableLicenseKey;


  return ENV;
};
