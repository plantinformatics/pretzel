'use strict';

var mongoose = require('mongoose');

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
      console.log('TRANSFORM')
      console.log('doc', doc)
      console.log('ret', ret)
      console.log('options', options)
      ret.id = ret._id;
      if (ret.markers) {
        ret.markers.forEach( (marker) => {
          marker.id = marker._id;
          delete marker._id;
        })
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
var dbSources = require('../datasources.local.js')
// console.log(process.env)
// console.log('DBSOURCES', dbSources)
var dbMongo = dbSources.mongoDs 

var mongoString = `mongodb://${dbMongo.user}:${dbMongo.password}@${dbMongo.host}:${dbMongo.port}/${dbMongo.database}`
console.log(mongoString)
mongoose.connect(mongoString);



module.exports = function(app) {
  // Install a "/ping" route that returns "pong"
  var router = app.loopback.Router();
  router.get('/ping', function(req, res) {
    res.send('pongaroo');
  });


  router.get('/chromosomes/:id', function(req,res) {
    geneticmapModel.findOne({'chromosomes._id': req.params.id}).
    exec(
      function(err, map) {
        let ret = [];
        map.chromosomes.forEach((chr) => {
          if (chr._id == req.params.id) {
            ret = chr
          }
        })
        if (map[0]) {
          res.send({'chromosome': ret});
        }
        else {
          res.send({'chromosome': ret });
        }
    });
  });

  router.get('/geneticmaps', function(req,res) {
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

  router.get('/geneticmaps/:id', function(req,res) {
    // Get geneticmap by id.
    geneticmapModel.findById(req.params.id, function(err, map) {
      res.send({'geneticmap': map});
    });
  });

  router.get('/geneticmaps/:id/chromosomes/:chrid', function(req,res) {
    geneticmapModel.findById(req.params.id).
    select('chromosomes').
    where('chromosomes._id').equals(req.params.chrid).
    exec(
      function(err, map) {
        res.send(map);
    });
  });

  router.post('/geneticmaps', (req, res) => {
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

  app.use(router);
}













