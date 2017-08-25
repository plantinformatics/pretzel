'use strict';

var upload = require('../utilities/upload')
var load = require('../utilities/load')

module.exports = function(Geneticmap) {
  // Geneticmap.afterRemote('find', function(ctx, output, next) {
  //   // console.log('> Geneticmap.find triggered');
  //   // console.log(output)
  //   ctx.result = {
  //     'geneticmaps': ctx.result
  //   };
  //   // console.log('next')
  //   next()
  // })

  Geneticmap.upload = function(msg, cb) {
    var models = this.app.models;
    if (msg.fileName.endsWith('.json')) {
      try {
      var jsonMap = JSON.parse(msg.data);
      } catch(e) {
        console.log(e);
        cb(Error("Failed to parse JSON"));
      }
      upload.json(jsonMap, models)
      .then(function(data) {
        cb(null, 'Success');
      })
      .catch(function(err) {
        console.log(err);
        cb(err);
      })
    } else if (msg.fileName.endsWith('.gz')) {
      var buffer = new Buffer(msg.data, 'binary');
      load.gzip(buffer).then(function(json) {
        jsonMap = json;
        upload.json(jsonMap, models)
        .then(function(data) {
          cb(null, 'Success');
        })
        .catch(function(err) {
          console.log(err);
          cb(err);
        })
      })
      .catch(function(err) {
        console.log(err);
        cb(Error("Failed to read gz file"));
      })
    } else {
      cb(Error('Unsupported file type'));
    }
  }

  Geneticmap.remoteMethod('upload', {
        accepts: [
          {arg: 'msg', type: 'object', required: true, http: {source: 'body'}}
        ],
        returns: {arg: 'status', type: 'string'},
        description: "Perform a bulk upload of a genetic map with associated chromosomes and markers"
  });
};

// NOTES
// the 'scope' property in the associated json file allows us to add in the
// relation to chromosomes. If this property is not added, then all we will receive
// is the high-level geneticmap info, and will have to perform another call to gather
// the chromosome info. While this is suitable in the short-term, in the long-term
// this may need to be changed if the number of chromosomes is high for the geneticmaps
// in aggregate