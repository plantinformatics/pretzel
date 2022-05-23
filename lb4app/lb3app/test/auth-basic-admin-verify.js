'use strict';

var assert = require('chai').assert;
var superagent = require('superagent');

describe('auth-basic-admin-verify', function() {
  var app, server, endpoint, smtp, database, parse

  var userEmail = 'admin-verify@example.com'
  var userPassword = 'abcd'
  var userId = null
  var userToken = null
  var verifyUrl = null

  before(function(done) {
    var environment = require('./helpers/environment');
    
    process.env.EMAIL_HOST = "localhost";
    process.env.EMAIL_PORT = "25";
    process.env.EMAIL_FROM = "test@example.com";
    process.env.EMAIL_VERIFY = "ADMIN";
    process.env.EMAIL_ADMIN = "admin@example.com";
    process.env.EMAIL_USER = "tester";
    process.env.EMAIL_PASS = "tester";
    // the temporary smtp server uses a self-signed cert
    // which by default is not trusted by loopback TLS library
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

    // scrubbing dependencies (if loaded)
    Object.keys(require.cache).forEach(function(key) {
      delete require.cache[key]
    })
    
    app = require('../server/server');
    endpoint = require('./helpers/api').endpoint
    smtp = require('./helpers/smtp')
    database = require('./helpers/database')
    parse = require('./helpers/parse')
    
    smtp.listen(process.env.EMAIL_PORT)

    database.destroyUserByEmail(app.models, userEmail)
    .then(function(data) {
      server = app.listen(done);
    })
    .catch(function(err) {
      done(err);
    })
  });

  after(function(done) {
    database.destroyUserByEmail(app.models, userEmail)
    .then(function(data) {
      smtp.close(function(data) {
        return true
      });
    })
    .then(function(data) {
      server.close(done);
    })
    .catch(function(err) {
      done(err);
    })
  });

  it('should create a new user and verification email', function(done) {
    smtp.on('data', function(data) {
      // determine that email receipient was the user
      let meta = parse.emailMeta(data)
      assert.equal(meta.to, String(process.env.EMAIL_ADMIN), 'admin is recipient');
      assert.equal(meta.from, String(process.env.EMAIL_FROM), 'sender matches env var');
      // grab the verification URL for use in later test
      assert.isString(data, 'email payload');
      let url = parse.emailVerify(data)
      verifyUrl = url
      smtp.removeAllListeners('data')
      done()
    })
    superagent
      .post(`${endpoint}/Clients/`)
      .send({ email: userEmail, password: userPassword })
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var body = res.body;
        assert.exists(body);
        assert.exists(body.id);
        userId = body.id; // assign for use later
        assert.equal(body.email, userEmail);
        assert.equal(body.code, 'EMAIL_VERIFY');
      }
    );
  });

  it('should not create a duplicate user', function(done) {
    superagent
      .post(`${endpoint}/Clients/`)
      .send({ email: userEmail, password: userPassword })
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .end(function(err, res) {
        assert.equal(res.status, 422);
        var body = res.body;
        assert.exists(body);
        var error = body.error;
        assert.exists(error);
        assert.equal(error.statusCode, 422);
        assert.equal(error.name, 'ValidationError');
        done();
      }
    );
  });

  it('should not log in with unverified user', function(done) {
    superagent
      .post(`${endpoint}/Clients/login`)
      .send({ email: userEmail, password: userPassword })
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .end(function(err, res) {
        assert.equal(res.status, 401);
        var body = res.body;
        assert.exists(body);
        var error = body.error;
        assert.exists(error);
        assert.equal(error.statusCode, 401);
        assert.equal(error.name, 'Error');
        assert.equal(error.code, 'LOGIN_FAILED_EMAIL_NOT_VERIFIED');
        var details = error.details;
        assert.exists(details);
        assert.equal(details.userId, userId);
        done();
      }
    );
  });

  it('should verify user', function(done) {
    superagent
      .get(verifyUrl)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .end(function(err, res) {
        assert.equal(res.status, 200);
        var redirects = res.redirects;
        assert.exists(redirects);
        var url = redirects[0];
        assert.exists(url);
        assert.include(url, 'verified', 'redirected to verified route');
        done();
      }
    );
  });

  it('should log in with verified user', function(done) {
    superagent
      .post(`${endpoint}/Clients/login`)
      .send({ email: userEmail, password: userPassword })
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var body = res.body;
        assert.exists(body);
        assert.exists(body.ttl); // token time to live
        assert.exists(body.created); // token creation time
        assert.exists(body.id); // token for user
        userToken = body.id; // assign for use later
        assert.equal(body.userId, userId);
        done();
      }
    );
  });

  it('should not authorise login with bad password', function(done) {
    superagent
      .post(`${endpoint}/Clients/login`)
      .send({ email: userEmail, password: `${userPassword}a` })
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .end(function(err, res) {
        // console.log(res)
        assert.equal(res.status, 401);
        var body = res.body;
        assert.exists(body);
        var error = body.error;
        assert.exists(error);
        assert.equal(error.statusCode, 401);
        assert.equal(error.message, 'login failed');
        assert.equal(error.code, 'LOGIN_FAILED');
        done();
      }
    );
  });

  it('should not create a duplicate user after verified', function(done) {
    superagent
      .post(`${endpoint}/Clients/`)
      .send({ email: userEmail, password: userPassword })
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .end(function(err, res) {
        assert.equal(res.status, 422);
        var body = res.body;
        assert.exists(body);
        var error = body.error;
        assert.exists(error);
        assert.equal(error.statusCode, 422);
        assert.equal(error.name, 'ValidationError');
        done();
      }
    );
  });



});