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
  path: "public/",
  filename: "Triticum_aestivum_IWGSC_RefSeq_v1.0_90k-markers.meta.1ab",
  name: "Triticum_aestivum_IWGSC_RefSeq_v1.0_90k_markers",
  ext: ".json"
}

var blocks = null,
    userToken = null

var response

describe("90k markers, no aliases", function() {
  this.slow(1800)
  // this.timeout(3000)
  this.timeout(60000)

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
      console.log('err => ', getErrMsg(err))
      // console.log('err.text.error => ', err.response.error.text.error);
    }

    assert.isArray(features)
    console.log('features.length => ', features.length);
    assert.equal(features.length, 5071)

    let numPaths = dsHelper.calcNumPaths(features)
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
      console.log('err => ', getErrMsg(err))
      // console.log('err.text.error => ', err.response.error.text.error);
    }

    assert.isArray(features)
    console.log('features.length => ', features.length);
    assert.equal(features.length, 68)

    let numPaths = dsHelper.calcNumPaths(features)
    console.log('numPaths => ', numPaths);
    assert.equal(numPaths, 83)

  })

})