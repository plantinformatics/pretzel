var join = require('path').join;
var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.json({limit: '10mb'}));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.set('json spaces', 2);

var chromosomeSchema = new mongoose.Schema({
  name: String,
  markers: [
    {
      name: String,
      position: Number
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

mongoose.connect('mongodb://localhost/test');

app.get('/chromosomes/:id', function(req,res) {
  geneticmapModel.find({}).
  select('chromosomes').
  where('chromosomes._id').equals(req.params.id).
  exec(
    function(err, map) {
      if (map[0]) {
        res.send({'chromosome': map[0].chromosomes[0]});
      }
      else {
        res.send({'chromosome': [] });
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

app.listen(1776, function () {
  console.log('Example app listening on port 1776!')
})
