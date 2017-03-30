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

var geneticmapSchema = new mongoose.Schema({
  name: String,
  chromosomes: [
    {
      //_id: false,
      name: String,
      markers: [
        {
          //_id: false,
          name: String,
          position: Number,
          aliases: {type: [String], default: []}
        }
      ]
    }
  ]
},
{
  toJSON: {
    transform: function (doc, ret, options) {
      // remove the _id of every document before returning the result
      ret.id = ret._id;
      if (ret.chromosomes) {
        for (chr of ret.chromosomes) {
          chr.id = chr._id;
          delete chr._id;
          for (marker of chr.markers) {
            marker.id = marker._id;
            delete marker._id;
          }
        }
      }
      delete ret._id;
      delete ret.__v;
    }
  }
});

var geneticmapModel = mongoose.model('geneticmap', geneticmapSchema);

mongoose.connect('mongodb://localhost/test');

app.get('/geneticmaps', function(req,res) {
  // Get all geneticmaps.
  geneticmapModel.find({}).
  select({ name: 1 }). // Only keep name.
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
