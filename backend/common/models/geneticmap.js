'use strict';

var _ = require('lodash')

var acl = require('../utilities/acl')
var identity = require('../utilities/identity')
var upload = require('../utilities/upload')
var load = require('../utilities/load')

module.exports = function(Geneticmap) {

  Geneticmap.observe('access', function(ctx, next) {
    console.log('> Geneticmap.access');
    // identity.queryFilterAccessible(ctx)
    next()
  })

  Geneticmap.afterRemote('find', function(ctx, modelInstance, next) {
    console.log('> Geneticmap.loaded');
    next()
  })

  // var rules = [
  //   {
  //     'accessType': '*',
  //     'principalType': 'ROLE',
  //     'principalId': '$everyone',
  //     'permission': 'DENY',
  //   },
  //   {
  //     'accessType': '*',
  //     'principalType': 'ROLE',
  //     'principalId': '$owner',
  //     'permission': 'ALLOW',
  //   },
  //   {
  //     'accessType': 'READ',
  //     'principalType': 'ROLE',
  //     'principalId': 'public',
  //     'permission': 'ALLOW',
  //   }
  // ];
  // acl.assign(Geneticmap, rules);

  Geneticmap.observe('before save', function(ctx, next) {
    if (ctx.instance) {
      var newDate = Date.now();  
      // ctx.instance.createdAt = newDate;
      // ctx.Model.updatedAt = newDate;

      let clientId = identity.gatherClientId(ctx)
      if (clientId) {
        ctx.instance.clientId = clientId
      }
    }
    next();
  });

  Geneticmap.upload = function(msg, cb) {
    var models = this.app.models;
    if (msg.fileName.endsWith('.json')) {
      try {
      var jsonMap = JSON.parse(msg.data);
      } catch (e) {
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

  Geneticmap.tableUpload = function(data, options, cb) {
    let clientId = identity.gatherClientId(options)

    var models = this.app.models;
    var chromosomes = {};
    var genMap = null;
    var chromosomes_by_name = [];
    var existing_chromosomes = [];

    models.Geneticmap.findById(data.geneticmap_id, {include: "chromosomes"}, options)
    .then(function(map) {
      if (map) {
        genMap = map;
        data.markers.forEach(function(marker) {
          chromosomes[marker.chrom] = false;
        });
        map.chromosomes().forEach(function(chrom) {
          if (chrom.name in chromosomes) {
            chromosomes[chrom.name] = true;
            existing_chromosomes.push(chrom.id);
            chromosomes_by_name[chrom.name] = chrom.id;
          }
        });
        // delete old markers
        return models.Marker.deleteAll({chromosomeId: {inq: existing_chromosomes}}, options)
      } else {
        cb(Error("Geneticmap not found"));
      }
    })
    .then(function(deleted_markers) {
      return models.Chromosome.updateAll({id: {inq: existing_chromosomes}}, {updatedAt: new Date()}, options)
    }).then(function(updated_chromosomes) {
      var new_chromosomes = [];
      Object.keys(chromosomes).forEach(function(name) {
        if (chromosomes[name] === false) {
          let payload = {
            name: name,
            geneticmapId: genMap.id
          }
          if (clientId) {
            payload['clientId'] = clientId
          }
          new_chromosomes.push(payload);
        }
      });
      // create new chromosomes
      return models.Chromosome.create(new_chromosomes);
    })
    .then(function(new_chromosomes) {
      new_chromosomes.forEach(function(chrom) {
        chromosomes_by_name[chrom.name] = chrom.id;
      });
      var array_markers = [];
      data.markers.forEach(function(marker) {
        array_markers.push({name: marker.name, position: marker.pos, chromosomeId: chromosomes_by_name[marker.chrom], aliases: []});
      });
      // create new markers
      return models.Marker.create(array_markers);
    })
    .then(function(new_markers) {
      cb(null, "Successfully uploaded " + new_markers.length + " markers");
    });
  }

  Geneticmap.remoteMethod('upload', {
    accepts: [
      {arg: 'msg', type: 'object', required: true, http: {source: 'body'}}
    ],
    returns: {arg: 'status', type: 'string'},
    description: "Perform a bulk upload of a genetic map with associated chromosomes and markers"
  });
  Geneticmap.remoteMethod('tableUpload', {
    accepts: [
      {arg: 'data', type: 'object', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {arg: 'status', type: 'string'},
    description: "Perform a bulk upload of a markers from tabular form"
  });

  acl.assignRulesRecord(Geneticmap)
  acl.limitRemoteMethods(Geneticmap)
};
