'use strict';

const assert = require('chai').assert
const http = require('superagent')
const qs = require('qs')
const _ = require('lodash')

const testSetup = require('../helpers/test-setup')
const dsHelper = require('../helpers/dataset')
const getErrMsg = dsHelper.getErrMsg
const load = require('../../common/utilities/load')
let endpoint

var ds = {
  path: './test/testdata/',
  name: 'Triticum_aestivum_IWGSC_RefSeq_v1.0',
  ext: '.json'
}

var blocks = null,
    userToken = null

var response

describe("Large public datasets", function() {
  this.slow(2000)
  // this.timeout(3000)
  this.timeout(90000)

  before(async function() {
    ({ endpoint } = testSetup.initialise())
    console.log('endpoint => ', endpoint);
    userToken = await testSetup.login()

    await load.fileJson(ds.path + ds.name + '_genome.json')
    .then(data => {
      // console.log('data => ', data);
      return dsHelper.createComplete({data, userToken})
    })
    .then(data => dsHelper.makePublic({name: ds.name, userToken}))
    .then(() => console.log("Genome upload completed"))
    .catch(err => {
      console.log("Genome upload failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMsg(err));
      throw err
    })

    await load.fileGzip(ds.path + ds.name + '_HC_annotation.json.gz')
    .then(data => {
      // console.log('data2 => ', data);
      return dsHelper.createComplete({data, userToken})
    })
    .then(() => dsHelper.makePublic({name: ds.name + '_HC_genes', userToken}))
    .then(() => console.log("Annotations upload completed"))
    .catch(err => {
      console.log("Annotations upload failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMsg(err));
      throw err
    })

    await load.fileGzip(ds.path + ds.name + '_HC_VS_' + ds.name + '_HC_aliases.json.gz')
    .then(data => {
      // console.log('data3 => ', data);
      return dsHelper.aliases({data, userToken})
    })
    .then(() => console.log("Aliases upload completed"))
    .catch(err => {
      console.log("Aliases upload failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMsg(err));
      throw err
    })
  })

  after(async function() {
    await dsHelper.del({name: ds.name, userToken})
    .then(res => {
      console.log("Dataset deleted");
      console.log('res.status => ', res.status);
      return dsHelper.del({name: ds.name + '_HC_genes', userToken})
    })
    .then(res => {
      console.log("Dataset deleted");
      console.log('res.status => ', res.status);
      // return delete Aliases
    })
    // .then(res => {
    // })
    .catch(err => {
      console.log("Deleting dataset failed");
      console.log('err.status => ', err.status);
      console.log("err => ", getErrMsg(err));
    })
  })

  it("Run fake test", function(done) {
      // console.log('app.models => ', app.models);
      console.log("In test");
      assert.equal(true, true)
      done()
    })

})