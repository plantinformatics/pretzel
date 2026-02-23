'use strict';

/* global process */
/* global require */
/* global module */
/* global __dirname */

// -----------------------------------------------------------------------------

/** This file server.js creates the LB3 app server and contains server setup
 * code, some of which is required in LB4.  The required sections are wrapped in
 * exported functions (serverShowEnvironment(), appServerLb3Setup(),
 * appServerLb3Setup2()) to enable use in LB4.
 * The sections which are not required are wrapped in : if (lb3) { }.
 * This approach makes it clear in the commit what the actual changes are for LB4.
 *
 * If the LB3 server is required (e.g. for test comparison) then we can simply
 * check out that version, so there is unlikely to be a need to use this source in LB3,
 * and the LB3 sections can be dropped.
 */

// -----------------------------------------------------------------------------
/** Addition of dotenv for access to process.env (environment variables)
 * If path is configured in the environment :
 *   DOTENV_CONFIG_DEBUG=true DOTENV_CONFIG_PATH=lb3app/.env;
 * then node -r require option can be used : -r dotenv/config
 * as an alternative to loading .env here.
 *
 * To enable dotenv debug, define env variable DOTENV_CONFIG_DEBUG=true in node environment.
 * That reports on .env file not found, and variables defined in both environment and in .env.
 *
 * If DB_USER and DB_PASS are defined in .env and the database is configured
 * without authentication, they can be defined as empty strings in the
 * environment to override those values.
 */
const dotenvOptions = {};
if (! process.env['DOTENV_CONFIG_PATH']) {
  dotenvOptions.path = 'lb3app/.env';
}
const dotenv = require('dotenv').config(dotenvOptions);

const
envNames =
  [
    'DB_USER',
    'DB_PASS', 
    'API_HOST',
    'API_URL',
    'API_PORT_EXT',
    'DB_HOST',
    'DB_PORT_EXT',
    'DB_NAME',
    'EMAIL_FROM',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_ADMIN',
    'EMAIL_VERIFY',
    'AUTH',
    'nBlockFeaturesCopy',
    'scriptsDir',
    'blastDir',
    'vcfDir',
    'mntData',
    'toolsDev',
    'datasetIdDir',
    'blastn',

    'DEBUG',
    'DOTENV_CONFIG_DEBUG',
    'DOTENV_CONFIG_PATH',
    'DOTENV_CONFIG_OVERRIDE',
  ];
const
processFieldNames =
  [
    'pid',
    'ppid',
    'version',
    /* undefined at this point, must be initialised later
    'mainModule.filename',
    'mainModule.path',
    */
  ];

/** if name is DB_PASS, reduce value to true if defined. */
function maskValue(name, value)
{
  return (name == 'DB_PASS') ? (value ? true : value) : value;
}
/** Show in the server log the values of environment variables which are used by
 * the app server.  Also show process pid, ppid, version, cwd().
 * This function was used in LB3 setup, and is also required in LB4.
 */
function serverShowEnvironment() {
const env = process.env;
console.log(
  __dirname, 'process.env',
  envNames.map((n) => [n, maskValue(n, env[n])]),
  '\nprocess',
  processFieldNames.map((n) => [n, process[n]]),
  process.cwd(),
  '\n',
  new Date(),
);
}
// heartbeat log message : process. _eventsCount, memoryUsage()


// validating provided environment variables
var environment = require('./environment');

//
// - - - - - CORE APP CONFIG - - - - - -
//
var path = require('path');
var loopback = require('loopback');
var boot = require('loopback-boot');
var loopbackPassport = require('loopback-component-passport');
var morgan = require('morgan');
var bodyParser = require('body-parser');

var clientGroups = require('../common/utilities/client-groups');

// lb3 :
// var app = module.exports = loopback();

/** Used to disable code which is only applicable to Loopback version 3 */
const lb3 = false;

/** This function wraps the sections of LB3 setup which are also required in LB4.
 */
function appServerLb3Setup(app) {
// app.use(bodyParser.json({limit: '200mb'}));

if (lb3) {
app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};
}

app.use('/express-status', function (req, res, next) {
    res.json({ running: true });
});

if (process.env.NODE_ENV != 'test') {
  app.use(morgan('combined'))
}

}	// appServerLb3Setup()

if (lb3) {
//
// - - - - - THIRD PARTY AUTH INIT - - - - - -
//
// authorisation providers initialisation is required before booting
var PassportConfigurator = loopbackPassport.PassportConfigurator;
var passportConfigurator = new PassportConfigurator(app);


// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});

//
// - - - - - THIRD PARTY AUTH CONFIG - - - - - -
//
// authorisation providers configuration
// this section informs loopback of available providers via the
// providers.json file at the backend root
// var PassportConfigurator = loopbackPassport.PassportConfigurator;
// var passportConfigurator = new PassportConfigurator(app);

// Build the providers/passport config
// var config = {};
// try {
// 	config = require('../providers.json');
// } catch (err) {
//   console.trace(err);
//   console.error('Please configure your passport strategy in `providers.json`.');
//   console.error('Copy `providers.example.json` to `providers.json` and replace the clientID/clientSecret values with your own.');
// 	process.exit(1); // fatal
// }

// // Initialize passport
// passportConfigurator.init();

// // Set up related models
// passportConfigurator.setupModels({
//   userModel: app.models.user,
//   userIdentityModel: app.models.userIdentity,
//   userCredentialModel: app.models.userCredential
// });
// // Configure passport strategies for third party auth providers
// for(var s in config) {
//   var c = config[s];
//   c.session = c.session !== false;
//   passportConfigurator.configureProvider(s, c);
// }
}	// if (lb3)

/** This function wraps the sections of LB3 setup which are also required in LB4.
 */
function appServerLb3Setup2(app) {

//
// - - - - - VIEW CONFIG - - - - - -
//
// the views are used to construct emails for auth services
app.set('views', path.resolve(__dirname, 'views'));

//
// - - - - - FILE DELIVERY CONFIG - - - - - -
//
// 

let clientPath = path.resolve(__dirname, '../../client')

// default route handling to deliver client files
app.use('/', loopback.static(clientPath));
// using a regex to avoid wildcard matching of api route,
// but delivering files when hitting all other routes.
// this was an issue when providing the confirm token on email
// validation, as the confirm API request would deliver files
// instead of hitting the API as desired.
app.use(/^((?!api).)*$/, loopback.static(clientPath));

// -----------------------------------------------------------------------------

/** Activate the service. */
clientGroups.clientGroups.init(app);

}	// appServerLb3Setup2()

// -----------------------------------------------------------------------------

module.exports = { 
  serverShowEnvironment,
  appServerLb3Setup,
  appServerLb3Setup2
};
 // app; // for testing
