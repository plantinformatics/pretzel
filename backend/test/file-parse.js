// 'use strict';

// process.env.NODE_ENV = 'test';

// var assert = require('chai').assert;

// var load = require('../common/utilities/load')
// var upload = require('../common/utilities/upload')

// function destroyUserByEmail(email) {
//   // discover used by email, delete if present
//   var Client = app.models.Client;
//   return Client.findOne({where: {email: email}})
//   .then(function(data) {
//     if (data) {
//       return Client.destroyById(data.id)
//     } else {
//       return null
//     }
//   })
// }

// describe('GZIP Files', function() {
//   var server;

//   var files = [
//     // '../resources/90k_consensus.json.gz',
//     '../resources/NIAB_8wMAGIC.json.gz'
//   ]

//   before(function(done) {
//     done()
//   });

//   after(function(done) {
//     done()
//   });

//   files.forEach(function (file, idx) {
//     it(`should load GZIP ${file}`, function(done) {

//       this.timeout(30000)

//       load.file(file)
//         .then(function(data) {
//           assert.ok(data instanceof Buffer)
//           return load.gzip(data)
//         })
//         .then(function(data) {
//           assert.ok(data instanceof Object)
//           assert.hasAllKeys(data, ['geneticmap']);
//           assert.hasAllKeys(data.geneticmap, ['chromosomes', 'name']);
//           assert.isArray(data.geneticmap.chromosomes);
//           done()
//         })
//         .catch(function(err) {
//           done(err);
//         })
//     });
//   });

// });