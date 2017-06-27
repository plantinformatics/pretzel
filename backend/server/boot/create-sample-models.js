'use strict';

var async = require('async');

module.exports = function(app) {
  // data sources
  var mongoDs = app.dataSources.mongoDs; // 'name' of your mongo connector, you can find it in datasource.json
  // var mysqlDs = app.dataSources.mysqlDs;
  var memoryDs = app.dataSources.db;
  // create all models
  async.parallel({
    // users: async.apply(createUsers),
    geneticmaps: async.apply(createGeneticmaps),
  }, function(err, results) {
    if (err) throw err;
    createChromosomes(results.geneticmaps, function(err) {
      console.log('> models created sucessfully');
    });
  });
  // create users
  // function createUsers(cb) {
  //   mongoDs.automigrate('Client', function(err) {
  //     if (err) return cb(err);
  //     var Client = app.models.Client;
  //     Client.create([{
  //       email: 'foo@bar.com',
  //       password: 'foobar',
  //     }, {
  //       email: 'john@doe.com',
  //       password: 'johndoe',
  //     }, {
  //       email: 'jane@doe.com',
  //       password: 'janedoe',
  //     }], cb);
  //   });
  // }
  // create coffee shops
  function createGeneticmaps(cb) {
    mongoDs.automigrate('Geneticmap', function(err) {
      if (err) return cb(err);
      var Geneticmap = app.models.Geneticmap;
      Geneticmap.create([{
        name: 'genetic map a',
        // prop: 'A',
      }, {
        name: 'genetic map b',
        // prop: 'B',
      }, {
        name: 'genetic map c',
        // prop: 'C',
      }], cb);
    });
    console.log('created geneticmap');
  }
  // create reviews
  function createChromosomes(geneticmaps, cb) {
    mongoDs.automigrate('Chromosome', function(err) {
      if (err) return cb(err);
      var Chromosome = app.models.Chromosome;
      Chromosome.create([{
        name: 'AAAAAAA',
        geneticmapId: geneticmaps[0].id,
      }, {
        name: 'BBBBBBB',
        geneticmapId: geneticmaps[0].id,
      }, {
        name: 'CCCCCCC',
        geneticmapId: geneticmaps[1].id,
      }, {
        name: 'DDDDDDD',
        geneticmapId: geneticmaps[2].id,
      }, {
          name: 'EEEEEEE',
          geneticmapId: geneticmaps[2].id,
      }], cb);
    });
    console.log('created geneticmap');
  }
};
