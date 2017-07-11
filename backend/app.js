var join = require('path').join;
var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.json({limit: '200mb'}));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.set('json spaces', 2);

app.listen(process.env.PORT_EXT, function () {
  console.log('Example app listening on port 1776!')
})
