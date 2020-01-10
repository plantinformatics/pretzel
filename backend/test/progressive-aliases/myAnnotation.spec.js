'use strict';

const assert = require('chai').assert
const http = require('superagent')
const qs = require('qs')
const _ = require('lodash')

const testSetup = require('../helpers/test-setup')
const dsHelper = require('../helpers/dataset')
const getErrMsg = dsHelper.getErrMsg
let endpoint

var files = [],
file1 = {
  url: "https://github.com/plantinformatics/pretzel-data/raw/master/",
  path: "",
  filename: "myDataset",
  name: "myGenome",
  ext: ".json"
}, 
file2 = {
  url: "https://github.com/plantinformatics/pretzel-data/raw/master/",
  path: "",
  filename: "myAnnotation",
  name: "myAnnotation",
  ext: ".json"
},
file3 = {
  url: "https://github.com/plantinformatics/pretzel-data/raw/master/",
  path: "",
  filename: "aliases",
  name: "",
  ext: ".json"
}

var blocks = null,
    userToken = null

describe("MyAnnotation Aliases tests", function() {
  this.slow(1500)
  // this.timeout(1500)
  this.timeout(20000)

  before(async function() {
    ({ endpoint } = testSetup.initialise())
    console.log('endpoint => ', endpoint);
    userToken = await testSetup.login()
    
    // download datafiles
    let promises = [file1, file2, file3].map(
      async d => dsHelper.download({ds: d, userToken})
    )
    await Promise.all(promises).then(data => {
      console.log("Files downloaded");
      // console.log('data => ', data);
      files = data.map(d => JSON.parse(d.text))
    })
    .catch(err => {
      console.log("Downloading files failed");
      console.log('err.status => ', err.status);
      console.log('err => ', getErrMsg(err));
    })

    // console.log('files => ', files);

    await dsHelper.createComplete({data: files[0], userToken})
    .then(data => dsHelper.makePublic({name: file1.name, userToken}))
    .then(() => console.log("Genome upload completed"))
    .catch(err => {
      console.log("Genome upload failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMsg(err));
      throw err
    })

    await dsHelper.createComplete({data: files[1], userToken})
    .then(data => dsHelper.makePublic({name: file2.name, userToken}))
    .then(() => console.log("Annotations upload completed"))
    .catch(err => {
      console.log("Annotations upload failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMsg(err));
      throw err
    })

    dsHelper.aliases({data: files[2], userToken})
    .then(() => console.log("Aliases upload completed"))
    .catch(err => {
      console.log("Aliases upload failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMsg(err));
      throw err
    })
  })

  after(async function() {
    // Delete aliases first, no API call currently for that

    // Delete datasets
    let promises = [file1, file2].map(
      async d => dsHelper.del({name: d.name, userToken})
    )
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

  it("Test Mocha", function(done) {
    // console.log('app.models => ', app.models);
    console.log("In test");
    assert.equal(true, true)
    done()
  })

  // it("'MyMap3' exists", async function() {
  //   // console.log('myMap2 => ', myMap);
  //   // console.log('myMap.name => ', myMap.name);
  //   await http
  //     .get(`${endpoint}/Datasets/test_pzl_${ds.name}`)
  //     .set('Accept', 'application/json')
  //     .set('Authorization', userToken)
  //     .then(res => {
  //       // console.log('test res.body => ', res.body);
  //       assert.equal(res.status, 200);
  //     })
  // })
})