'use strict';


var acl = require('../utilities/acl')
var identity = require('../utilities/identity')
var task = require('../utilities/task')
var blockFeatures = require('../utilities/block-features');
var pathsAggr = require('../utilities/paths-aggr');
var pathsFilter = require('../utilities/paths-filter');
var pathsStream = require('../utilities/paths-stream');

var ObjectId = require('mongodb').ObjectID

var cache = require('memory-cache');

var SSE = require('express-sse');

const { Writable, pipeline, Readable } = require('stream');
/* This also works :
 * const Readable = require('readable-stream').Readable;
 * and also : var streamify = require('stream-array');
 */



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

  Block.paths = function(left, right, withDirect = true, options, res, cb) {
    task.paths(this.app.models, left, right, withDirect, options)
    .then(function(data) {
      // completed additions to database
      cb(null, data);
    })
    .catch(function(err) {
      console.log('ERROR', err)
      cb(err);
    })
  };

  /*--------------------------------------------------------------------------*/

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
          console.log('pathsProgressive then', (data.length > 2) ? data.length : data);
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
    function dbLookup() {
      let cursor =
        pathsAggr.pathsDirect(db, blockId0, blockId1, intervals);
      return cursor;
    };
    let
      cacheId = blockId0 + '_' + blockId1,
    useCache = ! intervals.dbPathFilter,
    apiOptions = { useCache };
    reqStream(dbLookup, pathsFilter.filterPaths, cacheId, intervals, req, res, apiOptions);
  };

  /*--------------------------------------------------------------------------*/

  /**
   * @see pathsProgressive()
   * @param blockIds  array[2] of blockIds
   */
  Block.pathsAliasesProgressive = function(blockIds, intervals, options, res, cb) {
    let [left, right] = blockIds;
    console.log('pathsAliasesProgressive', left, right, intervals /*, options, cb*/);
    let cacheId = left + '_' + right,
    /** if filtering in db query then don't use cache;  that applies now that pathsAliases() is defined. */
    useCache = ! pathsAggr.pathsAliases || ! intervals.dbPathFilter,
    /** filterPathsAliases() is not yet adapted to handle results of pathsAliases() */
    dbPathFilter = pathsAggr.pathsAliases !== undefined,
    cached = cache.get(cacheId);
    if (useCache && cached) {
      console.log('pathsAliasesProgressive cache hit', cacheId);
      let filteredData = dbPathFilter ? 
        cached : pathsFilter.filterPathsAliases(cached, intervals);
      cb(null, filteredData);
    }
    else {
      /** promise yielding data array. */
      let dataP;
      if (pathsAggr.pathsAliases) { // pathsAliases() is defined after 5576c1e.
        let cursorP = this.dbLookupAliases(left, right, intervals);
        dataP = cursorP.then(function (cursor) { return cursor.toArray(); });
      }
      else
        dataP = this.apiLookupAliases(left, right, intervals);
      dataP
        .then(function(data) {
          console.log('pathsAliasesProgressive then', (data.length > 3) ? data.length : data);
          if (useCache)
            cache.put(cacheId, data);
          let filteredData;
          // no filter required when user has nominated nSamples.
          if (intervals.nSamples || dbPathFilter)
            filteredData = data;
          else
            filteredData = pathsFilter.filterPathsAliases(data, intervals);
          if (trace_block > 1)
            console.log("Num Filtered PathsAliases => ", filteredData.length);
          cb(null, filteredData);
        })
        .catch(function(err) {
          console.log('ERROR', err);
          cb(err);
        });
    }
  };

  /** 
   * Results are cached in blockRecords, indexed by blockId;  also see blockRecordsOutdate().
   * also in backend/common/utilities/task.js : @see findBlock(), findBlockPair()
   */
  Block.blockGet = function(blockIds) {
    let models = this.app.models;
    let promise =  models.Block.find({where: {id: {inq: blockIds}}} /*,options*/).then(blocks => {
      return  blocks.map(blockR => {
        let block = blockR.__data;
        console.log('blockGet then map', block.id || block || blockR);
        this.blockRecordsStore(block.id, block);
        return block;
      } );
    });
    return promise;
  };
  /** cache result from blockGet().
   */
  Block.blockRecords = {};
  Block.blockRecordsStore = function(blockId, record) {
    console.log('blockRecordsStore', blockId, record);
    this.blockRecords[blockId] = record;
  };
  /** this could be called if an API was added which allowed Block .namespace to change. */
  Block.blockRecordsOutdate = function (blockIds) {
    blockIds.forEach(blockId => delete this.blockRecords[blockId] );
  };

