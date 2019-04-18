'use strict';

const assert = require('chai').assert
const http = require('superagent')
const qs = require('qs')
const _ = require('lodash')

const testSetup = require('../helpers/test-setup')
const dsHelper = require('../helpers/dataset')
const getErrMsg = dsHelper.getErrMsg
let endpoint

var ds = {
  url: "https://github.com/plantinformatics/pretzel-data/raw/master/",
  path: "",
  filename: "myMap",
  name: "myMap",
  ext: ".json"
}

var blocks = null,
    userToken = null

describe("MyMap tests", function() {
  this.slow(1000)
  // this.timeout(1500)
  this.timeout(20000)

  before(async function() {
    ({ endpoint } = testSetup.initialise())
    console.log('endpoint => ', endpoint);
    userToken = await testSetup.login()
    blocks = await dsHelper.setup({ds, userToken})
    .then(res => {
      console.log("Successfully get blocks");
      return res.body.blocks
    })
    .catch(err => {
      // console.log('err => ', err);
      console.log("Failed to get blocks");
      console.log('err.status => ', err.status);
      console.log('err => ', getErrMsg(err));
    })
  })

  after(async function() {
    await dsHelper.del({name: ds.name, userToken})
      .then(res => {
        console.log("Dataset deleted");
        console.log('res.status => ', res.status);
      })
      .catch(err => {
        console.log("Deleting dataset failed");
        console.log('err.status => ', err.status);
        console.log("err => ", getErrMsg(err));
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
      console.log('err => ', getErrMsg(err))
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
      console.log('err.status => ', err.status);
      console.log('err => ', getErrMsg(err))
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
      console.log('err.status => ', err.status);
      console.log('err => ', getErrMsg(err))
    }

    console.log('features => ', features);
    assert.isArray(features)
    assert.equal(features.length, 0)
  })
})