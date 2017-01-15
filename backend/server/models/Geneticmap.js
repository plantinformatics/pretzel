var mongoose = require('mongoose');

module.exports = new mongoose.Schema(
  {
    name: String,
    chromosomes: [
      {
        name: String,
        markers: [
          {
            name: String,
            position: Number
          }
        ]
      }
    ]
  }, {
    versionKey: false
  }
);
