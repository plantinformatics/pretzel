var http = require('superagent')
var _ = require('lodash')

var environment = require('./environment')
var endpoint = require('./api').endpoint

let PREFIX = "test_pzl_"

var download = function({ds}) {
  return http
    .get(ds.url + ds.path + ds.filename + ds.ext)
}

var createComplete = async function({data, userToken}) {
  console.log("createComplete through REST");
  data.name = getName(data.name)
  data.parent = getName(data.parent)
  // may also need fancy footwork to edit namespaces in each block
  return http
    .post(`${endpoint}/datasets/createComplete`)
    .send(data)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', userToken)
}

var aliases = async function({data, userToken}) {
  console.log("Upload aliases REST");
  let testData = data.map(d => {
    d.namespace1 = PREFIX + d.namespace1.replace(/:/, ":" + PREFIX)
    d.namespace2 = PREFIX + d.namespace2.replace(/:/, ":" + PREFIX)
    return d
  })
  // console.log('testData[0], testData[1] => ', testData[0], testData[1]);
  return http
    .post(`${endpoint}/aliases/bulkCreate`)
    .send(testData)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', userToken)
}

var upload = async function({data, ds, userToken}) {
  console.log("Create Dataset through REST");
  let obj = JSON.parse(data)
  obj.name = getName(obj.name)
  // console.log('obj.name => ', obj.name);
  // console.log('obj.blocks => ', obj.blocks);
  data = JSON.stringify(obj)
  return http
    .post(`${endpoint}/datasets/upload`)
    .send({ data, fileName: ds.filename + ds.ext})
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', userToken)
}

var makePublic = async function ({name, userToken}) {
  console.log("Retrieve dataset to then be updated");
  // console.log('ds.name => ', ds.name);
  let dataset = await http
    .get(`${endpoint}/datasets/${getName(name)}`)
    .set('Accept', 'application/json')
    // .set('Content-Type', 'application/json')
    .set('Authorization', userToken)
    .then(res => {
      console.log("Get completed");
      // console.log('res.body => ', res.body);
      console.log('res.status => ', res.status);
      return res.body
    })
    .catch(err => {
      console.log("Get failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMsg(err));
      throw err
    })

  // console.log('myMapObj => ', myMapObj);
  dataset.public = true
  console.log("Update dataset to be public");
  return http
    .patch(`${endpoint}/datasets/${getName(name)}`)
    .send(dataset)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', userToken)
}

var getBlocks = function({name, userToken}) {
  console.log("Get Dataset Obj with blocks via REST");
  return http
    .get(`${endpoint}/datasets/${getName(name)}`)
    .query("filter[include]=blocks")
    // .send(myMap)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', userToken)
}

var setup = async function({ds, userToken}) {
  console.log("Setup dataset");
  // console.log('ds.name => ', getName(ds.name));
  let data = await download({ds})
    .then(res => res.text)
    .catch(err => {
      console.log("Downloading dataset failed");
      console.log('err.text => ', err.text);
      console.log('err.status => ', err.status);
      throw err
    })
  await upload({data, ds, userToken})
    .then(res => {
      console.log("Dataset created");
      // console.log('res.body => ', res.body);
      console.log('res.status => ', res.status);
    })
    .catch(err => {
      console.log("Creating dataset failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMsg(err));
      throw err
    })
  await makePublic({name: ds.name, userToken})
    .then(() => console.log("Make public completed"))
    .catch(err => {
      console.log("Make public failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMsg(err));
      throw err
    })
  return getBlocks({name: ds.name, userToken})
}

var del = function({name, userToken}) {
  console.log("Delete dataset via REST");
  return http
      .del(`${endpoint}/Datasets/${getName(name)}`)
      .set('Accept', 'application/json')
      .set('Authorization', userToken)

}

function getName(name) {
  return PREFIX + name
}

function getErrMsg(err) {
  // console.log("keys", Object.keys(JSON.parse(err.response.error.text)))
  let temp = _.property("response.error.text")(err)
  // console.log('temp => ', temp);
  if(!temp) {
    return err
  }
  let temp2 = _.property("error.message")(JSON.parse(temp))
  return temp2
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

// Finds a block within a collection with a given dataset name and scope
// Returns blockId if found, undefined if block isn't found 
// or undefined if id is undefined
function findBlockId({blocks, name, scope}) {
  let block = blocks.find(b => {
    return b.name === scope &&
           b.datasetId === getName(name)
  })
  if(block)
    return block.id
}

module.exports = {
  download,
  createComplete,
  aliases,
  upload,
  makePublic,
  getBlocks,
  setup,
  del,
  getName,
  getErrMsg,
  calcNumPaths,
  findBlockId
}