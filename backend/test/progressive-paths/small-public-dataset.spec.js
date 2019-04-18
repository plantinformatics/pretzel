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
  path: "public_maps/json/",
  filename: "Wen_et_al_2017.fixed",
  name: "Wen_et_al_2017",
  ext: ".json"
}
var ds2 = {
  url: "https://github.com/plantinformatics/pretzel-data/raw/master/",
  path: "public_maps/json/",
  filename: "PBI-14-1406-s005.fixed",
  name: "PBI-14-1406-s005",
  ext: ".json"
}

var blocks = null,
    userToken = null

describe("Small public data tests", function() {
  this.slow(1500)
  // this.timeout(2000)
  this.timeout(30000)

  before(async function() {
    ({ endpoint } = testSetup.initialise())
    console.log('endpoint => ', endpoint);
    userToken = await testSetup.login()

    let promises = [ds, ds2].map(async d => dsHelper.setup({ds: d, userToken}))
    await Promise.all(promises).then(values => {
      console.log("Successfully get blocks");
      blocks = values.reduce((arr, res) => {
        // console.log('res => ', res);
        // console.log('res.body => ', res.body);
        // console.log('res.body.blocks => ', res.body.blocks);
        return arr.concat(res.body.blocks)
      }, [])
    })
    .catch(err => {
      console.log("Failed to get blocks");
      console.log('err.status => ', err.status);
      console.log('err => ', getErrMsg(err));
    })
  })

  after(async function() {
    let promises = [ds, ds2].map(async d => dsHelper.del({name: d.name, userToken}))
    await Promise.all(promises).then(res => {
        console.log("Datasets deleted");
        // console.log('res.body => ', res.body);
        console.log('res.status => ', res.status);
        // assert.equal(res.status, 200);
      })
      .catch(err => {
        console.log("Deleting dataset failed");
        console.log('err => ', getErrMsg(err));
      })
  })

  it("Run paths-progressive, simple", async function() {
    let features
    let blockId0 = dsHelper.findBlockId({blocks, name: ds.name, scope: '1B'}),
        blockId1 = dsHelper.findBlockId({blocks, name: ds2.name, scope: '1B'}),
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
      console.log('err => ', getErrMsg(err))
      // console.log('err.text.error => ', err.response.error.text.error);
    }

    assert.isArray(features)
    // console.log('features => ', features);
    console.log('features.length => ', features.length);
    assert.equal(features.length, 2292)

    let numPaths = dsHelper.calcNumPaths(features)
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

    let blockId0 = dsHelper.findBlockId({blocks, name: ds.name, scope: '1B'}),
        blockId1 = dsHelper.findBlockId({blocks, name: ds2.name, scope: '1B'}),
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
      console.log('err => ', getErrMsg(err))
    }

    assert.isArray(features)
    // Varies each time it's run, why does it vary?
    console.log('features.length => ', features.length);
    assert.equal(features.length, 1227)

    let numPaths = dsHelper.calcNumPaths(features)
    console.log('numPaths => ', numPaths);
    assert.equal(numPaths, 1227)
  })

  it("Run paths-progressive, restricted range, low threshold", async function() {
    // console.log("blocks in test", blocks);
    let features
    let blockId0 = dsHelper.findBlockId({blocks, name: ds.name, scope: '1B'}),
        blockId1 = dsHelper.findBlockId({blocks, name: ds2.name, scope: '1B'}),
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
      console.log('err => ', getErrMsg(err))
      // console.log('err.text.error => ', err.response.error.text.error);
    }

    assert.isArray(features)
    assert.equal(features.length, 6)

    let numPaths = dsHelper.calcNumPaths(features)
    assert.equal(numPaths, 6)
  })

  it("Run paths-progressive, restricted range, mid threshold", async function() {
    // console.log("blocks in test", blocks);
    let features
    let blockId0 = dsHelper.findBlockId({blocks, name: ds.name, scope: '1B'}),
        blockId1 = dsHelper.findBlockId({blocks, name: ds2.name, scope: '1B'}),
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
      console.log('err => ', getErrMsg(err))
      // console.log('err.text.error => ', err.response.error.text.error);
    }

    assert.isArray(features)
    assert.equal(features.length, 573)

    let numPaths = dsHelper.calcNumPaths(features)
    assert.equal(numPaths, 573)
  })

  it("Run paths-progressive, restricted range, high threshold", async function() {
    // console.log("blocks in test", blocks);
    let features
    let blockId0 = dsHelper.findBlockId({blocks, name: ds.name, scope: '1B'}),
        blockId1 = dsHelper.findBlockId({blocks, name: ds2.name, scope: '1B'}),
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
      console.log('err => ', getErrMsg(err))
      // console.log('err.text.error => ', err.response.error.text.error);
    }

    assert.isArray(features)
    assert.equal(features.length, 2292)

    let numPaths = dsHelper.calcNumPaths(features)
    assert.equal(numPaths, 2292)
  })

  it("Run paths-progressive, nSamples", async function() {
    // console.log("blocks in test", blocks);
    let features
    let blockId0 = dsHelper.findBlockId({blocks, name: ds.name, scope: '1B'}),
        blockId1 = dsHelper.findBlockId({blocks, name: ds2.name, scope: '1B'}),
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
      console.log('err => ', getErrMsg(err))
    }

    assert.isArray(features)
    assert.equal(features.length, 100)

    let numPaths = dsHelper.calcNumPaths(features)
    assert.equal(numPaths, 100)
  })

})