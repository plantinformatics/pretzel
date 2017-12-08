'use strict';

var _ = require('lodash')

var acl = require('../utilities/acl')
var upload = require('../utilities/upload')
var load = require('../utilities/load')

module.exports = function(Geneticmap) {

  // Geneticmap.beforeRemote('find', function(ctx, modelInstance, next) {
  //   console.log('> Geneticmap.find')

  //   let accessToken = ctx.req.accessToken
  //   let userId = String(accessToken.userId)

  //   let where = {};
  //   where = {or: [{clientId: userId}, {public: true}]};
  //   if (ctx.args.filter && ctx.args.filter.where) {
  //     where = {and: [where, ctx.args.filter.where]}
  //   }
  //   if (!ctx.args.filter) {
  //     ctx.args.filter = {};
  //   }
  //   ctx.args.filter.where = where;

  //   console.log(ctx.args)
  //   next()
  // })

  Geneticmap.observe('access', function(ctx, next) {
    console.log('> Geneticmap.access');
    let accessToken = ctx.options.accessToken
    let userId = String(accessToken.userId)

    
    let where = {};
    where = {or: [{clientId: userId}, {public: true}]};
    if (ctx.options.filter && ctx.options.filter.where) {
      where = {and: [where, ctx.options.filter.where]}
    }
    if (!ctx.options.filter) {
      ctx.options.filter = {};
    }
    ctx.query.where = where;

    console.log(ctx.options)



    // let where = {};
    // where = {or: [{clientId: userId}, {public: true}]};
    // if (ctx.args.filter && ctx.args.filter.where) {
    //   where = {and: [where, ctx.args.filter.where]}
    // }
    // if (!ctx.args.filter) {
    //   ctx.args.filter = {};
    // }
    // ctx.args.filter.where = where;

    // console.log(ctx.args)

    next()
  })

  Geneticmap.afterRemote('find', function(ctx, modelInstance, next) {
    console.log('> Geneticmap.loaded');

    // TODO handling not needed on authless Pretzel instance
    // may be worth centralising logic for this section

    // bear in mind that conventional ACL systems have already
    // run at this point, so further work here is solely for
    // publicity filtering
    // let accessToken = ctx.req.accessToken
    // let userId = String(accessToken.userId)

    // console.log(modelInstance.length)

    // let datasets = ctx.result

    // // high-level filtering on geneticmaps
    // datasets = _.filter(datasets, function(o) {
    //   if (o.public != true) {
    //     return String(o.clientId) == userId
    //   } else return true
    // })





    // // low-level filtering on chromosomes
    // datasets = _.forEach(datasets, function(element) {
    //   if (element.chromosomes) {

    //     // for (var i = element.chromosomes.length - 1; i >= 0; --i) {
    //     //   let chr = element.chromosomes[i]

    //     //   if (chr.public != true) {
    //     //     if (String(chr.clientId) != userId) {
    //     //       element.chromosomes.splice(i, 1)
    //     //     }
    //     //   }
    //     // }

    //     let chromosomes = _.filter(element.chromosomes, function(o) {
    //       if (o.public != true) {
    //         return String(o.clientId) == userId
    //       } else return true
    //     })

    //     element.chromosomes.splice(0, element.chromosomes.length);

    //     // element.unsetAttribute('chromosomes')

    //     console.log(true)
    //     // element.chromosomes = chromosomes
    //     element.updateAttribute('chromosomes', chromosomes)
    //     console.log(false)
    //   }
    // })


    // console.log(modelInstance.length)

    // ctx.result = datasets

    // intent is to filter out entries which are not public
    // and are not owned by the user


    // console.log(ctx)
    // ctx.result = {
    //   'geneticmaps': ctx.result
    // };
    // console.log('next')
    next()
  })

  var rules = [
    {
      'accessType': '*',
      'principalType': 'ROLE',
      'principalId': '$everyone',
      'permission': 'DENY',
    },
    // {
    //   'accessType': 'READ',
    //   'principalType': 'ROLE',
    //   'principalId': 'public',
    //   'permission': 'ALLOW',
    // },
    // {
    //   'accessType': '*',
    //   'principalType': 'ROLE',
    //   'principalId': '$owner',
    //   'permission': 'ALLOW',
    // }
    {
      'accessType': '*',
      'principalType': 'ROLE',
      'principalId': '$authenticated',
      'permission': 'ALLOW',
    }
  ];
  acl.assign(Geneticmap, rules);

  Geneticmap.observe('before save', function(ctx, next) {
    if (ctx.instance) {
      // populate with userId
      // this appears to be sidestepped by populating at upload time
      // TODO revisit this during / after 
      // ctx.Model.clientId = ctx.options.accessToken.userId
      var newDate = Date.now();  
      // ctx.instance.createdAt = newDate;
      // ctx.Model.updatedAt = newDate;
      ctx.instance.clientId = ctx.options.accessToken.userId
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
    var userId = options.accessToken.userId

    var models = this.app.models;
    var chromosomes = {};
    var genMap = null;
    var chromosomes_by_name = [];
    var existing_chromosomes = [];

    models.Geneticmap.findById(data.geneticmap_id, {include: "chromosomes"})
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
        return models.Marker.deleteAll({chromosomeId: {inq: existing_chromosomes}})
      } else {
        cb(Error("Geneticmap not found"));
      }
    })
    .then(function(deleted_markers) {
      return models.Chromosome.updateAll({id: {inq: existing_chromosomes}}, {updatedAt: new Date()})
    }).then(function(updated_chromosomes) {
      var new_chromosomes = [];
      Object.keys(chromosomes).forEach(function(name) {
        if (chromosomes[name] === false) {
          new_chromosomes.push({
            name: name,
            geneticmapId: genMap.id,
            clientId: userId
          });
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
};

// NOTES
// the 'scope' property in the associated json file allows us to add in the
// relation to chromosomes. If this property is not added, then all we will receive
// is the high-level geneticmap info, and will have to perform another call to gather
// the chromosome info. While this is suitable in the short-term, in the long-term
// this may need to be changed if the number of chromosomes is high for the geneticmaps
// in aggregate