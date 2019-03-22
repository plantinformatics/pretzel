var http = require('superagent')
var endpoint = require('./api').endpoint

exports.upload = async function({dataset, name, ext, userToken}) {
  console.log("Create Dataset through REST");
      await http
        .post(`${endpoint}/datasets/upload`)
        .send({ data: dataset, fileName: name + ext})
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
          console.log('err => ', err);
        })

      console.log("Retrieve dataset to then be updated");
      let myMapObj = await http
        .get(`${endpoint}/datasets/${name}`)
        // .send(myMapObj)
        .set('Accept', 'application/json')
        // .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
        .then(res => {
          console.log("Update completed");
          // console.log('res.body => ', res.body);
          console.log('res.status => ', res.status);
          return res.body
          // assert.equal(res.status, 200);
        })
        .catch(err => {
          console.log("Update failed");
          console.log('err => ', err.status);
          console.log('err => ', err);
        })

      // console.log('myMapObj => ', myMapObj);

      myMapObj.public = true
      console.log("Update dataset to be public");
      return http
        .patch(`${endpoint}/datasets/${name}`)
        .send(myMapObj)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .set('Authorization', userToken)
}

exports.getBlocks = function({name, userToken}) {
  console.log("Get Dataset Obj with blocks via REST");
  return http
    .get(`${endpoint}/datasets/${name}`)
    .query("filter[include]=blocks")
    // .send(myMap)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', userToken)
}