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
      console.log('err => ', getErrMsg(err))
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
    
    // Set response to compare in next test, only if this test passes
    response = features
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
      console.log('err => ', getErrMsg(err))
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
      console.log('err => ', getErrMsg(err))
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

    let numPaths = dsHelper.calcNumPaths(features)

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
      console.log('err => ', getErrMsg(err))
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