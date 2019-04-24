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
  filename: "myMap3",
  name: "myMap3",
  ext: ".json"
}

var blocks = null,
    userToken = null

var response

describe("MyMap3 tests", function() {
  this.slow(1500)
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
  })

  it("'MyMap3' exists", async function() {
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

  it("Run block-feature-intervals, simple", async function() {
    // console.log("blocks in test", blocks);
    let features
    let blockId = blocks[0].id,
        intervals = {
          axes: [ {
            domain: [0, 100],
            range: 400
          }],
          page: {
            thresholdFactor: 1e5
          },
          dbPathFilter: true
        }

    try {
      console.log('blockId => ', blockId);
      // console.log('intervals => ', intervals);

      await http
        .get(`${endpoint}/Blocks/blockFeaturesInterval`)
        .query(qs.stringify({ blocks: [blockId] }))
        .query(qs.stringify({ intervals }))
        .set('Authorization', userToken)
        .then(res => {
          assert.equal(res.status, 200)
          
          features = res.body
          // console.log('features => ', features);
        })
    }
    catch(err) {
      console.log('err.status => ', err.status);
      console.log('err => ', getErrMsg(err))
    }

    assert.isArray(features)
    assert.equal(features.length, 4)

    let marker = features[0]
    assert.containsAllKeys(marker, ["_id"])
    assert.deepInclude(marker,
      {
        name: "myMarkerA",
        value: [0, 0],
        parentId: null,
        blockId: blockId
      }
    )

    // set object to compare for next test, only if this test passes
    response = features
  })

  it("Run paths-progressive, dbPathFilter false", async function() {
    let features
    let blockId = blocks[0].id,
        intervals = {
          axes: [ {
            domain: [0, 100],
            range: 400
          }],
          page: {
            thresholdFactor: 1e5
          },
          dbPathFilter: false
        }

    try {
      console.log('blockId => ', blockId);
      // console.log('intervals => ', intervals);

      await http
        .get(`${endpoint}/Blocks/blockFeaturesInterval`)
        .query(qs.stringify({ blocks: [blockId] }))
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
      console.log('err => ', getErrMsg(err))
      // console.log('err.text.error => ', err.response.error.text.error);
    }

    assert.isArray(features)
    assert.deepEqual(response, features)
  })

  it("Run block-feature-intervals, restricted domain", async function() {
    // console.log("blocks in test", blocks);
    let features
    let blockId = blocks[0].id,
        intervals = {
          axes: [ {
            domain: [4, 60],
            range: 400
          }],
          page: {
            thresholdFactor: 1e5
          },
          dbPathFilter: true
        }

    try {
      console.log('blockId => ', blockId);
      // console.log('intervals => ', intervals);

      await http
        .get(`${endpoint}/Blocks/blockFeaturesInterval`)
        .query(qs.stringify({ blocks: [blockId] }))
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
      console.log('err => ', getErrMsg(err))
      // console.log('err.text.error => ', err.response.error.text.error);
    }

    assert.isArray(features)
    assert.equal(features.length, 2)
  })
})