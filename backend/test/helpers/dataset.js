var http = require('superagent')
var _ = require('lodash')

var endpoint = require('./api').endpoint

let PREFIX = "test_pzl_"

var download = function({ds}) {
  return http
    .get(ds.url + ds.path + ds.filename + ds.ext)
}

var upload = async function({data, ds, userToken}) {
  console.log("Create Dataset through REST");
  let obj = JSON.parse(data)
  obj.name = getName(obj.name)
  // console.log('obj.name => ', obj.name);
  // console.log('obj.blocks => ', obj.blocks);
  data = JSON.stringify(obj)
  await http
    .post(`${endpoint}/datasets/upload`)
    .send({ data, fileName: ds.filename + ds.ext})
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', userToken)
    .then(res => {
      console.log("Dataset created");
      // console.log('res.body => ', res.body);
      console.log('res.status => ', res.status);
    })
    .catch(err => {
      console.log("Creating dataset failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMessage(err));
    })

  console.log("Retrieve dataset to then be updated");
  // console.log('ds.name => ', ds.name);
  let dataset = await http
    .get(`${endpoint}/datasets/${getName(ds.name)}`)
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
      console.log('err => ', getErrMessage(err));
    })

  // console.log('myMapObj => ', myMapObj);

  dataset.public = true
  console.log("Update dataset to be public");
  return http
    .patch(`${endpoint}/datasets/${getName(ds.name)}`)
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
    })
  await upload({data, ds, userToken})
    .then(() => console.log("Upload completed"))
    .catch(err => {
      console.log("Upload failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMessage(err));
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

module.exports = {
  download,
  upload,
  getBlocks,
  setup,
  del
}

function getName(name) {
  return PREFIX + name
}

function getErrMessage(err) {
  // console.log("keys", Object.keys(JSON.parse(err.response.error.text)))
  let temp = _.property("response.error.text")(err)
  // console.log('temp => ', temp);
  if(!temp) {
    return err
  }
  let temp2 = _.property("error.message")(JSON.parse(temp))
  return temp2
}
