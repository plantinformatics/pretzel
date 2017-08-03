'use strict';

process.env.NODE_ENV = 'test';
process.env.API_PORT_EXT = 5000;
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "27017";
process.env.DB_USER = "Dav127";
process.env.DB_PASS = "Dav127";

var assert = require('chai').assert;
var superagent = require('superagent');
var app = require('../server/server');

var endpoint = `http://localhost:${process.env.API_PORT_EXT}`
var endpointAPI = `${endpoint}/api`

function destroyUserByEmail(email) {
  // discover used by email, delete if present
  var Client = app.models.Client;
  return Client.findOne({where: {email: email}})
  .then(function(data) {
    if (data) {
      return Client.destroyById(data.id)
    } else {
      return null
    }
  })
}

describe('Client model', function() {
  var server;

  var userEmail = 'user@email.com'
  var userPassword = 'abcd'
  var userId = null
  var userToken = null

  before(function(done) {
    destroyUserByEmail(userEmail)
    .then(function(data) {
      server = app.listen(done);
    })
    .catch(function(err) {
      done(err);
    })
  });

  after(function(done) {
    destroyUserByEmail(userEmail)
    .then(function(data) {
      server.close(done);
    })
    .catch(function(err) {
      done(err);
    })
  });

  it('should show server status', function(done) {
    superagent
      .get(`${endpoint}/status`)
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        assert.exists(res.body);
        assert.isNotNaN(res.body.started);
        assert.exists(res.body.uptime);
        done()
      }
    );
  });

  it('should create a new user', function(done) {
    superagent
      .post(`${endpointAPI}/Clients/`)
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
        assert.equal(body.code, 'EMAIL_UNVERIFIED');
        done();
      }
    );
  });

  it('should not create a duplicate user', function(done) {
    superagent
      .post(`${endpointAPI}/Clients/`)
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
      .post(`${endpointAPI}/Clients/login`)
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
      .post(`${endpointAPI}/Clients/login`)
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
      .post(`${endpointAPI}/Clients/login`)
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
    {model: 'geneticmaps'},
    {model: 'chromosomes'},
    // {model: 'markers'}
  ];

  runs.forEach(function (run, idx) {
    it(`should access resource ${run.model} with token`, function(done) {
      superagent
        .get(`${endpointAPI}/${run.model}/`)
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
        .get(`${endpointAPI}/${run.model}/`)
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