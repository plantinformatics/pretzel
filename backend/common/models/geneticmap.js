'use strict';

var upload = require('../utilities/upload')

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
    upload.json(msg, this.app.models)
    .then(function(data) {
      // completed additions to database
      cb(null, 'Success');
    })
    .catch(function(err) {
      console.log('ERROR', err)
      cb(err);
    })
  }

  Geneticmap.remoteMethod('upload', {
        accepts: { arg: 'data', type: 'object', http: { source: 'body' } },
        returns: {arg: 'greeting', type: 'string'},
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