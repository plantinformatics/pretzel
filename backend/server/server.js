'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');
var morgan = require('morgan');
var mongoose = require('mongoose');

var app = module.exports = loopback();

app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

app.use('/express-status', function (req, res, next) {
    res.json({ running: true });
});

app.use(morgan('combined'))

// INHERITED FROM EXISTING CODE
// REQUIRES AMALGAMATION INTO LOOPBACK STRUCTURE

var chromosomeSchema = new mongoose.Schema({
  name: String,
  markers: [
    {
      //_id: false,
      name: String,
      position: Number,
      aliases: {type: [String], default: []}
    }
  ]
},
{
  toJSON: {
    transform: function (doc, ret, options) {
      ret.id = ret._id;
      if (ret.markers) {
        for (marker of ret.markers) {
          marker.id = marker._id;
          delete marker._id;
        }
      }
      delete ret._id;
    }
  }
});

var geneticmapSchema = new mongoose.Schema({
  name: String,
  chromosomes: [ chromosomeSchema ]
},
{
  toJSON: {
    transform: function (doc, ret, options) {
      // remove the _id of every document before returning the result
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
    }
  }
});

var geneticmapModel = mongoose.model('geneticmap', geneticmapSchema);

// TODO formalise data structures under loopback to avoid duplicate
// connection and some code below
var dbSources = require('./datasources.json')
var dbMongo = dbSources.mongoDs 

var mongoString = `mongodb://${dbMongo.user}:${dbMongo.password}@${dbMongo.host}:${dbMongo.port}/${dbMongo.database}`
console.log(mongoString)
mongoose.connect(mongoString);

app.get('/chromosomes/:id', function(req,res) {
  geneticmapModel.findOne({'chromosomes._id': req.params.id}).
  exec(
    function(err, map) {
      let ret = [];
      for (chr of map.chromosomes) {
        if (chr._id == req.params.id) {
          ret = chr
        }
      }
      if (map[0]) {
        res.send({'chromosome': ret});
      }
      else {
        res.send({'chromosome': ret });
      }
  });
});

app.get('/geneticmaps', function(req,res) {
  // Get all geneticmaps.
  geneticmapModel.find({}).
  // Select map name, as well as chromosome names and ids.
  select('name chromosomes.name chromosomes._id').
  exec(
    function(err,docs) {
    if(err) {
      res.send(err);
    }
    else {
      res.send({'geneticmaps': docs});
    }
  });
});

app.get('/geneticmaps/:id', function(req,res) {
  // Get geneticmap by id.
  geneticmapModel.findById(req.params.id, function(err, map) {
    res.send({'geneticmap': map});
  });
});

app.get('/geneticmaps/:id/chromosomes/:chrid', function(req,res) {
  geneticmapModel.findById(req.params.id).
  select('chromosomes').
  where('chromosomes._id').equals(req.params.chrid).
  exec(
    function(err, map) {
      res.send(map);
  });
});

app.post('/geneticmaps', (req, res) => {
  var name = req.body.geneticmap.name;
  var chromosomes = req.body.geneticmap.chromosomes;
  geneticmapModel.create({
    name: name,
    chromosomes: chromosomes
  }, function (err, geneticmap) {
    if (err) {
      res.send("Error");
    }
    else {
      console.log("Created new geneticmap");
      res.format({
        json: function() { res.json(geneticmap) }
      });
    }
  });
});

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
