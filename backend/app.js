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

var geneticmapSchema = new mongoose.Schema({
  name: String,
  chromosomes: [
    {
      _id: false,
      name: String,
      markers: [
        {
          _id: false,
          name: String,
          position: Number
        }
      ]
    }
  ]
});

var geneticmapModel = mongoose.model('geneticmap', geneticmapSchema);

mongoose.connect('mongodb://localhost/test');

app.get('/geneticmaps', function(req,res) {
  console.log('Accessed /geneticmaps!');
  geneticmapModel.find({},function(err,docs) {
    if(err) {
      res.send(err);
    }
    else {
      res.send(docs);
    }
  });
});


app.listen(1776, function () {
  console.log('Example app listening on port 1776!')
})
