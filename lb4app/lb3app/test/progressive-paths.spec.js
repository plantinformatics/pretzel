'use strict';

var assert = require('chai').assert
var http = require('superagent')
var qs = require('qs')
var _ = require('lodash')
let fs = require('fs')

var datasetHelper, load

describe('progressive-path-loading', function() {
  var app, server, endpoint, smtp, database, parse

  var userEmail, userPassword, userId, userToken

  var ds, blocks
  // let Dataset

  beforeEach(function() {
  })

  before(async function() {
    console.log("Before");
    var environment = require('./helpers/environment')

    process.env.AUTH = "ALL"
    process.env.EMAIL_VERIFY = "NONE"
    process.env.EMAIL_HOST = ""
    process.env.EMAIL_PORT = ""
    process.env.EMAIL_FROM = ""
    process.env.EMAIL_ADMIN = ""

    // scrubbing dependencies (if loaded)
    Object.keys(require.cache).forEach(function(key) { delete require.cache[key] })

    app = require('../server/server')
    endpoint = require('./helpers/api').endpoint
    database = require('./helpers/database')
    datasetHelper = require('./helpers/dataset')
    load = require('../common/utilities/load')

    let Client = app.models.Client
    // Dataset = app.models.Dataset

    ds = {
      url: "https://github.com/plantinformatics/pretzel-data/raw/master/",
      path: "",
      filename: "myMap",
      name: "myMap",
      ext: ".json"
    }
    blocks = null

    userEmail = "test@test.com"
    userPassword = "test"
    userId = null
    userToken = null

    try {
      // console.log("Wipe db from previous tests");
      // app.dataSources.db.automigrate();

      console.log("Delete test user from previous tests");
      await database.destroyUserByEmail(app.models, userEmail)

      console.log("Create test user");
      await Client.create({email: userEmail, password: userPassword}, (err, instance) => {
        console.log('instance => ', instance);
        userId = instance.id
      })

      // console.log("Start server");
      // server = app.listen();

      console.log("Login test user");
      await http
        .post(`${endpoint}/Clients/login`)
        .send({ email: userEmail, password: userPassword })
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .then(res => {
          // console.log('res.body => ', res.body);
          userToken = res.body.id
          console.log('userToken => ', userToken);
        })

      /* Previous dataset should be deleted here, but permissions prevents this */
      
    } catch(err) {
      // console.log('err => ', err);
    }
  })

  after(async function() {
    console.log("After all");
  })

  it("Test Mocha", function(done) {
    // console.log('app.models => ', app.models);
    console.log("In test");
    assert.equal(true, true)
    done()
  })

  describe("MyMap tests", function() {
    before(async function() {
      blocks = null
      ds.name = "myMap"
      ds.filename = "myMap"

      blocks = await datasetHelper.setup({ds, userToken})
      .then(res => {
        console.log("Successfully get blocks");
        return res.body.blocks
      })
      .catch(err => {
        // console.log('err => ', err);
        console.log("Failed to get blocks");
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err));
      })
    })

    after(async function() {
      await datasetHelper.del({name: ds.name, userToken})
        .then(res => {
          console.log("Dataset deleted");
          console.log('res.status => ', res.status);
        })
        .catch(err => {
          console.log("Deleting dataset failed");
          console.log('err.status => ', err.status);
          console.log("err => ", getErrMessage(err));
        })

        // console.log("Delete myMap in db via LB");
        // await Dataset.destroyById(myMap.name)
        // .then(function(data) {
        //   console.log("Dataset deleted");
        //   console.log('data => ', data);
        // })
        // .catch(err => {
        //   console.log("Deleting dataset failed");
        //   console.log('err => ', err);
        // })
        // await http
        // server.close(done);
    })

    it("'MyMap' exists", async function() {
      // console.log('myMap2 => ', myMap);
      // console.log('myMap.name => ', myMap.name);
      await http
        .get(`${endpoint}/Datasets/test_pzl_${ds.name}`)
        .set('Accept', 'application/json')
        .set('Authorization', userToken)
        .then(res => {
          // console.log('test res.body => ', res.body);
          assert.equal(res.status, 200);
        })
    })

    it("Run paths-progressive, 1 path", async function() {
      let features
      //Could set this as a search to find the specific blocks
      let blockId0 = blocks[1].id,
          blockId1 = blocks[2].id,
          intervals = {
            axes: [ {
              domain: [0, 100],
              range: 400
            }, {
              domain: [0, 100],
              range: 400
            }],
            page: {
              thresholdFactor: 1
            },
            dbPathFilter: true
          }

      try {
        // console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            console.log('features => ', features);
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
      }

      assert.isArray(features)
      assert.equal(features.length, 1)

      let markerC = features[0]
      assert.deepInclude(markerC, { _id: { name: "myMarkerC" } })
      assert.property(markerC, "alignment")

      let alignment = markerC.alignment
      assert.isArray(alignment)
      assert.equal(alignment.length, 2)

      console.log('alignment => ', alignment);
      alignment.forEach(block => {
        assert.property(block, "blockId")
        assert.property(block, "repeats")
        console.log('block.repeats => ', block.repeats);
        assert.property(block.repeats, "_id")
        assert.property(block.repeats, "features")
        assert.isArray(block.repeats.features)
        assert.equal(block.repeats.features.length, 1)
      })
    })

    it("Run paths-progressive, 0 paths", async function() {
      let features
      let blockId0 = blocks[0].id,
          blockId1 = blocks[2].id,
          intervals = {
            axes: [ {
              domain: [0, 100],
              range: 400
            }, {
              domain: [0, 100],
              range: 400
            }],
            page: {
              thresholdFactor: 1
            },
            dbPathFilter: true
          }

      try {
        console.log('blockId0, blockId1 => ', blockId0, blockId1);
        console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            console.log('features => ', features);
          })
      }
      catch(err) {
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
      }

      console.log('features.length => ', features.length);
      assert.isArray(features)
      assert.equal(features.length, 0)
    })

    it("Run paths-progressive, restricted domain", async function() {
      let features
      let blockId0 = blocks[1].id,
          blockId1 = blocks[2].id,
          intervals = {
            axes: [ {
              domain: [0, 2],
              range: 400,
              zoomed: true
            }, {
              domain: [0, 2],
              range: 400,
              zoomed: true
            }],
            page: {
              thresholdFactor: 1
            },
            dbPathFilter: true
          }

      try {
        console.log('blockId0, blockId1 => ', blockId0, blockId1);
        console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            console.log('features => ', features);
          })
      }
      catch(err) {
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
      }

      console.log('features => ', features);
      assert.isArray(features)
      assert.equal(features.length, 0)
    })
  })

  describe("MyMap3 tests", function() {
    let response

    before(async function() {
      blocks = null
      ds.filename = "myMap3"
      ds.name = "myMap3"
      
      blocks = await datasetHelper.setup({ds, userToken})
      .then(res => {
        console.log("Successfully get blocks");
        return res.body.blocks
      })
      .catch(err => {
        // console.log('err => ', err);
        console.log("Failed to get blocks");
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err));
      })
      // console.log('blocks => ', blocks);
    })

    after(async function() {
      await datasetHelper.del({name: ds.name, userToken})
        .then(res => {
          console.log("Dataset deleted");
          console.log('res.status => ', res.status);
        })
        .catch(err => {
          console.log("Deleting dataset failed");
          console.log('err.status => ', err.status);
          console.log("err => ", getErrMessage(err));
        })
    })

    it("Run paths-progressive, 1 path", async function() {
      // console.log("blocks in test", blocks);
      let features
      let blockId0 = blocks[0].id,
          blockId1 = blocks[2].id,
          intervals = {
            axes: [ {
              domain: [0, 100],
              range: 400
            }, {
              domain: [0, 100],
              range: 400
            }],
            page: {
              thresholdFactor: 1
            },
            dbPathFilter: true
          }

      try {
        console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body

            // Set response to compare in next test
            response = features
            console.log('features => ', features);
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      assert.isArray(features)
      assert.equal(features.length, 1)

      let marker = features[0]
      assert.deepInclude(marker, { _id: { name: "myMarkerB" } })
      assert.property(marker, "alignment")

      let alignment = marker.alignment
      assert.isArray(alignment)
      assert.equal(alignment.length, 2)
    })

    it("Run paths-progressive, dbPathFilter false", async function() {
      // console.log("blocks in test", blocks);
      let features
      let blockId0 = blocks[0].id,
          blockId1 = blocks[2].id,
          intervals = {
            axes: [ {
              domain: [0, 100],
              range: 400
            }, {
              domain: [0, 100],
              range: 400
            }],
            page: {
              thresholdFactor: 1
            },
            dbPathFilter: false
          }
      try {
        console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            // console.log('features => ', features);
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      assert.isArray(features)
      assert.deepEqual(response, features)
    })

    it("Run paths-progressive, repeat features", async function() {
      // console.log("blocks in test", blocks);
      let features
      let blockId0 = blocks[0].id,
          blockId1 = blocks[1].id,
          intervals = {
            axes: [ {
              domain: [0, 100],
              range: 400
            }, {
              domain: [0, 100],
              range: 400
            }],
            page: {
              thresholdFactor: 1
            },
            dbPathFilter: true
          }

      try {
        console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            // console.log('features => ', features);
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      assert.isArray(features)
      // assert.equal(features.length, 1)

      let marker = features[0]
      assert.deepInclude(marker, { _id: { name: "myMarkerA" } })
      assert.property(marker, "alignment")

      let alignment = marker.alignment
      assert.isArray(alignment)
      assert.equal(alignment.length, 2)

      console.log('alignment => ', alignment);
      alignment.forEach(block => {
        assert.property(block, "blockId")
        assert.property(block, "repeats")
        // console.log('block.repeats => ', block.repeats);
        assert.property(block.repeats, "_id")
        assert.property(block.repeats, "features")
        
        let reps = block.repeats.features
        assert.isArray(reps)

        //uncertain about block order within alignment
        if(block.blockId === blockId0) {
          assert.equal(reps.length, 3)
        }
        else if(block.blockId === blockId1) {
          assert.equal(reps.length, 2)
        }
        else {
          throw Error("Block Id not recognised")
        }

        // console.log('block.repeats.features => ', block.repeats.features);
        // assert.equal(block.repeats.features.length, 1)
      })

      let numPaths = calcNumPaths(features)

      console.log('numPaths => ', numPaths);
      assert.equal(numPaths, 6)
    })

    it("Run paths-progressive, repeat features, restricted domain", async function() {
      // console.log("blocks in test", blocks);
      let features
      let blockId0 = blocks[0].id,
          blockId1 = blocks[1].id,
          intervals = {
            axes: [ {
              domain: [0, 40],
              range: 400,
              zoomed: true
            }, {
              domain: [9, 40],
              range: 400,
              zoomed: true
            }],
            page: {
              thresholdFactor: 1e5
            },
            dbPathFilter: true
          }

      try {
        console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            // console.log('features => ', features);
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      // features.forEach(f => {
      //   console.log('f.alignment[0].repeats.features => ', f.alignment[0].repeats.features);
      //   console.log('f.alignment[1].repeats.features => ', f.alignment[1].repeats.features);
      // })

      assert.isArray(features)
      console.log('features => ', features);
      // Currently failing here, why?
      assert.equal(features.length, 1)

      let marker = features[0]
      assert.deepInclude(marker, { _id: { name: "myMarkerA" } })

      let alignment = marker.alignment
      assert.isArray(alignment)

      // console.log('alignment => ', alignment);
      alignment.forEach(block => {
        assert.property(block, "repeats")
        assert.property(block.repeats, "features")
        // console.log('block.repeats => ', block.repeats);
        
        let reps = block.repeats.features
        assert.isArray(reps)

        //uncertain about block order within alignment
        if(block.blockId === blockId0) {
          // console.log('reps => ', reps);
          assert.equal(reps.length, 2)
          // console.log("block0 ok");
        }
        else if(block.blockId === blockId1) {
          // console.log('reps => ', reps);
          assert.equal(reps.length, 1)
          // console.log("block1 ok");
        }
        else {
          throw Error("Block Id not recognised")
        }
        // console.log('block.repeats.features => ', block.repeats.features);
        // assert.equal(block.repeats.features.length, 1)
      })
    })

  })

  describe("Small public data tests", function() {
    this.slow(1500)
    this.timeout(2000)

    let ds2
    before(async function() {
      this.timeout(30000)

      blocks = null
      ds2 = _.cloneDeep(ds)
      ds.name = "Wen_et_al_2017"
      ds.filename = "Wen_et_al_2017.fixed"
      ds.path = "public_maps/json/"

      ds2.name = "PBI-14-1406-s005"
      ds2.filename = "PBI-14-1406-s005.fixed"
      ds2.path = "public_maps/json/"

      // console.log('ds, ds2 => ', ds, ds2);

      let promises = [ds, ds2].map(async d => datasetHelper.setup({ds: d, userToken}))
      await Promise.all(promises).then(values => {
        console.log("Successfully get blocks");
        blocks = values.reduce((arr, res) => {
          // console.log('res => ', res);
          // console.log('res.body => ', res.body);
          // console.log('res.body.blocks => ', res.body.blocks);
          return arr.concat(res.body.blocks)
        }, [])
        // return res.body.blocks
      })
      .catch(err => {
        // console.log('err => ', err);
        console.log("Failed to get blocks");
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err));
        // console.log('err => ', getErrMessage(err));
      })
      // console.log('blocks => ', blocks);
    })
    
    after(async function() {
      let promises = [ds, ds2].map(async d => datasetHelper.del({name: d.name, userToken}))
      await Promise.all(promises).then(res => {
          console.log("Datasets deleted");
          // console.log('res.body => ', res.body);
          console.log('res.status => ', res.status);
          // assert.equal(res.status, 200);
        })
        .catch(err => {
          console.log("Deleting dataset failed");
          console.log('err => ', err);
        })
    })

    it("Run paths-progressive, simple", async function() {
      // console.log("blocks in test", blocks);
      let features
      let blockId0 = findBlockId({blocks, name: ds.name, scope: '1B'}),
          blockId1 = findBlockId({blocks, name: ds2.name, scope: '1B'}),
          intervals = {
            axes: [ {
              domain: [0, 500],
              range: 400,
              zoomed: true
            }, {
              domain: [0, 500],
              range: 400,
              zoomed: true
            }],
            page: {
              thresholdFactor: 1e5
            },
            dbPathFilter: true
          }

      try {
        console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            // console.log('features => ', features.slice(0,10));
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      assert.isArray(features)
      // console.log('features => ', features);
      console.log('features.length => ', features.length);
      assert.equal(features.length, 2292)

      let numPaths = calcNumPaths(features)
      console.log('numPaths => ', numPaths);
      assert.equal(numPaths, 2292)
      // let marker = features[0]
      // assert.property(marker, "alignment")
      // console.log('marker.alignment[0] => ', marker.alignment[0]);
      // console.log('marker.alignment[0].repeats => ', marker.alignment[0].repeats);
    })

    it("Run paths-progressive, restricted domain", async function() {
      // console.log("blocks in test", blocks);
      let features

      let blockId0 = findBlockId({blocks, name: ds.name, scope: '1B'}),
          blockId1 = findBlockId({blocks, name: ds2.name, scope: '1B'}),
          intervals = {
            axes: [ {
              domain: [100, 400],
              range: 400,
              zoomed: true
            }, {
              domain: [0, 200],
              range: 400,
              zoomed: true
            }],
            page: {
              thresholdFactor: 1e5
            },
            dbPathFilter: true
          }

      try {
        console.log('userToken => ', userToken);
        console.log('blockId0, blockId1 => ', blockId0, blockId1);
        console.log('intervals.axes => ', intervals.axes);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            features = res.body
          })
      }
      catch(err) {
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
      }

      assert.isArray(features)
      // Varies each time it's run, why does it vary?
      console.log('features.length => ', features.length);
      assert.equal(features.length, 1227)

      let numPaths = calcNumPaths(features)
      console.log('numPaths => ', numPaths);
      assert.equal(numPaths, 1227)
    })

    it("Run paths-progressive, restricted range, low threshold", async function() {
      // console.log("blocks in test", blocks);
      let features
      let blockId0 = findBlockId({blocks, name: ds.name, scope: '1B'}),
          blockId1 = findBlockId({blocks, name: ds2.name, scope: '1B'}),
          intervals = {
            axes: [ {
              domain: [0, 500],
              range: 20,
              zoomed: true
            }, {
              domain: [0, 500],
              range: 40,
              zoomed: true
            }],
            page: {
              thresholdFactor: 1
            },
            dbPathFilter: true
          }

      try {
        // console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            // console.log('features => ', features.slice(0,10));
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      assert.isArray(features)
      assert.equal(features.length, 6)

      let numPaths = calcNumPaths(features)
      assert.equal(numPaths, 6)
    })

    it("Run paths-progressive, restricted range, mid threshold", async function() {
      // console.log("blocks in test", blocks);
      let features
      let blockId0 = findBlockId({blocks, name: ds.name, scope: '1B'}),
          blockId1 = findBlockId({blocks, name: ds2.name, scope: '1B'}),
          intervals = {
            axes: [ {
              domain: [0, 500],
              range: 20,
              zoomed: true
            }, {
              domain: [0, 500],
              range: 40,
              zoomed: true
            }],
            page: {
              thresholdFactor: 100
            },
            dbPathFilter: true
          }

      try {
        // console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            // console.log('features => ', features.slice(0,10));
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      assert.isArray(features)
      assert.equal(features.length, 573)

      let numPaths = calcNumPaths(features)
      assert.equal(numPaths, 573)
    })

    it("Run paths-progressive, restricted range, high threshold", async function() {
      // console.log("blocks in test", blocks);
      let features
      let blockId0 = findBlockId({blocks, name: ds.name, scope: '1B'}),
          blockId1 = findBlockId({blocks, name: ds2.name, scope: '1B'}),
          intervals = {
            axes: [ {
              domain: [0, 500],
              range: 20,
              zoomed: true
            }, {
              domain: [0, 500],
              range: 40,
              zoomed: true
            }],
            page: {
              thresholdFactor: 1e5
            },
            dbPathFilter: true
          }

      try {
        // console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            // console.log('features => ', features.slice(0,10));
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      assert.isArray(features)
      assert.equal(features.length, 2292)

      let numPaths = calcNumPaths(features)
      assert.equal(numPaths, 2292)
    })

    it("Run paths-progressive, nSamples", async function() {
      // console.log("blocks in test", blocks);
      let features
      let blockId0 = findBlockId({blocks, name: ds.name, scope: '1B'}),
          blockId1 = findBlockId({blocks, name: ds2.name, scope: '1B'}),
          intervals = {
            axes: [ {
              domain: [0, 500],
              range: 400,
              zoomed: true
            }, {
              domain: [0, 500],
              range: 400,
              zoomed: true
            }],
            page: {
              thresholdFactor: 1
            },
            dbPathFilter: true,
            nSamples: 100
          }

      try {
        // console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
          })
      }
      catch(err) {
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
      }

      assert.isArray(features)
      assert.equal(features.length, 100)

      let numPaths = calcNumPaths(features)
      assert.equal(numPaths, 100)
    })
  })

  describe("90k markers, no aliases", function() {
    this.slow(1800)
    this.timeout(3000)
    
    before(async function() {
      this.timeout(60000)
      blocks = null

      ds.name = "Triticum_aestivum_IWGSC_RefSeq_v1.0_90k_markers"
      ds.filename = "Triticum_aestivum_IWGSC_RefSeq_v1.0_90k-markers.meta.1ab"
      ds.path = "public/"

      blocks = await datasetHelper.setup({ds, userToken})
      .then(res => {
        console.log("Successfully get blocks");
        return res.body.blocks
      })
      .catch(err => {
        // console.log('err => ', err);
        console.log("Failed to get blocks");
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err));
        throw err
      })
      // console.log('blocks => ', blocks);
    })

    after(async function() {
      await datasetHelper.del({name: ds.name, userToken})
        .then(res => {
          console.log("Dataset deleted");
          console.log('res.status => ', res.status);
        })
        .catch(err => {
          console.log("Deleting dataset failed");
          console.log('err.status => ', err.status);
          console.log("err => ", getErrMessage(err));
        })
    })

    it("All features", async function() {
      let features
      console.log('blocks => ', blocks);
      let blockId0 = blocks.find(b => b.name === '1A').id,
          blockId1 = blocks.find(b => b.name === '1B').id,
          intervals = {
            axes: [ {
              domain: [0, 5e9],
              range: 400,
              zoomed: true
            }, {
              domain: [0, 5e9],
              range: 400,
              zoomed: true
            }],
            page: {
              thresholdFactor: 1e5
            },
            dbPathFilter: true
            // nSamples: 100
          }

      try {
        // console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            // console.log('features => ', features.slice(0,10));
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      assert.isArray(features)
      console.log('features.length => ', features.length);
      assert.equal(features.length, 5071)

      let numPaths = calcNumPaths(features)
      console.log('numPaths => ', numPaths);
      assert.equal(numPaths, 5795)

    })

    it("Restricted domain", async function() {
      let features
      console.log('blocks => ', blocks);
      let blockId0 = blocks.find(b => b.name === '1A').id,
          blockId1 = blocks.find(b => b.name === '1B').id,
          intervals = {
            axes: [ {
              domain: [1e5, 5e6],
              range: 400,
              zoomed: true
            }, {
              domain: [0, 5e9],
              range: 400,
              zoomed: true
            }],
            page: {
              thresholdFactor: 1e5
            },
            dbPathFilter: true
            // nSamples: 100
          }

      try {
        // console.log('blockId0, blockId1 => ', blockId0, blockId1);
        // console.log('intervals => ', intervals);

        await http
          .get(`${endpoint}/Blocks/pathsProgressive`)
          .query({ blockA: blockId0 })
          .query({ blockB: blockId1 })
          .query(qs.stringify({ intervals }))
          .set('Authorization', userToken)
          .then(res => {
            assert.equal(res.status, 200)
            
            features = res.body
            // console.log('features => ', features.slice(0,10));
          })
      }
      catch(err) {
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      assert.isArray(features)
      console.log('features.length => ', features.length);
      // assert.equal(features.length, 5)

      let numPaths = calcNumPaths(features)
      console.log('numPaths => ', numPaths);
      // assert.equal(numPaths, 5)

    })

  })

  describe("Large public data tests", function() {
    before(async function() {
      this.timeout(0)
      ds = {
        path: './test/testdata/',
        name: 'Triticum_aestivum_IWGSC_RefSeq_v1.0',
        ext: '.json'
      }

      blocks = null

      await load.fileJson(ds.path + ds.name + '_genome.json')
      .then(data => {
        // console.log('data => ', data);
        return datasetHelper.createComplete({data, userToken})
      })
      .then(data => datasetHelper.makePublic({name: ds.name, userToken}))
      .then(() => console.log("Genome upload completed"))
      .catch(err => {
        console.log("Genome upload failed");
        console.log('err => ', err.status);
        console.log('err => ', getErrMessage(err));
        throw err
      })

      await load.fileGzip(ds.path + ds.name + '_HC_annotation.json.gz')
      .then(data => {
        // console.log('data2 => ', data);
        return datasetHelper.createComplete({data, userToken})
      })
      .then(() => datasetHelper.makePublic({name: ds.name + '_HC_genes', userToken}))
      .then(() => console.log("Annotations upload completed"))
      .catch(err => {
        console.log("Annotations upload failed");
        console.log('err => ', err.status);
        console.log('err => ', getErrMessage(err));
        throw err
      })

      await load.fileGzip(ds.path + ds.name + '_HC_VS_' + ds.name + '_HC_aliases.json.gz')
      .then(data => {
        // console.log('data3 => ', data);
        return datasetHelper.aliases({data, userToken})
      })
      .then(() => console.log("Aliases upload completed"))
      .catch(err => {
        console.log("Aliases upload failed");
        console.log('err => ', err.status);
        console.log('err => ', getErrMessage(err));
        throw err
      })
    })

    after(async function() {
      await datasetHelper.del({name: ds.name, userToken})
      .then(res => {
        console.log("Dataset deleted");
        console.log('res.status => ', res.status);
        return datasetHelper.del({name: ds.name + '_HC_genes', userToken})
      })
      .then(res => {
        console.log("Dataset deleted");
        console.log('res.status => ', res.status);
        // await delete Aliases
      })
      // .then(res => {

      // })
      .catch(err => {
        console.log("Deleting dataset failed");
        console.log('err.status => ', err.status);
        console.log("err => ", getErrMessage(err));
      })
    })

    it("Run test", function(done) {
      // console.log('app.models => ', app.models);
      console.log("In test");
      assert.equal(true, true)
      done()
    })
  })

})

