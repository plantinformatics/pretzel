const http = require('superagent')

const database = require('./database')
let app, endpoint, Client

module.exports = {
  initialise: function() {
    //variable not used
    let environment = require('./environment')

    process.env.AUTH = "ALL"
    process.env.EMAIL_VERIFY = "NONE"
    process.env.EMAIL_HOST = ""
    process.env.EMAIL_PORT = ""
    process.env.EMAIL_FROM = ""
    process.env.EMAIL_ADMIN = ""

    // scrubbing dependencies (if loaded)
    Object.keys(require.cache).forEach(function(key) { delete require.cache[key] })

    app = require('../../server/server')
    endpoint = require('./api').endpoint
    Client = app.models.Client

    return { endpoint }
  },
  login: async function() {
    if(!app) {
      throw Error("Run initialise first")
    }
    let userEmail = "test@test.com",
        userPassword = "test",
        userToken = null
        // not currently used, may be useful in other tests
        // userId = null 

    console.log("Delete test user from previous tests");
    await database.destroyUserByEmail(app.models, userEmail)

    console.log("Create test user");
    await Client.create({email: userEmail, password: userPassword}, (err, instance) => {
      console.log('instance => ', instance);
      // userId = instance.id
    })

    console.log("Login test user");
    return http
      .post(`${endpoint}/Clients/login`)
      .send({ email: userEmail, password: userPassword })
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .then(res => {
        // console.log('res.body => ', res.body);
        userToken = res.body.id
        console.log('userToken => ', userToken);
        return userToken
      })
  }

}
