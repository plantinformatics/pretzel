/* jshint node: true */

module.exports = function(environment) {
  var ENV = {
    modulePrefix: 'pretzel-frontend',
    environment: environment,
    apiHost: 'http://localhost:5000',
    // apiHost: 'http://sc-15-cdc.it.csiro.au:7000',
    apiNamespace: 'api', // adding to the host for API calls
    rootURL: '/', // used with Ember local routing
    locationType: 'auto',
    EmberENV: {
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. 'with-controller': true
      },
      EXTEND_PROTOTYPES: {
        // Prevent Ember Data from overriding Date.parse.
        Date: false
      }
    },
    'ember-simple-auth': {
        authenticationRoute: 'login',
        routeAfterAuthentication: 'mapview',
        routeIfAlreadyAuthenticated: 'mapview'
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created

      // default config is for authorisation to be enabled
      // override this option in the environment tests below
      AUTH: true
    }
  };

  if (environment === 'development') {
    // ENV.APP.LOG_RESOLVER = true;
    // ENV.APP.LOG_ACTIVE_GENERATION = true;
    // ENV.APP.LOG_TRANSITIONS = true;
    // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    // ENV.APP.LOG_VIEW_LOOKUPS = true;
    // ENV.APP.AUTH = false
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
    // ENV.APP.AUTH = false
  }

  if (environment === 'production') {
    ENV.apiHost = '';
    // ENV.APP.AUTH = false
    if (process.env.AUTH === 'NONE') ENV.APP.AUTH = false
  }

  return ENV;
};