// Log results to file for analysis
function writeJSONToFile({data, filepath = './test/log.json'}) {
  fs.writeFile(filepath, JSON.stringify(features, null, 2), (err) => {
    if(err) console.log('err => ', err);
    console.log("JSON written");
  })
}

// Finds a block within a collection with a given dataset name and scope
// Returns blockId if found, undefined if block isn't found 
// or undefined if id is undefined
function findBlockId({blocks, name, scope}) {
  let block = blocks.find(b => {
    return b.name === scope &&
           b.datasetId === datasetHelper.getName(name)
    })
  if(block)
    return block.id
}

function calcNumPaths(features) {
  return features.map(feature => {
    // console.log('feature => ', feature);
    return [0, 1].map(block => {
      // console.log(`feature.alignment[${block}].repeats.features => `, feature.alignment[block].repeats.features);
      let length = _.property(`alignment.${block}.repeats.features.length`)(feature)
      // console.log('length => ', length);
      if (length !== undefined) {
        return length
      }
      else {
        throw Error("Number of features invalid - is features object structure valid?")
      }
    })
  }).reduce((total, array) => {
    // console.log('array[0], array[1] => ', array[0], array[1]);
    return total + array[0] * array[1]
  }, 0 )
}

function getErrMessage(err) {
  let temp = _.property("response.error.text")(err)
  if(!temp) {
    return err
  }
  let temp2 = _.property("error.message")(JSON.parse(temp))
  return temp2
}

function mochaAsync(fn) {
  return async (done) => {
    try {
      await fn()
      done()
    }
    catch(err) {
      done(err)
      // console.log('err => ', err);
    }
  }
}