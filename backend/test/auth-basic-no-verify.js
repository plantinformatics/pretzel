'use strict';

var assert = require('chai').assert;
var superagent = require('superagent');

describe('auth-basic-no-verify', function() {
  var app, server, endpoint, smtp, database, parse

  var userEmail, userPassword, userId, userToken, verifyUrl

  before(function(done) {
    var environment = require('./helpers/environment');
    process.env.EMAIL_VERIFY = "NONE";
    process.env.EMAIL_HOST = "";
    process.env.EMAIL_PORT = "";
    process.env.EMAIL_FROM = "";
    process.env.EMAIL_ADMIN = "";
  
    // scrubbing dependencies (if loaded)
    // delete require.cache[require.resolve('../server/server')]
    // delete require.cache[require.resolve('./helpers/smtp')]
    // delete require.cache[require.resolve('./helpers/database')]
    // delete require.cache[require.resolve('./helpers/parse')]

    Object.keys(require.cache).forEach(function(key) { delete require.cache[key] })

    // console.log(require.cache)

    app = require('../server/server');
    endpoint = require('./helpers/api').endpoint
    database = require('./helpers/database')

    userEmail = 'no-verify@email.com'
    userPassword = 'abcd'
    userId = null
    userToken = null

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
      server.close(done);
    })
    .catch(function(err) {
      done(err);
    })
  });

  it('should create a new user', function(done) {
    superagent
      .post(`${endpoint}/Clients/`)
      .send({ email: userEmail, password: userPassword })
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var body = res.body;
        console.log('BODY', body)
        assert.exists(body);
        assert.exists(body.id);
        userId = body.id; // assign for use later
        assert.equal(body.email, userEmail);
        assert.equal(body.code, 'EMAIL_NO_VERIFY');
        done();
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

  it('should log in with new user', function(done) {
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

  it('should not authorise login with bad email', function(done) {
    superagent
      .post(`${endpoint}/Clients/login`)
      .send({ email: `${userEmail}a`, password: userPassword })
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

  var runs = [
    {model: 'datasets'},
    {model: 'blocks'},
    // {model: 'features'}
  ];

  runs.forEach(function (run, idx) {
    it(`should access resource ${run.model} with token`, function(done) {
      superagent
        .get(`${endpoint}/${run.model}/`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .end(function(err, res) {
          console.log(res.body)
          if (err) { return done(err); }
          assert.equal(res.status, 200);
          var body = res.body;
          assert.exists(body);
          assert.isArray(body);
          done();
        }
      );
    });

    it(`should block resource ${run.model} with bad token`, function(done) {
      superagent
        .get(`${endpoint}/${run.model}/`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', `${userToken}a`)
        .end(function(err, res) {
          assert.equal(res.status, 401);
          var body = res.body;
          assert.exists(body);
          var error = body.error;
          assert.exists(error);
          assert.equal(error.statusCode, 401);
          assert.equal(error.message, 'Authorization Required');
          assert.equal(error.code, 'AUTHORIZATION_REQUIRED');
          done();
        }
      );
    });
  });

});