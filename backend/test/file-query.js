'use strict';

var assert = require('chai').assert;
var superagent = require('superagent');

describe('Client File Relation Access', function() {
  var app, server, endpoint, smtp, database, parse
  var userEmail, userPassword, userId, userToken, verifyUrl
  var geneticmapId, chromosomeId, markerId

  var load, upload

  var filesGzip = [
    // '../resources/90k_consensus.json.gz',
    '../resources/NIAB_8wMAGIC.json.gz'
  ]

    var files = [
    // '../resources/90k_consensus.json.gz',
    './test/fixtures/example_map1.json'
  ]

  before(function(done) {
    var environment = require('./helpers/environment');
    
    process.env.EMAIL_HOST = "";
    process.env.EMAIL_PORT = "";
    process.env.EMAIL_FROM = "";
    process.env.EMAIL_VERIFY = "NONE";
    process.env.EMAIL_ADMIN = "";

    // scrubbing dependencies (if loaded)
    Object.keys(require.cache).forEach(function(key) { delete require.cache[key] })
        
    app = require('../server/server');
    endpoint = require('./helpers/api').endpoint
    database = require('./helpers/database')
    parse = require('./helpers/parse')

    load = require('../common/utilities/load')
    upload = require('../common/utilities/upload')

    userEmail = 'user@email.com'
    userPassword = 'abcd'
    userId = null
    userToken = null
    geneticmapId = null
    chromosomeId = null
    markerId = null

    database.destroyUserByEmail(app.models, userEmail)
    .then(function(data) {
      return database.destroyGeneticmapsAll(app.models)
    })
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
      return database.destroyGeneticmapsAll(app.models)
    })
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
        assert.exists(body);
        assert.exists(body.id);
        userId = body.id; // assign for use later
        assert.equal(body.email, userEmail);
        assert.equal(body.code, 'EMAIL_NO_VERIFY');
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

  var runs = [
    {model: 'geneticmaps'},
    {model: 'chromosomes'},
    {model: 'markers'}
  ];

  runs.forEach(function (run, idx) {
    it(`should access empty resource ${run.model}`, function(done) {
      superagent
        .get(`${endpoint}/${run.model}/`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .end(function(err, res) {
          // console.log(res.body)
          if (err) { return done(err); }
          assert.equal(res.status, 200);
          var body = res.body;
          assert.exists(body);
          assert.isArray(body);
          assert.isEmpty(body)
          done();
        }
      );
    });
  });

  it(`should load json ${files[0]} into database`, function(done) {
    load.fileJson(files[0])
    .then(function(data) {
      return upload.json(data, app.models)
    })
    .then(function(data) {
      console.log('DONE JSON UPLOAD')
      done()
    })
    .catch(function(err) {
      done(err);
    })
  });

  runs.forEach(function (run, idx) {
    it(`should access populated resource ${run.model}`, function(done) {
      superagent
        .get(`${endpoint}/${run.model}/`)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .end(function(err, res) {
          // console.log(res.body)
          if (err) { return done(err); }
          assert.equal(res.status, 200);
          var body = res.body;
          assert.exists(body);
          assert.isArray(body);
          assert.isNotEmpty(body)
          done();
        }
      );
    });
  });

  it(`should access geneticmaps and chromosomes`, function(done) {
    superagent
      .get(`${endpoint}/geneticmaps?filter[include]=chromosomes`)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .set('Authorization', userToken)
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var body = res.body;
        assert.isArray(body);
        assert.isNotEmpty(body);
        var geneticmap = body[0];
        assert.exists(geneticmap.name);
        assert.exists(geneticmap.id);
        geneticmapId = geneticmap.id;
        var chromosomes = geneticmap.chromosomes;
        assert.isArray(chromosomes);
        assert.isNotEmpty(chromosomes);
        var chromosome = chromosomes[0];
        assert.exists(chromosome.name);
        assert.exists(chromosome.id);
        assert.exists(chromosome.geneticmapId);
        chromosomeId = chromosome.id;
        assert.equal(geneticmapId, chromosome.geneticmapId);
        done();
      }
    );
  });

  it(`should access chromosomes and markers`, function(done) {
    superagent
      .get(`${endpoint}/chromosomes?filter[include]=markers`)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .set('Authorization', userToken)
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var body = res.body;
        assert.isArray(body);
        assert.isNotEmpty(body);
        var chromosome = body[0];
        assert.exists(chromosome.name);
        assert.exists(chromosome.id);
        assert.exists(chromosome.geneticmapId);
        var markers = chromosome.markers;
        assert.isArray(markers);
        assert.isNotEmpty(markers);
        var marker = markers[0];
        assert.exists(marker.name);
        assert.exists(marker.id);
        assert.exists(marker.chromosomeId);
        assert.equal(chromosome.id, marker.chromosomeId);
        markerId = marker.id;
        done();
      }
    );
  });

  it(`should access specific geneticmap with chromosomes`, function(done) {
    superagent
      .get(`${endpoint}/geneticmaps/${geneticmapId}?filter[include]=chromosomes`)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .set('Authorization', userToken)
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var geneticmap = res.body;
        assert.exists(geneticmap.name);
        assert.exists(geneticmap.id);
        assert.equal(geneticmapId, geneticmap.id);
        var chromosomes = geneticmap.chromosomes;
        assert.isArray(chromosomes);
        assert.isNotEmpty(chromosomes);
        var chromosome = chromosomes[0];
        assert.exists(chromosome.name);
        assert.exists(chromosome.id);
        assert.exists(chromosome.geneticmapId);
        chromosomeId = chromosome.id;
        assert.equal(geneticmapId, chromosome.geneticmapId);
        done();
      }
    );
  });

  it(`should access specific chromosome with markers`, function(done) {
    superagent
      .get(`${endpoint}/chromosomes/${chromosomeId}?filter[include]=markers`)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .set('Authorization', userToken)
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var chromosome = res.body;
        assert.exists(chromosome.name);
        assert.exists(chromosome.id);
        assert.exists(chromosome.geneticmapId);
        assert.equal(chromosomeId, chromosome.id);
        var markers = chromosome.markers;
        assert.isArray(markers);
        assert.isNotEmpty(markers);
        var marker = markers[0];
        assert.exists(marker.name);
        assert.exists(marker.id);
        assert.exists(marker.chromosomeId);
        assert.equal(chromosomeId, marker.chromosomeId);
        done();
      }
    );
  });
    // it(`should load GZIP ${files[0]} into database`, function(done) {
    //   upload.json(data, app.models)

    //   load.fileGzip(files[0])
    //     .then(function(data) {
    //       assert.ok(data instanceof Object)
    //       return upload.jsonCheckDuplicate(data, app.models)
    //     })
    //     .then(function(data) {
    //       console.log('DONE JSON CHECK DUPLICATE')
    //       done()
    //     })
    //     .catch(function(err) {
    //       done(err);
    //     })
    // });
  // });


});