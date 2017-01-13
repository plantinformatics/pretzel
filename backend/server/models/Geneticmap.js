var mongoose = require('mongoose');

module.exports = new mongoose.Schema(
  {
    name: String
  }, {
    versionKey: false
  }
);
