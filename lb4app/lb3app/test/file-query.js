'use strict';

var assert = require('chai').assert;
var superagent = require('superagent');
var path = require('path');

describe('Client File Relation Access', function() {
  var app, server, endpoint, smtp, database, parse
  var userEmail, userPassword, userId, userToken, verifyUrl
  var datasetId, blockId, featureId

  var load, upload

  var filesGzip = [
    './test/fixtures/example_map1.json.gz',
    './test/fixtures/example_map2.json.gz'
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
    datasetId = null
    blockId = null
    featureId = null

    database.destroyUserByEmail(app.models, userEmail)
    .then(function(data) {
      return database.destroyDatasetsAll(app.models)
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
      return database.destroyDatasetsAll(app.models)
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
    {model: 'datasets'},
    {model: 'blocks'},
    {model: 'features'}
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
    load.fileBinary(files[0])
    .then(function(data) {
      var fileName = path.basename(files[0]);
      var msg = {data : data, fileName: fileName};

      superagent
        .post(`${endpoint}/Datasets/upload`)
        .send(msg)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .end(function(err, res) {
          if (err) { return done(err); }
          assert.equal(res.status, 200);
          done();
        }
      );
    })
    .catch(function(err) {
      done(err);
    });
  });

  it(`should load gzip ${filesGzip[1]} into database`, function(done) {
    load.fileBinary(filesGzip[1])
    .then(function(data) {
      var fileName = path.basename(filesGzip[1]);
      var msg = {data : data, fileName: fileName};

      superagent
        .post(`${endpoint}/Datasets/upload`)
        .send(msg)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .end(function(err, res) {
          if (err) { return done(err); }
          assert.equal(res.status, 200);
          done();
        }
      );
    })
    .catch(function(err) {
      done(err);
    });
  });

  it(`should not load duplicate data into database`, function(done) {
    load.fileBinary(filesGzip[0])
    .then(function(data) {
      var fileName = path.basename(filesGzip[0]);
      var msg = {data : data, fileName: fileName};

      superagent
        .post(`${endpoint}/Datasets/upload`)
        .send(msg)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .end(function(err, res) {
          assert.equal(res.status, 500);
          done();
        }
      );
    })
    .catch(function(err) {
      done(err);
    });
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

  it(`should access datasets and blocks`, function(done) {
    superagent
      .get(`${endpoint}/datasets?filter[include]=blocks`)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .set('Authorization', userToken)
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var body = res.body;
        assert.isArray(body);
        assert.isNotEmpty(body);
        var dataset = body[0];
        assert.exists(dataset.name);
        assert.exists(dataset.id);
        datasetId = dataset.id;
        var blocks = dataset.blocks;
        assert.isArray(blocks);
        assert.isNotEmpty(blocks);
        var block = blocks[0];
        assert.exists(block.name);
        assert.exists(block.id);
        assert.exists(block.datasetId);
        blockId = block.id;
        assert.equal(datasetId, block.datasetId);
        done();
      }
    );
  });

  it(`should access blocks and features`, function(done) {
    superagent
      .get(`${endpoint}/blocks?filter[include]=features`)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .set('Authorization', userToken)
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var body = res.body;
        assert.isArray(body);
        assert.isNotEmpty(body);
        var block = body[0];
        assert.exists(block.name);
        assert.exists(block.id);
        assert.exists(block.datasetId);
        var features = block.features;
        assert.isArray(features);
        assert.isNotEmpty(features);
        var feature = features[0];
        assert.exists(feature.name);
        assert.exists(feature.id);
        assert.exists(feature.blockId);
        assert.equal(block.id, feature.blockId);
        featureId = feature.id;
        done();
      }
    );
  });

  it(`should access specific dataset with blocks`, function(done) {
    superagent
      .get(`${endpoint}/Datasets/${datasetId}?filter[include]=blocks`)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .set('Authorization', userToken)
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var dataset = res.body;
        assert.exists(dataset.name);
        assert.exists(dataset.id);
        assert.equal(datasetId, dataset.id);
        var blocks = dataset.blocks;
        assert.isArray(blocks);
        assert.isNotEmpty(blocks);
        var block = blocks[0];
        assert.exists(block.name);
        assert.exists(block.id);
        assert.exists(block.datasetId);
        blockId = block.id;
        assert.equal(datasetId, block.datasetId);
        done();
      }
    );
  });

  it(`should access specific block with features`, function(done) {
    superagent
      .get(`${endpoint}/blocks/${blockId}?filter[include]=features`)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .set('Authorization', userToken)
      .end(function(err, res) {
        if (err) { return done(err); }
        assert.equal(res.status, 200);
        var block = res.body;
        assert.exists(block.name);
        assert.exists(block.id);
        assert.exists(block.datasetId);
        assert.equal(blockId, block.id);
        var features = block.features;
        assert.isArray(features);
        assert.isNotEmpty(features);
        var feature = features[0];
        assert.exists(feature.name);
        assert.exists(feature.id);
        assert.exists(feature.blockId);
        assert.equal(blockId, feature.blockId);
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