'use strict';

var assert = require('chai').assert
var http = require('superagent')
var qs = require('qs')

describe('progressive-path-loading', function() {
  var app, server, endpoint, smtp, database, parse
  var datasetHelper, load

  var userEmail, userPassword, userId, userToken

  let datasetUrl = "https://github.com/plantinformatics/pretzel-data/raw/master/",
      datasetName = "myMap",
      datasetExt = ".json"
  var myMap, myMap3, blocks
  let Dataset

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
    Dataset = app.models.Dataset



    // console.error("Client", Client);
    // console.log('app.models => ', app.models);
    // console.error('app.models => ', app.models);

    userEmail = "test@test.com"
    userPassword = "test"
    userId = null
    userToken = null
    myMap = null

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
      console.log("Retrieve test data from repo");
      myMap = 
        await http
          .get(datasetUrl+datasetName+datasetExt)
          .then(res => {
            console.log("MyMap received");
            // console.log('res.data => ', res.data);
            // console.log('res.text => ', res.text);
            // return JSON.parse(res.text)
            return res.text
          })
          .catch(err => console.log('err.text => ', err.text))
      
      await datasetHelper.upload({dataset: myMap, name: datasetName, ext: datasetExt, userToken})
        .then(res => {
          console.log("Upload completed");
          // console.log('res.body => ', res.body);
          console.log('res.status => ', res.status);
          // assert.equal(res.status, 200);
        })
        .catch(err => {
          console.log("Upload failed");
          console.log('err => ', err.status);
          console.log('err => ', err);
        })

      blocks = await datasetHelper.getBlocks({name: datasetName, userToken})
        .then(res => {
          console.log("Successfully get blocks");
          // console.log('res.body => ', res.body);
          // console.log('res.status => ', res.status);
          // console.log('res.body.blocks => ', res.body.blocks);
          return res.body.blocks
        })
        .catch(err => {
          // console.log('err => ', err);
          console.log("Failed to get blocks");
          console.log('err.status => ', err.status);
          console.log('err.message => ', err.message);
          console.log('err.text => ', err.text);
        })
    })

    after(async function() {
      try {
        console.log("Delete dataset via REST");
        await http
            .del(`${endpoint}/Datasets/${datasetName}`)
            .set('Accept', 'application/json')
            .set('Authorization', userToken)
            .then(res => {
              console.log("Dataset deleted");
              // console.log('res.body => ', res.body);
              console.log('res.status => ', res.status);
              // assert.equal(res.status, 200);
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
      }
      catch(err) {
        console.log('err => ', err);
      }
    })

    it("'MyMap' exists", async function() {
      // console.log('myMap2 => ', myMap);
      // console.log('myMap.name => ', myMap.name);
      await http
        .get(`${endpoint}/Datasets/${datasetName}`)
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
          // .query("intervals[axes][0][domain][]=0")
          // .query("intervals[axes][0][domain][]=100")
          // .query("intervals[axes][0][range]=398")
          // .query("intervals[axes][1][domain][]=0")
          // .query("intervals[axes][1][domain][]=100")
          // .query("intervals[axes][1][range]=398")
          // .query("intervals[page][thresholdFactor]=1")
          // .query("intervals[dbPathFilter]=true")
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
        // console.log('err.text.error => ', err.response.error.text.error);
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
          // .query("intervals[axes][0][domain][]=0")
          // .query("intervals[axes][0][domain][]=100")
          // .query("intervals[axes][0][range]=398")
          // .query("intervals[axes][1][domain][]=0")
          // .query("intervals[axes][1][domain][]=100")
          // .query("intervals[axes][1][range]=398")
          // .query("intervals[page][thresholdFactor]=1")
          // .query("intervals[dbPathFilter]=true")
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
        // console.log('err.text.error => ', err.response.error.text.error);
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
              range: 400
            }, {
              domain: [0, 2],
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
        //Extract the useful part of message returned by superagent
        console.log('err.status => ', err.status);
        console.log('err => ', getErrMessage(err))
        // console.log('err.text.error => ', err.response.error.text.error);
      }

      assert.isArray(features)
      assert.equal(features.length, 0)

    })
  })

  describe("MyMap3 tests", function() {
    before(async function() {
      datasetName = "myMap3"
      console.log("Retrieve test data from repo");

      myMap3 = 
        await load.fileJson("./test/fixtures/myMap3.json")
          .then(res => {
            console.log("MyMap3 received");
            console.log('res => ', res);
            // console.log('res.data => ', res.data);
            // console.log('res.text => ', res.text);
            // return JSON.parse(res.text)
            return JSON.stringify(res)
          })
          .catch(err => console.log('err => ', err))
      
      await datasetHelper.upload({dataset: myMap3, name: datasetName, ext: datasetExt, userToken})
        .then(res => {
          console.log("Upload completed");
          // console.log('res.body => ', res.body);
          console.log('res.status => ', res.status);
          // assert.equal(res.status, 200);
        })
        .catch(err => {
          console.log("Upload failed");
          console.log('err => ', err.status);
          console.log('err => ', err);
        })

      blocks = await datasetHelper.getBlocks({name: datasetName, userToken})
        .then(res => {
          console.log("Successfully get blocks");
          // console.log('res.body => ', res.body);
          // console.log('res.status => ', res.status);
          // console.log('res.body.blocks => ', res.body.blocks);
          return res.body.blocks
        })
        .catch(err => {
          // console.log('err => ', err);
          console.log("Failed to get blocks");
          console.log('err.status => ', err.status);
          console.log('err.message => ', err.message);
          console.log('err.text => ', err.text);
        })
      // console.log('blocks => ', blocks);
    })

    after(async function() {
      try {
        console.log("Delete dataset via REST");
        await http
            .del(`${endpoint}/Datasets/${datasetName}`)
            .set('Accept', 'application/json')
            .set('Authorization', userToken)
            .then(res => {
              console.log("Dataset deleted");
              // console.log('res.body => ', res.body);
              console.log('res.status => ', res.status);
              // assert.equal(res.status, 200);
            })
            .catch(err => {
              console.log("Deleting dataset failed");
              console.log('err.status => ', err.status);
              console.log("err => ", getErrMessage(err));
            })
      }
      catch(err) {
        console.log('err => ', err);
      }
    })
    // it("Run suite", function(done) {
    //   // console.log('app.models => ', app.models);
    //   console.log("In test");
    //   assert.equal(true, true)
    //   done()
    // })

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

      // console.log('alignment => ', alignment);
      // alignment.forEach(block => {
      //   assert.property(block, "blockId")
      //   assert.property(block, "repeats")
      //   console.log('block.repeats => ', block.repeats);
      //   assert.property(block.repeats, "_id")
      //   assert.property(block.repeats, "features")
      //   assert.isArray(block.repeats.features)
      //   assert.equal(block.repeats.features.length, 1)
      // })
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
    })

    it("Run paths-progressive, repeat features, restricted domain", async function() {
      // console.log("blocks in test", blocks);
      let features
      let blockId0 = blocks[0].id,
          blockId1 = blocks[1].id,
          intervals = {
            axes: [ {
              domain: [0, 9],
              range: 400
            }, {
              domain: [0, 40],
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

})


function getErrMessage(err) {
  return JSON.parse(err.response.error.text).error.message
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