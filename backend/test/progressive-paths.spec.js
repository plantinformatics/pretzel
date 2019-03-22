'use strict';

var assert = require('chai').assert
var http = require('superagent')
var qs = require('qs')

describe('progressive-path-loading', function() {
  var app, server, endpoint, smtp, database, parse

  var userEmail, userPassword, userId, userToken

  let datasetUrl = "https://github.com/plantinformatics/pretzel-data/raw/master/",
      datasetName = "myMap",
      datasetExt = ".json"
  var myMap, blocks
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

      // console.log("Delete myMap in db via LB from previous tests");
      // await Dataset.destroyById(datasetName)
      // .then(function(data) {
      //   console.log("Dataset deleted");
      //   console.log('data => ', data);
      // })
      // .catch(err => {
      //   console.log("Deleting dataset failed");
      //   console.log('err => ', err);
      // })

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
      // console.log("Delete previous dataset via REST");
      // await http
      //     .del(`${endpoint}/Datasets/${myMap.name}`)
      //     .set('Accept', 'application/json')
      //     .set('Authorization', userToken)
      //     .then(res => {
      //       console.log("Dataset deleted");
      //       console.log('res.body => ', res.body);
      //       console.log('res.status => ', res.status);
      //       // assert.equal(res.status, 200);
      //     })
      //     .catch(err => {
      //       console.log("Deleting dataset failed");
      //       console.log('err.status => ', err.status);
      //       console.log('err.text => ', err.text);
      //     })


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

      // console.log('myMap => ', myMap);
      // myMap.name = myMap.name+"1"

      // await console.log("Store data in db");
      // await http
      //   .post(`${endpoint}/Datasets`)
      //   .send(JSON.stringify(myMap))
      //   .set('Accept', 'application/json')
      //   .set('Content-Type', 'application/json')
      //   .set('Authorization', userToken)
      //   .then(res => {
      //     console.log('res.body => ', res.body);
      //   })

      // console.log('Dataset => ', Dataset);

      // console.log("Find myMap in db via LB");
      // await Dataset.find()
      // .then(function(data) {
      //   if (data) {
      //     console.log('data => ', data);
      //     // console.log("Deleting dataset");
      //     // return Dataset.destroyById(data.id)
      //   } else {
      //     console.log("MyMap not found");
      //     return null
      //   }
      // })


      // console.log("Find myMap in db via REST");
      // console.log('endpoint => ', endpoint);
      // await http
      //   .get(`${endpoint}/api/datasets/`)
      //   .query("filter", {include: 'blocks'})
      //   // .send(myMap)
      //   .set('Accept', 'application/json')
      //   .set('Content-Type', 'application/json')
      //   .set('Authorization', userToken)
      //   .then(res => {
      //     console.log('res.body => ', res.body);
      //     console.log('res.status => ', res.status);
      //     // assert.equal(res.status, 200);
      //   })
      //   .catch(err => {
      //     // console.log('err => ', err);
      //     console.log('err.status => ', err.status);
      //     console.log('err.message => ', err.message);
      //     console.log('err.text => ', err.text);
      //   })
      
      // let allDatasets = await http
      //   .get(`${endpoint}/Datasets`)
      //   .set('Accept', 'application/json')
      //   .set('Content-Type', 'application/json')
      //   .set('Authorization', userToken)

      // console.log('allDatasets => ', allDatasets.body);
      // console.log('allDatasets.status => ', allDatasets.status);

      // console.log("Create Dataset through Loopback");
      // await Dataset.create(myMap, (err, instance) => {
      //   if(err) console.log('err => ', err);
      //   console.log('created instance => ', instance);
      // })

      console.log("Create Dataset through REST");
      await http
        .post(`${endpoint}/datasets/upload`)
        .send({ data: myMap, fileName: datasetName + datasetExt})
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .then(res => {
          console.log("Dataset created");
          // console.log('res.body => ', res.body);
          console.log('res.status => ', res.status);
          // assert.equal(res.status, 200);
        })
        .catch(err => {
          console.log("Creating dataset failed");
          console.log('err => ', err.status);
          console.log('err => ', err);
        })

      console.log("Retrieve dataset to then be updated");
      let myMapObj = await http
        .get(`${endpoint}/datasets/${datasetName}`)
        // .send(myMapObj)
        .set('Accept', 'application/json')
        // .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .then(res => {
          console.log("Update completed");
          // console.log('res.body => ', res.body);
          console.log('res.status => ', res.status);
          return res.body
          // assert.equal(res.status, 200);
        })
        .catch(err => {
          console.log("Update failed");
          console.log('err => ', err.status);
          console.log('err => ', err);
        })

      console.log('myMapObj => ', myMapObj);

      myMapObj.public = true
      console.log("Update dataset to be public");
      await http
        .patch(`${endpoint}/datasets/${datasetName}`)
        .send(myMapObj)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .then(res => {
          console.log("Update completed");
          // console.log('res.body => ', res.body);
          console.log('res.status => ', res.status);
          // assert.equal(res.status, 200);
        })
        .catch(err => {
          console.log("Update failed");
          console.log('err => ', err.status);
          console.log('err => ', err);
        })

      console.log("Get Dataset Obj with blocks via REST");
      await http
        .get(`${endpoint}/datasets/${datasetName}`)
        .query("filter[include]=blocks")
        // .send(myMap)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .then(res => {
          console.log("Get blocks successful");
          // console.log('res.body => ', res.body);
          // console.log('res.status => ', res.status);
          // console.log('res.body.blocks => ', res.body.blocks);
          blocks = res.body.blocks
          // return res
          // assert.equal(res.status, 200);
        })
        .catch(err => {
          // console.log('err => ', err);
          console.log("Failed to get blocks");
          console.log('err.status => ', err.status);
          console.log('err.message => ', err.message);
          console.log('err.text => ', err.text);
        })



      // console.log("Get Dataset Obj created");
      // await Dataset.find({where: {_id: myMap.name}}, (err, instance) => {
      //   if(err) console.log('err => ', err.text);
      //   console.log('found instance => ', instance);
      // })

      // console.log("Get Dataset Obj with blocks");
      // await Dataset.findOne({where: {_id: myMap.name}, include: 'blocks'}, (err, instance) => {
      //   if(err) console.log('err => ', err.text);
      //   console.log('found one instance => ', instance);
      //   if(instance) {
      //     console.log('instance.blocks => ', instance.blocks);
      //   }
      //   // console.log('instance.blocks => ', instance.blocks());
      // })

      
      // where: {_id: myMap.name}, 
      // await Dataset.find({include: 'blocks'}, (err, instance) => {
      //   if(err) console.log('err => ', err);
      //   console.log('found many instance => ', instance[instance.length-1]);
      //   // console.log('instance.blocks => ', instance[0].blocks());
      // })


      // done()
    } catch(err) {
      // console.log('err => ', err);
    }
    
    // await http
    //   .post(`${endpoint}/Clients/`)
    //   .send({ email: userEmail, password: userPassword })
    //   .set('Accept', 'application/json')
    //   .set('Content-Type', 'application/json')
    //   .end(function(err, res) {
    //     if (err) { return done(err); }
    //     // assert.equal(res.status, 200);
    //     var body = res.body;
    //     console.log('BODY', body)
    //     // assert.exists(body);
    //     // assert.exists(body.id);
    //     userId = body.id; // assign for use later
    //     // assert.equal(body.email, userEmail);
    //     // assert.equal(body.code, 'EMAIL_NO_VERIFY');
    //     // done();
    //   }
    // );

  })

  after(async function() {
    console.log("After");

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

  it("Test Mocha", function(done) {
    // console.log('app.models => ', app.models);
    console.log("In test");
    assert.equal(true, true)
    done()
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