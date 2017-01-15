var join = require('path').join;
var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var db = require('mongoose').createConnection('mongodb://localhost/test');
var em = require('ember-mongoose');
var app = express();

app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// build api

em()
  .models(db, join(__dirname, 'server/models'))
  .fields(join(__dirname, 'server/api_fields'))
  .hooks(join(__dirname, 'server/api_hooks'))
  .discover(app);

app.get('/', function (req, res) {
  res.send('Hello World!')
})


app.listen(1776, function () {
  console.log('Example app listening on port 1776!')
})
