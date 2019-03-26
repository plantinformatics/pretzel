var http = require('superagent')
var _ = require('lodash')

var endpoint = require('./api').endpoint

var download = function({ds}) {
  return http
    .get(ds.url + ds.path + ds.filename + ds.ext)
}
    // .then(res => {
    //   console.log("MyMap received");
    //   // console.log('res.data => ', res.data);
    //   // console.log('res.text => ', res.text);
    //   // return JSON.parse(res.text)
    //   return res.text
    // })
    // .catch(err => console.log('err.text => ', err.text))

var upload = async function({data, ds, userToken}) {
  console.log("Create Dataset through REST");
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
          // assert.equal(res.status, 200);
        })
        .catch(err => {
          console.log("Creating dataset failed");
          console.log('err => ', err.status);
          console.log('err => ', Object.keys(JSON.parse(err.response.error.text)));
        })

      console.log("Retrieve dataset to then be updated");
      let myMapObj = await http
        .get(`${endpoint}/datasets/${ds.name}`)
        // .send(myMapObj)
        .set('Accept', 'application/json')
        // .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .then(res => {
          console.log("Get completed");
          // console.log('res.body => ', res.body);
          console.log('res.status => ', res.status);
          return res.body
          // assert.equal(res.status, 200);
        })
        .catch(err => {
          console.log("Get failed");
          console.log('err => ', err.status);
          console.log('err => ', getErrMessage(err));
        })

      // console.log('myMapObj => ', myMapObj);

      myMapObj.public = true
      console.log("Update dataset to be public");
      return http
        .patch(`${endpoint}/datasets/${ds.name}`)
        .send(myMapObj)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
}

var getBlocks = function({name, userToken}) {
  console.log("Get Dataset Obj with blocks via REST");
  return http
    .get(`${endpoint}/datasets/${name}`)
    .query("filter[include]=blocks")
    // .send(myMap)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', userToken)
}

var setup = async function({ds, userToken}) {
  console.log("Setup dataset");
  console.log('ds.name => ', ds.name);
  let data = await download({ds})
    .then(res => res.text)
    .catch(err => {
      console.log("Downloading dataset failed");
      console.log('err.text => ', err.text);
    })
  await upload({data, ds, userToken})
    .then(() => console.log("Update completed"))
    .catch(err => {
      console.log("Update failed");
      console.log('err => ', err.status);
      console.log('err => ', getErrMessage(err));
    })
  return getBlocks({name: ds.name, userToken})
    // .then(res => {
    //   console.log("Successfully get blocks");
    //   return res.body.blocks
    // })
    // .catch(err => {
    //   // console.log('err => ', err);
    //   console.log("Failed to get blocks");
    //   console.log('err.status => ', err.status);
    //   console.log('err => ', getErrMessage(err));
    // })
  // return blocks
}

var del = function({name, userToken}) {
  console.log("Delete dataset via REST");
  return http
      .del(`${endpoint}/Datasets/${name}`)
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

function getErrMessage(err) {
  let temp = _.property("err.response.error.text")(err)
  console.log('temp => ', temp);
  if(!temp) {
    return err
  }
  let temp2 = _.property("error.message")(JSON.parse(temp))
  console.log('temp2 => ', temp2);
  return temp2
}
