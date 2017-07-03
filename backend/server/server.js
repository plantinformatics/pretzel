'use strict';

// due to loading sequence, EMAIL_ACTIVE is to be set
// here, as model-config.local.js is loaded before
// datasources.local.
// TODO check if necessary once routes integrated
if (process.env.EMAIL_HOST && 
    process.env.EMAIL_PORT && 
    process.env.EMAIL_FROM) {
  // enable email if host and port provided
  console.log('Starting process with email service')
  process.env.EMAIL_ACTIVE = 'true'
} else {
  // no mail validation or password reset facilities
  console.log('No email service specified for process')
  process.env.EMAIL_ACTIVE = 'false'
}

var path = require('path');
var loopback = require('loopback');
var boot = require('loopback-boot');
var morgan = require('morgan');
// TODO determine if body parsing is needed
// when data structures are amalgamated
var bodyParser = require('body-parser');

var app = module.exports = loopback();

app.use(bodyParser.json({limit: '200mb'}));

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

app.use('/express-status', function (req, res, next) {
    res.json({ running: true });
});

app.use(morgan('combined'))

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});

// default route handling to deliver client files
app.use('/', loopback.static(path.resolve(__dirname, '../client')));
// using a regex to avoid wildcard matching of api route,
// but delivering files when hitting all other routes.
// this was an issue when providing the confirm token on email
// validation, as the confirm API request would deliver files
// instead of hitting the API as desired.
app.use(/^((?!api).)*$/, loopback.static(path.resolve(__dirname, '../client')));