/*----------------------------------------------------------------------------*/

/** Lookup .namespace for the given blockIds.  Cached values are used if
 * available, since this is used in the high-use pathsaliases() api, and we
 * don't yet have an api for altering .namespace.
 *
 * @param blockIds  array of blocks for which to get .namespace
 */
Block.blockNamespace = async function(blockIds) {
  /** Use cached values if all required values are cached. */
  let n = blockIds.map(blockId =>  {
    let block = this.blockRecords[blockId];
    return block && block.namespace;
  } );
  if (n.indexOf(undefined) >= 0) {
    let
      p = this.blockGet(blockIds)
      .map(function (b) { return b.namespace; } )
      .catch (e => {
        console.log('blockNamespace err', e);
      });
    n = await p;
  }
  else { console.log('using cached namespaces'); }
  console.log('blockNamespace', n);
  return n;
};

  Block.dbLookupAliases = async function(blockId0, blockId1, intervals) {
    let namespaces = await this.blockNamespace([blockId0, blockId1]);

    let db = this.dataSource.connector,
    cursor =
      pathsAggr.pathsAliases(db, blockId0, blockId1, namespaces[0],  namespaces[1], intervals);
    console.log('dbLookupAliases', namespaces);
    return cursor;
  };
  Block.apiLookupAliases = function(blockId0, blockId1, intervals) {
    return task.paths(this.app.models, blockId0, blockId1, /*withDirect*/ false, /*options*/ undefined);
  };

  /**
   * @param req to registor for req.on(close)
   * @param res for using raw Express functions rather than rely on Loopback.
   * Used for res.flush() and res.setHeader()
   */
  Block.pathsAliasesViaStream = function(blockIds, intervals, options, req, res, cb) {
    // console.log('pathsAliasesViaStream', blockIds, intervals, options, req, res, cb);
    let me = this;

    function aliasesCursor() {
      let cursor;
      if (pathsAggr.pathsAliases) {
        // result is a promise yielding a cursor
        cursor = me.dbLookupAliases(blockIds[0], blockIds[1], intervals);
      }
      else {
        let dataP = me.apiLookupAliases(blockIds[0], blockIds[1], intervals);
        cursor =
          dataP.then(function (data) {
            console.log('dataP', data.length < 3 ? data : data.length);
            let arrayReadable = 
              // can also use : github.com/mimetnet/node-stream-array, streamify(data);
              /* {objectMode:true} is required, otherwise get :
               * Unhandled rejection TypeError [ERR_INVALID_ARG_TYPE]: The "chunk" argument must be one of type string, Buffer, or Uint8Array. Received type object
               * or : (readable-stream) Unhandled rejection TypeError: Invalid non-string/buffer chunk
               */
            new Readable({objectMode:true});
            data.forEach(a => arrayReadable.push(a));
            // signal end of data.
            arrayReadable.push(null);
            return arrayReadable;
          });
      }
      return cursor;
    }

    let
      cacheId = blockIds[0] + '_' + blockIds[1],
    useCache = ! intervals.dbPathFilter,
    /** pathsAliases() does filter, and filterPathsAliases() is not yet adapted to handle results of pathsAliases() */
    dbPathFilter = pathsAggr.pathsAliases !== undefined,
    nullFilter = function (paths, intervals) { return paths; },
    filterFunction = dbPathFilter ? nullFilter : pathsFilter.filterPathsAliases,
    apiOptions = { useCache };
    reqStream(aliasesCursor, filterFunction, cacheId, intervals, req, res, apiOptions);
  };

  /*--------------------------------------------------------------------------*/

  /**  Read data from cache or cursorFunction, filter it and send it via SSE.
   *
   * If apiOptions.useCache, check if the data is in cache, identified by cacheId.
   * Otherwise read data using cursorFunction, storing in cache if enabled.
   * Filter it with filterFunction using intervals, 
   */
  function reqStream(cursorFunction, filterFunction, cacheId, intervals, req, res, apiOptions) {
    /* The params of reqStream() are largely passed to pipeStream() - starting to look like a class. */

    /** trial also performance of : isSerialized: true */
    let sse = new SSE(undefined, {isCompressed : false});
    if (! res.setHeader) {
      console.log('reqStream', cursorFunction, filterFunction, cacheId, intervals, req, res, apiOptions);
      debugger;
    }
    sse.init(req, res);
    // express-sse init() has no-cache by default; add no-transform
    res.setHeader('Cache-Control', 'no-cache, no-transform');

    /** same format as extractId() - serializers/block-adj */
    let
      useCache = apiOptions.useCache,
    cached = cache.get(cacheId);
    console.log('useCache', useCache, intervals.dbPathFilter, cacheId);
    /** defined only in else.  */
    let cursor;
    if (useCache && cached) {
      console.log('from cache', cacheId, cached.length);
      let filteredData = pathsFilter.filterPaths(cached, intervals);
      sse.send(filteredData, 'pathsViaStream');
      res.flush();
      sse.send([], 'pathsViaStream', SSE_EventID_EOF);
      res.flush();
    }
    else {
      cursor = cursorFunction();
      if (cursor.then) {
        cursor.then(function (cursorValue) {
          pipeStream(sse, intervals, useCache, cacheId, filterFunction, res, cursorValue);
        });
      }
      else
        pipeStream(sse, intervals, useCache, cacheId, filterFunction, res, cursor);
    }

    req.on('close', () => {
      console.log('req.on(close)');
      if (cursor) {
        // ! cursor.isExhausted() && cursor.hasNext()
        if (cursor.isClosed && ! cursor.isClosed())
          console.log('reqStream : close before end of cursor', intervals);
        if (! cursor.close) {
          console.log('cursor.close not defined' /*,cursor*/);

          if (cursor.then) {
            cursor.then(function (c) {
              if (c.push && c.destroy) {
                console.log('c.push(null)');
                c.push(null);
                c.destroy();
              }
              /* The client is closing the SSE, so close the database cursor.
               * c.close() often gets ERR_STREAM_PREMATURE_CLOSE;
               * that seems to be prevented by the above c.push(null); c.destroy();
               * (refn : https://stackoverflow.com/questions/19277094/how-to-close-a-readable-stream-before-end#comment85664373_19277094)
               * Testing indicates c.destroy() does not work without the c.push(null).  Also tried c.pause(), c.kill().
               * Another approach may be : https://mongodb.github.io/node-mongodb-native/2.0/tutorials/aggregation/
               * "... to terminate the each early you should return false in your each callback. This will stop the cursor from returning documents."
               * that relies on .each() whereas .pipe() is used.
               */
              if (c.close) {
                console.log('promise yielded cursor with .close' /*,c*/);
                closeCursor(c);
              }
              else
                debugger;
            });
          }
          else
            closeCursor(cursor);
          function closeCursor(cursor) {
            cursor.close(function () { console.log('cursor closed'); });
          }
        }
      }
    });

  };

  /** Logically part of reqStream(), but split out so that it can be called
   * directly or via a promise. */
  function pipeStream(sse, intervals, useCache, cacheId, filterFunction, res, cursor) {
      if (useCache)
        cursor.
        pipe(new pathsStream.CacheWritable(cacheId));

      let pipeLine = [cursor];

      /** no filter required when user has nominated nSamples. */
      let useFilter = ! intervals.nSamples;
      let filterPipe;
      if (useFilter)
        pipeLine.push(filterPipe = new pathsStream.FilterPipe(intervals, filterFunction));

      // as in example https://jira.mongodb.org/browse/NODE-1408
      // cursor.stream({transform: x => JSON.stringify(x)}).pipe(res)
      // which also gives this alternative form :
      // https://jira.mongodb.org/browse/NODE-1408?focusedCommentId=1863180&page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-1863180
      pipeLine.push(new SseWritable(sse, res));

    let pipeLine_ =
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

      /* cursor.on('end') is likely to be too early - may send EOF before all
       * messages are sent; the automatic tests were showing a variable number
       * of paths returned from paths aliases streaming.
       * Wait for pipeLine_.on('finish') - refn :
       *   https://nodejs.org/api/stream.html#stream_event_finish
       */
      pipeLine_.on('finish', () => {
        console.log('pipeLine_.on(finish)', arguments.length);
        if (filterPipe)
          console.log('filterPipe', filterPipe.countIn, filterPipe.countOut);
        sse.send([], 'pathsViaStream', SSE_EventID_EOF);
        res.flush();
        // res.end()
      });

    }


  /*--------------------------------------------------------------------------*/

  /** Send a database request to count the features within the given blocks.
   *
   * @param blockIds  blocks
   */
  Block.blockFeaturesCount = function(blockIds, options, res, cb) {
    let db = this.dataSource.connector;
    let cursor =
      blockFeatures.blockFeaturesCount(db, blockIds);
    cursor.toArray()
    .then(function(featureCounts) {
      cb(null, featureCounts);
    }).catch(function(err) {
      cb(err);
    });
  };

  /*--------------------------------------------------------------------------*/

  /** Collate from the database a list of features within the given block, which
   * meet the optional interval domain constraint.
   *
   * @param blockIds  blocks
   */
  Block.blockFeaturesInterval = function(blockIds, intervals, options, res, cb) {
    // based on Block.pathsProgressive(); there is similarity which could be
    // factored into a mixin, which may be relevant to factoring this with
    // streaming equivalent (not yet added).

      let db = this.dataSource.connector;
    const apiName = 'blockFeaturesInterval';
    console.log(apiName, /*db,*/ blockIds, intervals /*, options, cb*/);
    let cacheId = blockIds.join('_'),
    /** If intervals.dbPathFilter, we could append the location filter to cacheId,
     * but it is not clear yet whether that would perform better.
     * e.g. filterId = intervals.dbPathFilter ? '_' + intervals.axes[0].domain[0] + '_' + ... : ''
     */
    useCache = ! intervals.dbPathFilter,
    cached = cache.get(cacheId);
    if (useCache && cached) {
      let filteredData = pathsFilter.filterFeatures(cached, intervals);
      cb(null, filteredData);
    }
    else {
      let cursor =
        pathsAggr.blockFeaturesInterval(db, blockIds, intervals);
      cursor.toArray()
        .then(function(data) {
          console.log(apiName, ' then', (data.length > 10) ? data.length : data);
          if (useCache)
            cache.put(cacheId, data);
          let filteredData;
          // no filter required when user has nominated nSamples.
          if (intervals.nSamples)
            filteredData = data;
          else
            filteredData = pathsFilter.filterFeatures(data, intervals);
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

  /*--------------------------------------------------------------------------*/


  Block.pathsByReference = function(blockA, blockB, referenceGenome, maxDistance, options, cb) {
    task.pathsViaLookupReference(this.app.models, blockA, blockB, referenceGenome, maxDistance, options)
    .then(function(paths) {
      cb(null, paths);
    }).catch(function(err) {
      cb(err);
    });
  }

  /*--------------------------------------------------------------------------*/

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

  //----------------------------------------------------------------------------
  // When adding a API .remoteMethod() here, also add the route name to backend/common/utilities/paths-stream.js : genericResolver()
  //----------------------------------------------------------------------------

  Block.remoteMethod('blockFeaturesCount', {
    accepts: [
      {arg: 'blocks', type: 'array', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns a count of the Features in the block"
  });

  Block.remoteMethod('blockFeaturesInterval', {
    accepts: [
      {arg: 'blocks', type: 'array', required: true},
      {arg: 'intervals', type: 'object', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns Features of the block, within the interval optionally given in parameters, and filtering also for range / resolution"
  });

  Block.remoteMethod('paths', {
    accepts: [
      {arg: 'blockA', type: 'string', required: true}, // block reference
      {arg: 'blockB', type: 'string', required: true}, // block reference
      {arg: 'withDirect', type: 'Boolean', required: false, default : 'true'}, // true means include direct (same name) links, otherwise just aliases
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
  });

  Block.remoteMethod('pathsAliasesProgressive', {
    accepts: [
      {arg: 'blockIds', type: 'array', required: true},
      {arg: 'intervals', type: 'object', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns paths from aliases between the two blocks, constrained to the domains defined in intervals, and reduced in number according to given parameters for range / resolution / page in intervals; Enables progressive loading of paths data"
  });

  Block.remoteMethod('pathsAliasesViaStream', {
    accepts: [
      {arg: 'blockIds', type: 'array', required: true},
      {arg: 'intervals', type: 'object', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'req', type: 'object', 'http': {source: 'req'}},
      { arg: 'res', type: 'object', http: { source: 'res' }}
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "As for pathsAliasesProgressive, but the paths are streamed via SSE instead of a single reply"
  });


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
