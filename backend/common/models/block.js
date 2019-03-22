'use strict';

var acl = require('../utilities/acl')
var identity = require('../utilities/identity')
var task = require('../utilities/task')
var pathsAggr = require('../utilities/paths-aggr');
var pathsFilter = require('../utilities/paths-filter');

var ObjectId = require('mongodb').ObjectID

var cache = require('memory-cache');

var SSE = require('express-sse');

const { Writable, Transform, pipeline } = require('stream');

/** This value is used in SSE packet event id to signify the end of the cursor in pathsViaStream. */
const SSE_EventID_EOF = -1;

const trace_block = 1;

class SseWritable extends Writable {
  // this class is based on a comment by Daniel Aprahamian in https://jira.mongodb.org/browse/NODE-1408
  constructor(sse, res) {
    super({objectMode: true});
    this.sse = sse;
    this.res = res;
    // console.log('SseWritable()');
  }
 
  _write(chunk, encoding, callback) {
    //process.stdout.write();
    let content = chunk; // express-sse does : JSON.stringify();
    let eventName = 'pathsViaStream';
    // console.log('SseWritable _write()', chunk);
    this.sse.send(content, eventName);
    this.res.flush();
    callback();
  }
}


/* global module require */

module.exports = function(Block) {

  Block.paths = function(left, right, options, res, cb) {
    task.paths(this.app.models, left, right, options)
    .then(function(data) {
      // completed additions to database
      cb(null, data);
    })
    .catch(function(err) {
      console.log('ERROR', err)
      cb(err);
    })
  };

  /**
   * Apart from asymmetric alignents such as some aliases, the convention is to
   * only lookup paths for one direction since the other lookup will have the
   * identical result.  i.e. blockId0 < blockId1.
   * They don't correspond in order to left or right axes.
   *
   * @param blockId0
   * @param blockId1
   */
  Block.pathsProgressive = function(left, right, intervals, options, res, cb) {
      let db = this.dataSource.connector;
    console.log('pathsProgressive', /*db,*/ left, right, intervals /*, options, cb*/);
    let cacheId = left + '_' + right,
    /** If intervals.dbPathFilter, we could append the location filter to cacheId,
     * but it is not clear yet whether that would perform better.
     * e.g. filterId = intervals.dbPathFilter ? '_' + intervals.axes[0].domain[0] + '_' + ... : ''
     */
    useCache = ! intervals.dbPathFilter,
    cached = cache.get(cacheId);
    if (useCache && cached) {
      let filteredData = pathsFilter.filterPaths(cached, intervals);
      cb(null, filteredData);
    }
    else {
      let cursor =
        pathsAggr.pathsDirect(db, left, right, intervals);
      cursor.toArray()
        .then(function(data) {
          console.log('pathsProgressive then', (data.length > 10) ? data.length : data);
          if (useCache)
            cache.put(cacheId, data);
          let filteredData;
          // no filter required when user has nominated nSamples.
          if (intervals.nSamples)
            filteredData = data;
          else
            filteredData = pathsFilter.filterPaths(data, intervals);
          if (trace_block > 1)
            console.log("Num Filtered Paths => ", filteredData.length);
          cb(null, filteredData);
        })
        .catch(function(err) {
          console.log('ERROR', err);
          cb(err);
        });
    }
  };


  /**
   * @param req to registor for req.on(close)
   * @param res for using raw Express functions rather than rely on Loopback.
   * Used for res.flush() and res.setHeader()
   */
  Block.pathsViaStream = function(blockId0, blockId1, intervals, options, req, res, cb) {
    let db = this.dataSource.connector;

    class CacheWritable extends Writable {
      constructor(cacheId) {
        super({objectMode: true});
        this.cacheId = cacheId;

      }
      _write(chunk, encoding, callback) {
        console.log('CacheWritable _write', chunk);
        debugger;
        let data = cache.get(this.cacheId);
        if (data)
          data = data.concat(chunk);
        else
          data = [];
        cache.put(this.cacheId, data);
        callback();
      }
    }

    class FilterPipe extends Transform {
      constructor(intervals) {
        super({objectMode: true});
        this.intervals = intervals;
      }
      _transform(data, encoding, callback) {
        if (trace_block > 2)
          console.log('FilterPipe _transform', data);
        // data is a single document, not an array
        if (! data /*|| data.length */)
          debugger;
        else {
          let filteredData = pathsFilter.filterPaths([data], this.intervals);
          if (trace_block > 2)
            console.log('filteredData', filteredData, filteredData.length);
          if (filteredData && filteredData.length)
          {
            this.push(filteredData);
            callback();
          }
        }
      }
    }


    /** trial also performance of : isSerialized: true */
    let sse = new SSE(undefined, {isCompressed : false});
    sse.init(req, res);
    // express-sse init() has no-cache by default; add no-transform
    res.setHeader('Cache-Control', 'no-cache, no-transform');

    /** same format as extractId() - serializers/block-adj */
    let cacheId = blockId0 + '_' + blockId1,
    useCache = ! intervals.dbPathFilter,
    cached = cache.get(cacheId);
    if (useCache && cached) {
      let filteredData = pathsFilter.filterPaths(cached, intervals);
      sse.send(filteredData, 'pathsViaStream');
      res.flush();
      sse.send([], 'pathsViaStream', SSE_EventID_EOF);
      res.flush();
    }
    else {
      let cursor =
        pathsAggr.pathsDirect(db, blockId0, blockId1, intervals);
      if (useCache)
        cursor.
        pipe(new CacheWritable(cacheId));

      let pipeLine = [cursor];

      /** no filter required when user has nominated nSamples. */
      let useFilter = ! intervals.nSamples;
      if (useFilter)
        pipeLine.push(new FilterPipe(intervals));

      // as in example https://jira.mongodb.org/browse/NODE-1408
      // cursor.stream({transform: x => JSON.stringify(x)}).pipe(res)
      // which also gives this alternative form :
      // https://jira.mongodb.org/browse/NODE-1408?focusedCommentId=1863180&page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-1863180
      pipeLine.push(new SseWritable(sse, res));

      pipeline(
        pipeLine,
        (err) => {
          if (err) {
            console.error('Pipeline failed.', err);
          } else {
            if (trace_block > 2)
              console.log('Pipeline succeeded.');
          }});

      // cursor.on('data', doc => {
      //   array.push(doc)
      // })

      /* maybe pipeLine.on ...  */
      cursor.on('end', () => {
        console.log('cursor.on(end)', arguments.length);
        sse.send([], 'pathsViaStream', SSE_EventID_EOF);
        res.flush();
        // res.end()
      });

    }
    


    req.on('close', () => {
      console.log('req.on(close)');
    });

  };

  Block.pathsByReference = function(blockA, blockB, referenceGenome, maxDistance, options, cb) {
    task.pathsViaLookupReference(this.app.models, blockA, blockB, referenceGenome, maxDistance, options)
    .then(function(paths) {
      cb(null, paths);
    }).catch(function(err) {
      cb(err);
    });
  }

  Block.observe('before save', function(ctx, next) {
    if (ctx.instance) {
      if (!ctx.instance.name) {
        if (ctx.instance.scope) {
          ctx.instance.name = ctx.instance.scope;
        } else if (ctx.instance.namespace) {
          ctx.instance.name = ctx.instance.namespace;
        }
      }
    }
    next();
  });

  Block.observe('before delete', function(ctx, next) {
    var Block = ctx.Model.app.models.Block
    var Annotation = ctx.Model.app.models.Annotation

    var Feature = ctx.Model.app.models.Feature
    Feature.destroyAll({blockId: ctx.where.id}, ctx.options);

    var Annotation = ctx.Model.app.models.Annotation
    Annotation.find({
      where: {
        blockId: ctx.where.id
      }
    }, ctx.options).then(function(annotations) {
      annotations.forEach(function(annotation) {
        Annotation.destroyById(annotation.id, ctx.options, function () {
        });
      })
    })

    var Interval = ctx.Model.app.models.Interval
    Interval.find({
      where: {
        blockId: ctx.where.id
      }
    }, ctx.options).then(function(intervals) {
      intervals.forEach(function(interval) {
        Interval.destroyById(interval.id, ctx.options, function () {
        });
      })
    })

    next()
  })

  Block.remoteMethod('paths', {
    accepts: [
      {arg: 'blockA', type: 'string', required: true}, // block reference
      {arg: 'blockB', type: 'string', required: true}, // block reference
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}}
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns paths between the two blocks"
  });

  Block.remoteMethod('pathsProgressive', {
    accepts: [
      {arg: 'blockA', type: 'string', required: true},
      {arg: 'blockB', type: 'string', required: true},
      {arg: 'intervals', type: 'object', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns paths between the two blocks, in progressive steps according to given parameters for range / resolution / page"
  });

  Block.remoteMethod('pathsByReference', {
    accepts: [
      {arg: 'blockA', type: 'string', required: true},
      {arg: 'blockB', type: 'string', required: true},
      {arg: 'reference', type: 'string', required: true},
      {arg: 'max_distance', type: 'number', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns paths between blockA and blockB via position on reference blocks blockB and blockC"
  });

  Block.remoteMethod('pathsViaStream', {
    accepts: [
      {arg: 'blockA', type: 'string', required: true},
      {arg: 'blockB', type: 'string', required: true},
      {arg: 'intervals', type: 'object', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'req', type: 'object', 'http': {source: 'req'}},
      { arg: 'res', type: 'object', http: { source: 'res' }}
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    /* For return a stream / file */
    // returns: [
    //   {arg: 'body', type: 'file', root: true},
    //   {arg: 'Content-Type', type: 'string', http: { target: 'header' }}
    // ],
    description: "Streams paths instead of throwing them all back to user"
  })

  Block.syntenies = function(id0, id1, thresholdSize, thresholdContinuity, cb) {
    task.syntenies(this.app.models, id0, id1, thresholdSize, thresholdContinuity)
    .then(function(data) {
      // completed additions to database
      cb(null, data);
    })
    .catch(function(err) {
      console.log('ERROR', err)
      cb(err);
    })
  }

  Block.remoteMethod('syntenies', {
    accepts: [
      {arg: '0', type: 'string', required: true}, // block reference
      {arg: '1', type: 'string', required: true}, // block reference
      {arg: 'threshold-size', type: 'string', required: false}, // block reference
      {arg: 'threshold-continuity', type: 'string', required: false}, // block reference
    ],
    returns: {type: 'array', root: true},
    description: "Request syntenic blocks for left and right blocks"
  });

  acl.assignRulesRecord(Block)
  acl.limitRemoteMethods(Block)
  acl.limitRemoteMethodsSubrecord(Block)
  acl.limitRemoteMethodsRelated(Block)
};
