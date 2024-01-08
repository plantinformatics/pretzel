'use strict';

const util = require('util');
var { debounce }  = require('lodash/function');


var acl = require('../utilities/acl')
var identity = require('../utilities/identity')
var task = require('../utilities/task')
const qs = require('qs');

var upload = require('../utilities/upload');
const { insert_features_recursive } = require('../utilities/upload');
var blockFeatures = require('../utilities/block-features');
var pathsAggr = require('../utilities/paths-aggr');
var pathsFilter = require('../utilities/paths-filter');
var pathsStream = require('../utilities/paths-stream');
var { localiseBlocks, blockLocalId } = require('../utilities/localise-blocks');
const { blockServer } = require('../utilities/api-server');
const { getAliases } = require('../utilities/localise-aliases');
const { childProcess, dataOutReplyClosure, dataOutReplyClosureLimit } = require('../utilities/child-process');
const { ArgsDebounce } = require('../utilities/debounce-args');
const { ErrorStatus } = require('../utilities/errorStatus.js');
const { vcfGenotypeLookup, vcfGenotypeFeaturesCounts } = require('../utilities/vcf-genotype');
const { germinateGenotypeSamples, germinateGenotypeLookup } = require('../utilities/germinate-genotype');
const { parseBooleanFields } = require('../utilities/json-text');

const germinateGenotypeSamplesP = util.promisify(germinateGenotypeSamples);

var ObjectId = require('mongodb').ObjectID


/** results-cache has the same API as 'memory-cache', so that can be
 * used instead to avoid the need to setup a cache directory, and
 * manage cache accumulation.
 */
const cacheLibraryName = '../utilities/results-cache'; // 'memory-cache';
var cache = require(cacheLibraryName);

var SSE = require('express-sse');

const { Writable, pipeline, Readable } = require('stream');
/* This also works :
 * const Readable = require('readable-stream').Readable;
 * and also : var streamify = require('stream-array');
 */

/* global process */

// -----------------------------------------------------------------------------


/** This value is used in SSE packet event id to signify the end of the cursor in pathsViaStream. */
const SSE_EventID_EOF = -1;

/** For the paths* functions the params blockA,B may be references to different api servers;
 * in which case the blockId is augmented with host and token.  To handle this variation,
 * the remoteMethod() param type is given 'any' instead of 'string' which is used for blockId.
 */
const blockRemoteType = 'any';

/** commented in .pathsAliasesProgressive() - use dbLookupAliases() now in place
 * of apiLookupAliases(), for db query and progressive paths. 
 * dbLookupAliases() now uses .pathsAliasesRemote() for multiple backends;
 * it wraps pathsAliases(), which was defined from 9da058e onwards.
 */
const use_dbLookupAliases = true;

const trace_block = 2;

// -----------------------------------------------------------------------------

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

/*----------------------------------------------------------------------------*/

/** Given a start time, return elapsed milliseconds as a string.
 * @param startTime result of process.hrtime();
 * @param decimalPlaces number of decimal places to show in the result string.
 */
function elapsedMs(startTime, decimalPlaces) {
  let elapsedTime = process.hrtime(startTime);
  var ms = elapsedTime[0] * 1e3 + elapsedTime[1] * 1e-6;
  return ms.toFixed(decimalPlaces);
}

/*----------------------------------------------------------------------------*/

/* global module require */

module.exports = function(Block) {


  /*--------------------------------------------------------------------------*/

// copied from localise-blocks.js - may be able to factor, if no changes

/** Add features.
 * @param features  array of features to add.
 *  each feature defines .blockId
 * @return promise (no value)
 */
function blockAddFeatures(db, datasetId, blockId, features, cb) {
  /** convert the ._id and .blockId fields from hex string to ObjectId,
   * and shallow-copy the other fields. */
  let featuresId = features.map((f) => {
    let {/*_id, */...rest} = f;
    // rest._id = ObjectId(_id);
    rest.blockId = ObjectId(blockId);
    return rest;
  });

  return insert_features_recursive(db, datasetId, featuresId, false, cb);
}


  /** Send a database request to append the features in data to the given block.
   *
   * @param data  blockId and features
   */
  Block.blockFeaturesAdd = function(data, options, cb) {
    let db = this.dataSource.connector;

    if (data.filename) {
      upload.handleJson(data, processJson, cb);
    } else {
      processJson(data);
    }

    function processJson(json) {
      let
      blockId = json.blockId,
      b = {blockId},
      features = json.features;
      return blockAddFeatures(db, /*datasetId*/b, blockId, features, cb)
        .then(() => { console.log('after blockAddFeatures', b); return b.blockId; });
    }

  };




  /** This is the original paths api, prior to progressive-loading, i.e. it
   * returns all paths in a single response.
   *
   * The alternatives defined later allow narrowing the scope of paths, by
   * interval and density / count, and the option of sending the response via
   * SSE - streaming.
   * @see pathsProgressive(), pathsViaStream(), 
   * pathsAliasesProgressive(), pathsAliasesViaStream()
   *
   * @param id [blockId, blockId], aka [left, right]
   */
  Block.paths = function(id, withDirect = true, options, res, cb) {
    task.paths(this.app.models, id[0], id[1], withDirect, options)
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
   * @param id  [blockId0, blockId1]
   */
  Block.pathsProgressive = function(id, intervals, options, res, cb) {
    localiseBlocks(this.app.models, id, intervals)
    /** @param left, right are localised - just the ID string */
      .then(([left, right]) => {
    let db = this.dataSource.connector;
    console.log('pathsProgressive', /*db,*/ JSON.stringify(left), JSON.stringify(right), intervals /*, options, cb*/);
    let cacheId = left + '_' + right,
    /** If intervals.dbPathFilter, we could append the location filter to cacheId,
     * but it is not clear yet whether that would perform better.
     * e.g. filterId = intervals.dbPathFilter ? '_' + intervals.axes[0].domain[0] + '_' + ... : ''
     * So cache is not used if dbPathFilter.
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
      });
  };


  /**
   * @param id  [blockId0, blockId1]  array length is checked in resolve2Blocks().
   *
   * @param req to registor for req.on(close)
   * @param res for using raw Express functions rather than rely on Loopback.
   * Used for res.flush() and res.setHeader()
   */
  Block.pathsViaStream = function(id, intervals, options, req, res, cb) {
    localiseBlocks(this.app.models, id, intervals)
      .then(([blockId0, blockId1]) => {
        let db = this.dataSource.connector;
        /** @return cursor */
        function dbLookup() {
          let cursor =
            pathsAggr.pathsDirect(db, blockId0, blockId1, intervals);
          return cursor;
        };
        let
          cacheId = blockId0 + '_' + blockId1,
        /** see comment in pathsProgressive() */
        useCache = ! intervals.dbPathFilter,
        apiOptions = { useCache };
        reqStream(dbLookup, pathsFilter.filterPaths, cacheId, intervals, req, res, apiOptions);
      });
  };

  /*--------------------------------------------------------------------------*/

  /**
   * @see pathsProgressive()
   * @param blockIds  array[2] of blockIds
   */
  Block.pathsAliasesProgressive = function(blockIds, intervals, options, res, cb) {
    let [left, right] = blockIds;
    console.log('pathsAliasesProgressive', left, right, intervals /*, options, cb*/);
    let cacheId = [left, right].map((b) => blockLocalId(b)).join('_'),
    /** if filtering in db query then don't use cache;  that applies now that pathsAliases() is defined.
     * also refn comment in @see pathsProgressive() */
    useCache = ! use_dbLookupAliases || ! intervals.dbPathFilter,
    /** filterPathsAliases() is not yet adapted to handle results of pathsAliases() */
    dbPathFilter = use_dbLookupAliases,
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
      if (use_dbLookupAliases) {
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
   * @return promise yielding an array of records
   */
  Block.blockGet = function(blockIds) {
    let models = this.app.models;
    let promise =  models.Block.find({where: {id: {inq: blockIds}}} /*,options*/).then(blocks => {
      return  blocks.map(blockR => {
        let block = blockR.__data;
        // this trace can cause warning about deprecated .inspect() in node 10.
        // console.log('blockGet then map', block.id || block || blockR);
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
    if (trace_block > 1)
      console.log('blockRecordsStore', blockId, record);
    this.blockRecords[blockId] = record;
  };
  /** this could be called if an API was added which allowed Block .namespace to change. */
  Block.blockRecordsOutdate = function (blockIds) {
    blockIds.forEach(blockId => delete this.blockRecords[blockId] );
  };

  /** If local blockId is not loaded, load it.
   * @param blockId local blockId, i.e. a string
   * @return block record
   */
  Block.blockRecordValue = async function(blockId) {
    let block = this.blockRecords[blockId] ||
      this.blockGet([blockId])
      // expecting just 1 matching document
      .then((blocks) => blocks[0]);
    return block;
  };

  /** @param blockId may be a local (string db id) or remote reference
   * @desc Lookup the block object.
   * @return promise yielding a block object
   */
  Block.blockRecordLookup = function(blockId) {
    let block;
    if (typeof blockId === 'string') {
      block = this.blockRecordValue(blockId);
    } else {
      let apiServer = blockServer(blockId);
      block = apiServer.datasetAndBlock(blockId.blockId)
        .then((datasetBlock) => datasetBlock.block);
    }
    if (trace_block > 2)
      block.then((blockR) => console.log('blockRecordLookup', blockId, blockR));
    return block;
  };

  /*--------------------------------------------------------------------------*/

  /** @return promise yielding [block, dataset]
   * @desc
   * related : apiServer.datasetAndBlock()
   */
  Block.blockDatasetLookup = function(id, options) {
    const fnName = 'blockDatasetLookup';
    let
    promise = 
      this.blockRecordLookup(id)
      .then((block) => {
        if (! block) {
          const errorText = ' Block ' + id + ' not found. ' + fnName;
          throw new ErrorStatus(400, errorText);
        } else {
          const models = this.app.models;
          const
          datasetP =
            models.Dataset.findById(block.datasetId, {}, options)
            .then(dataset => {
              if (! dataset) {
                const errorText = 'Dataset ' + block.datasetId + ' not found for Block ' + id + '. ' + fnName;
                throw new ErrorStatus(400, errorText);
              } else {
                return [block, dataset];
              }
            });
          return datasetP;
        }
        /** each case above either throws or returns, so this is unreachable.   */
        return null;
      });

    return promise;
  };
              

  //----------------------------------------------------------------------------

  /** @return promise yielding [dataset]
   * @desc
   * related : blockDatasetLookup()
   */
  Block.datasetLookup = function(datasetId, options) {
    const fnName = 'datasetLookup';

    const models = this.app.models;
    const
    datasetP =
      models.Dataset.findById(datasetId, {}, options)
      .then(dataset => {
        if (! dataset) {
          const errorText = 'Dataset ' + datasetId + ' not found. ' + fnName;
          throw new ErrorStatus(400, errorText);
        } else {
          return [dataset];
        }
      });
    return datasetP;
  };

  //----------------------------------------------------------------------------

  /** Lookup .namespace for the given blockIds.  Cached values are used if
   * available, since this is used in the high-use pathsaliases() api, and we
   * don't yet have an api for altering .namespace.
   *
   * @param blockIds  array of blocks for which to get .namespace
   * @return promise, yielding an array of namespaces (strings)
   */
  Block.blockNamespace = async function(blockIds) {
    /** Use cached values if all required values are cached. */
    let n = blockIds.map(blockId =>  {
      return this.blockRecordLookup(blockId)
        .then((block) => { if (!block || !block.namespace) {
          // block.namespace may be "", and !"" is true.  return undefined for this.
          console.log('blockNamespace', blockId, block, blockIds); 
          if (! block) { debugger; }; return undefined; } else { return block.namespace;}; });
    });
    n = Promise.all(n);
    // check for undefined block.namespace
    n.then((namespaces) => {
      let i = namespaces.indexOf(undefined);
      if (i >= 0) {
        console.log('blockNamespace', blockIds[i]);
      }
    });
    return n;
  };

  /**
   * @return promise yielding a cursor or an empty Readable (in the case of blockId without a namespace);
   * both have the .pipe() required by pipeStream().
   */
  Block.dbLookupAliases = async function(blockId0, blockId1, intervals) {
    let namespaces = await this.blockNamespace([blockId0, blockId1]),
    /** block may be missing a namespace, e.g. if uploaded from CSV, .namespace will be ""
     */
    namespacesFiltered = namespaces.filter((n) => (n !== undefined) && (n !== "")),
    cursor;
    if (namespacesFiltered.length < 2) {
      console.log('dbLookupAliases() : block without namespace', namespaces, blockId0, blockId1);
      /** returning an empty cursor would be reasonable; could construct one
       * using an empty search - there may not be an easier way.
       * Returning an empty iterator, e.g. cursor = [][Symbol.iterator]();
       * is not sufficient because pipeStream() uses cursor.pipe().
       * Try returning a empty Readable, which has .pipe(), similar to
       * aliasesCursor() but with an empty array, i.e. :
       */
      let readable = new Readable({objectMode:true});
      readable.push(null);
      cursor = readable;
    } else
    /* Request aliases matching namespaces[] from the secondary, copy them into
     * the local db, then perform the pathsAliases query and return a cursor of
     * the result.
     * If namespacesFiltered.length < 2, the remote request will return [], then
     * the local query will return [].  Which is not efficient, so the
     * block.namespace should be checked earlier.
     */
    {
      let db = this.dataSource.connector;
      cursor =
        pathsAggr.pathsAliasesRemote(db, this.app.models, blockId0, blockId1, namespaces[0],  namespaces[1], intervals);
    }
    console.log('dbLookupAliases', namespaces);
    return cursor;
  };
  /** Similar function to dbLookupAliases(), except whereas that uses mongoDb
   * aggregation queries to collate paths, this function uses a javascript
   * function internal to the backend node API server.
   * Support for multiple backends has not been added to this function.
   */
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
    /* The query param for blockIds may be e.g. (url-decoded) :
     *  &blockIds[0][blockId]=5b7f8afd43a181430b81394d
     *  &blockIds[0][host]=https://..
     *  &blockIds[0][token]=...
     *  &blockIds[]=5cc69ed7de8ab9393f45052c
     * which seems reasonable, but this is resulting in blockIds[] :
     *  0:
     *   5cc69ed7de8ab9393f45052c: true
     *   blockId: "5b7f8afd43a181430b81394d"
     *   host: "https://..."
     *   token: "..."
     * Using qs gets the desired result.
     */
    if (blockIds.length === 1) {
      let parsed = qs.parse(req.originalUrl);
      if (parsed.blockIds.length === 2) {
        console.log('Block.pathsAliasesViaStream', 'using qs for blockIds', blockIds, parsed.blockIds, req.originalUrl);
        blockIds = parsed.blockIds;
      }
    }

    let me = this;

    /**
     * @return promise yielding a cursor or Readable (in the case of apiLookupAliases());
     * both have the .pipe() required by pipeStream().
     */
    function aliasesCursor() {
      let cursor;
      if (use_dbLookupAliases) {
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
     cacheId = blockIds.map((b) => blockLocalId(b)).join('_'),
    /** see comment in pathsProgressive() */
    useCache = ! intervals.dbPathFilter,
    /** pathsAliases() does filter, and filterPathsAliases() is not yet adapted to handle results of pathsAliases() */
    dbPathFilter = use_dbLookupAliases,
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
   * @param cursorFunction  function returning a cursor or a promise yielding a cursor
   */
  function reqStream(cursorFunction, filterFunction, cacheId, intervals, req, res, apiOptions) {
    /* The params of reqStream() are largely passed to pipeStream() - starting to look like a class. */

    let startTime = process.hrtime();

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
      function logClose(label, ) {
      /* absolute time : new Date().toISOString() */
      console.log(
        label, 'reqStream', 
        'The request processing time is', elapsedMs(startTime, 3), 'ms.', 'for', req.path, cacheId);
      }
      logClose('req.on(close)');

      // console.log('req.on(close)');
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
                // c.destroy();
                /* maybe : */
                c.destroy(/*err*/null, function () {
                  logClose('cursor destroyed'); });
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
            });
          }
          else
            closeCursor(cursor);
          function closeCursor(cursor) {
            cursor.close(function () {
              logClose('cursor closed'); });
          }
        }
      }
    });

  };

  /** Logically part of reqStream(), but split out so that it can be called
   * directly or via a promise. */
  function pipeStream(sse, intervals, useCache, cacheId, filterFunction, res, cursor) {
      if (trace_block > 2) {
        console.log('pipeStream', sse, intervals, useCache, cacheId);
      }
      if (useCache)
        cursor.
        pipe(new pathsStream.CacheWritable(/*cache,*/ cacheId));

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
  let
    fnName = 'blockFeaturesCount',
    cacheId = fnName + '_' + blockIds.join('_'),
    result = cache.get(cacheId);
    if (result) {
      if (trace_block > 1) {
        console.log(fnName, cacheId, 'get', result[0] || result);
      }
      cb(null, result);
    } else {
    let db = this.dataSource.connector;
    let cursor =
      blockFeatures.blockFeaturesCount(db, blockIds);
    cursor.toArray()
    .then(function(featureCounts) {
      if (trace_block > 1) {
        console.log(fnName, cacheId, 'get', featureCounts[0] || featureCounts);
      }
      cache.put(cacheId, featureCounts);
      cb(null, featureCounts);
    }).catch(function(err) {
      cb(err);
    });
    }
  };

  /*--------------------------------------------------------------------------*/

   /** Send a database request to collate feature counts in bins for the given block.
   *
   * @param id  blockId, named id for access check
   * @param nBins number of bins to partition the block's features into
   * @param interval  undefined or range of locations of features to count
   * @param isZoomed  true means interval should be used to constrain the location of counted features.
   * @param useBucketAuto default false, which means $bucket with
   * boundaries calculated from interval and nBins; otherwise use
   * $bucketAuto.
   * @param userOptions user settings : {
   *   mafThreshold, snpPolymorphismFilter, featureCallRateThreshold,
   *   minAlleles, maxAlleles, typeSNP}
   * @param options loopback options
   */
  Block.blockFeaturesCounts = function(id, interval, nBins, isZoomed, useBucketAuto, userOptions, options, res, cb) {

    const snpFilterfieldNames = [
      'snpPolymorphismFilter', 'mafThreshold', 'featureCallRateThreshold',
      'minAlleles', 'maxAlleles', 'typeSNP',
    ];
    if (userOptions) {
      /** parseBooleanFields() parses values which are represented as strings,
       * including Boolean and numeric values */
      parseBooleanFields(userOptions, snpFilterfieldNames);
    }

  let
    fnName = 'blockFeaturesCounts',
    blockId = id, 
    /** when a block is viewed, it is not zoomed (the interval is the
     * whole domain); this request recurs often and is worth caching,
     * but when zoomed in there is no repeatability so result is not
     * cached.  Zoomed results could be collated in an interval tree,
     * and used when they satisfied one end of a requested interval,
     * i.e. just the new part would be queried.
     */
    useCache = ! isZoomed || ! interval,
    cacheIdOptions = ! userOptions ? '' : Object.entries(userOptions)
      .reduce((result, [name, value]) => {
        /** The SNP filter fields (snpFilterfieldNames) are optional; map
         * undefined or null to '', to avoid the cacheId being ambiguous.
         */
        if (snpFilterfieldNames.includes(name)) {
          result += '_' + (value ?? '');
        }
        return result;
      }, ''),
    cacheId = fnName + '_' + blockId + '_' + nBins +  '_' + useBucketAuto + cacheIdOptions,
    /** set this false to test without reading existing cache */
    readCache = true,
    result = readCache && useCache && cache.get(cacheId);
    if (result) {
      if (trace_block > 1) {
        console.log(fnName, cacheId, 'get', result[0]);
      }
      cb(null, result);
    } else {
      this.blockDatasetLookup(id, options)
        .then(blockDatasetFeatureCounts.bind(this))
        .catch(cb);

      function blockDatasetFeatureCounts([block, dataset]) {
        if (dataset.tags?.includes('VCF')) {
          /** wrap cb to store the result in cache. */
          function cacheCb(error, result2) {
            if (result2 && useCache) {
                cachePut(result2);
            }
            cb(error, result2);
          }
          vcfGenotypeFeaturesCounts(block, interval, nBins, isZoomed, userOptions, cacheCb);
        } else if (dataset.tags?.includes('Germinate')) {
          console.log(fnName, 'not yet implemented for', dataset.tags);
        } else {
          let db = this.dataSource.connector;
          let cursor =
              blockFeatures.blockFeaturesCounts(db, blockId, interval, nBins, isZoomed, useBucketAuto);
          cursor.toArray()
            .then(function(featureCounts) {
              if (useCache) {
                cachePut(featureCounts);
              }
              cb(null, featureCounts);
            }).catch(function(err) {
              cb(err);
            });
        }
      }

      function cachePut(featureCounts) {
        if (trace_block > 1) {
          console.log(fnName, cacheId, 'put', featureCounts[0]);
        }
        cache.put(cacheId, featureCounts);
      }

    }

  };

  //------------------------------------------------------------------------------


  /** Report on the status of collated feature counts for the given
   * block, or all blocks if id is undefined.
   *
   * The Pretzel client passes useBucketAuto===undefined; the user may
   * vary nBins in which case they can repeat this request.
   *
   * @param id  optional blockId string
   * @param nBins number of bins to partition the block's features into
   * @param useBucketAuto default false. @see blockFeaturesCounts()
   * @param options loopback options
   */
  Block.blocksFeaturesCountsStatus = function(id, nBins, useBucketAuto, options, res, cb) {
    const
    fnName = 'blocksFeaturesCountsStatus',
    blockIdsP = id ? Promise.resolve([id]) :
      Block.find().then(blocks => blocks.map(block => block.id)),
    result = blockIdsP.then(blockIds => blockIds.map(
      id => this.blockFeaturesCountsStatus(id, nBins, useBucketAuto)));
    result.then(blocksStatus => cb(null, blocksStatus));
  };
  /**
   * 
   * @param id  blockId string
   * @param nBins see description in blocksFeaturesCountsStatus()
   * @param useBucketAuto   see description in blocksFeaturesCountsStatus()
   * @return [id, status] status is currently the sum of counts, i.e. total features in block.
   */
  Block.blockFeaturesCountsStatus = function(id, nBins, useBucketAuto) {
    const
    fnName = 'blockFeaturesCountsStatus',
    blockId = id,
    /** @see Block.blockFeaturesCounts()
     * @desc
     * which constructs cacheIdOptions; in this case mafThreshold and
     * snpPolymorphismFilter are undefined.
     */
    cacheIdOptions = '',
    cacheFnName = 'blockFeaturesCounts',
    cacheId = cacheFnName + '_' + blockId + '_' + nBins +  '_' + useBucketAuto + cacheIdOptions,
    counts = cache.get(cacheId),
    countSum = counts?.reduce((sum, c) => sum += c.count, 0);
    return [blockId, countSum];
  };



  /*--------------------------------------------------------------------------*/

  /** Send a database request to collate feature value limits (max and min) for all blocks.
   * @param blockId  undefined (meaning all blocks) or id of 1 block to find min/max for
   */
  Block.blockFeatureLimits = function(blockId, options, res, cb) {
  let
    fnName = 'blockFeatureLimits',
    cacheId = fnName + '_' + blockId,
    result = cache.get(cacheId);
    if (result) {
      if (trace_block > 1) {
        console.log(fnName, cacheId, 'get', result[0] || result);
      }
      cb(null, result);
    } else {

    let db = this.dataSource.connector;
    let cursor =
      blockFeatures.blockFeatureLimits(db, blockId);
    cursor.toArray()
    .then(function(limits) {
      if (trace_block > 1) {
        console.log(fnName, cacheId, 'put', limits[0] || limits);
      }
      cache.put(cacheId, limits);
      cb(null, limits);
    }).catch(function(err) {
      console.log(fnName, blockId, err.toString(), cursor?.length);
      cb(err);
    });
    }
  };

  /*--------------------------------------------------------------------------*/

  /** Send a database request to collate feature values.Traits for all blocks of QTL datasets.
   * @param fieldName 'Trait' or 'Ontology'
   */
  Block.blockValues = function(fieldName, options, res, cb) {
    let
    fnName = 'blockValues',
    paramError;
    switch (fieldName) {
      case 'Trait' :
      case 'Ontology' :
      break;
    default : 
      paramError = 'invalid fieldName'; //  "' + fieldName + '"';
      fieldName = null;
      break;
    }

    let
    /** this cacheId is also calculated in utilities/block-features.js : blockFeaturesCacheClear() */
    cacheId = fnName + '_' + fieldName,
    result; // switch off cache - may need cache per user. //  = cache.get(cacheId);
    if (paramError) {
      cb(paramError);
    } else
    if (result) {
      if (trace_block > 1) {
        console.log(fnName, cacheId, 'get', result[0] || result);
      }
      cb(null, result);
    } else {

    let db = this.dataSource.connector;
    blockFeatures.blockValues(db, fieldName)
    .then((cursor) => cursor.toArray())
    .then(function(traits) {
      if (trace_block > 1) {
        console.log(fnName, cacheId, 'put', traits[0] || traits);
      }
      cache.put(cacheId, traits);
      cb(null, traits);
    }).catch(function(err) {
      cb(err);
    });
    }
  };


  /*--------------------------------------------------------------------------*/

  /** Collate from the database a list of features within the given block, which
   * meet the optional interval domain constraint.
   *
   * @param id  blockId, for access check
   */
  Block.blockFeaturesInterval = function(id, intervals, options, res, cb) {
    // based on Block.pathsProgressive(); there is similarity which could be
    // factored into a mixin, which may be relevant to factoring this with
    // streaming equivalent (not yet added).

      let db = this.dataSource.connector;
    const apiName = 'blockFeaturesInterval';
    console.log(apiName, /*db,*/ id, intervals, intervals.dbPathFilter /*, options, cb*/);
    let cacheId = apiName + '_' + id,
    /** If intervals.dbPathFilter, we could append the location filter to cacheId,
     * but it is not clear yet whether that would perform better.
     * e.g. filterId = intervals.dbPathFilter ? '_' + intervals.axes[0].domain[0] + '_' + ... : ''
     * So cache is not used if dbPathFilter.
     */
    useCache = ! intervals.dbPathFilter,
    cached = cache.get(cacheId);
    if (useCache && cached) {
      if (trace_block > 1) {
        console.log(apiName, cacheId, 'get', cached.length || cached);
      }
      let filteredData = pathsFilter.filterFeatures(cached, intervals);
      cb(null, filteredData);
    }
    else {
      let cursor =
        pathsAggr.blockFeaturesInterval(db, [id], intervals);
      cursor.toArray()
        .then(function(data) {
          console.log(apiName, ' then', (data.length > 2) ? data.length : data);
          if (useCache) {
            cache.put(cacheId, data);
            if (trace_block > 1) {
              console.log(apiName, cacheId, 'put', data.length || data);
            }
          }

          let filteredData;
          // no filter required when user has nominated nSamples.
          if (intervals.nSamples)
            filteredData = data;
          else
            filteredData = pathsFilter.filterFeatures(data, intervals);
          if (trace_block > 1)
            console.log("Num Filtered Features => ", filteredData.length);
          cb(null, filteredData);
        })
        .catch(function(err) {
          console.log('ERROR', err);
          cb(err);
        });
    }
  };

  /*--------------------------------------------------------------------------*/

  /**
   * @param id  blockIds : aka [blockA, blockB]
   */
  Block.pathsByReference = function(id, referenceGenome, maxDistance, options, cb) {
    task.pathsViaLookupReference(this.app.models, id[0], id[1], referenceGenome, maxDistance, options)
    .then(function(paths) {
      cb(null, paths);
    }).catch(function(err) {
      cb(err);
    });
  }
  
  /*--------------------------------------------------------------------------*/

  /** If Block instance does not have a .name, set it from either .scope or .namespace.
   */
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

  let argsDebounce = new ArgsDebounce();
  /** Clear result cache entries which may be invalidated by the save.
   */
  Block.observe('after save', function(ctx, next) {
    if (ctx.instance) {
      let blockId = ctx.instance.id;
      if (trace_block > 3) {
        // this may trace for each feature when e.g. adding a dataset with table/csv upload
        console.log('Block', 'after save',  ctx.instance.id, ctx.instance.name, blockId);
      }
      argsDebounce.debounced(blockAfterSave, blockId, 1000)();
    }
    next();
  });

  function blockAfterSave(blockId) {
      const apiName = 'blockFeaturesInterval';
      const blockIds = [blockId],
            cacheId = apiName + '_' + blockIds.join('_');
      let value = cache.get(cacheId);
      if (value) {
        console.log(apiName, 'remove from cache', cacheId, value.length || value);
        cache.put(cacheId, undefined);
      }
    blockFeatures.blockFeaturesCacheClear(cache);
  }


  //----------------------------------------------------------------------------
  // When adding a API .remoteMethod() here, also add the route name to backend/server/boot/access.js : genericResolver()
  //----------------------------------------------------------------------------

  Block.remoteMethod('blockFeaturesAdd', {
    accepts: [
      {arg: 'data', type: 'object', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"},
    ],
    returns: {arg: 'status', type: 'string'},
    description: "Append the features in data to the given block"
  });

  Block.remoteMethod('blockFeaturesCount', {
    accepts: [
      {arg: 'blocks', type: 'array', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Return a count of the Features in each block"
  });

  Block.remoteMethod('blockFeaturesCounts', {
    accepts: [
      {arg: 'id', type: 'string', required: true},  // was : block
      {arg: 'interval', type: 'array', required: false},
      {arg: 'nBins', type: 'number', required: false},
      {arg: 'isZoomed', type: 'boolean', required: false, default : 'false'},
      {arg: 'useBucketAuto', type: 'boolean', required: false, default : 'false'},
      {arg: 'userOptions', type: 'object', required: false},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}},
    ],
    /** refn : https://loopback.io/doc/en/lb3/Remote-methods.html#advanced-use
     * mixing ':id' into the rest url allows $owner to be determined and used for access control
     */
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns an array of N bins of counts of the Features in the block"
  });

  Block.remoteMethod('blocksFeaturesCountsStatus', {
    accepts: [
      {arg: 'id', type: 'string', required: false},  // block reference, optional
      {arg: 'nBins', type: 'number', required: false},
      {arg: 'useBucketAuto', type: 'boolean', required: false, default : 'false'},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns an array of blocks with the status of their cached featuresCounts."
  });

  Block.remoteMethod('blockFeatureLimits', {
    accepts: [
      {arg: 'id', type: 'string', required: false},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns an array of blocks with their min&max Feature values."
  });

  Block.remoteMethod('blockValues', {
    accepts: [
      // could add optional param blocks
      {arg: 'fieldName', type: 'string', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns an array of blocks of QTL datasets, with their Feature Trait values."
  });


  Block.remoteMethod('blockFeaturesInterval', {
    accepts: [
      {arg: 'id', type: 'string', required: true},
      {arg: 'intervals', type: 'object', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: 'res', type: 'object', 'http': {source: 'res'}},
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
    description: "Returns Features of the block, within the interval optionally given in parameters, and filtering also for range / resolution"
  });

  //----------------------------------------------------------------------------

  Block.remoteMethod('paths', {
    accepts: [
      {arg: 'id', type: 'array', required: true}, // array[2] block references
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
      {arg: 'id', type: 'array', required: true},
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
      {arg: 'id', type: 'array', required: true},
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
      {arg: 'id', type: 'array', required: true},
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
      {arg: 'id', type: 'array', required: true}, // blockIds
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
      {arg: 'id', type: 'array', required: true}, // blockIds
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
      // blockRemoteType is relevant here also; would require corresponding change in server function.
      {arg: '0', type: 'string', required: true}, // block reference
      {arg: '1', type: 'string', required: true}, // block reference
      {arg: 'threshold-size', type: 'string', required: false}, // block reference
      {arg: 'threshold-continuity', type: 'string', required: false}, // block reference
    ],
    returns: {type: 'array', root: true},
    description: "Request syntenic blocks for left and right blocks"
  });

  /*--------------------------------------------------------------------------*/

  // ---------------------------------------------------------------------------

  Block.dnaSequenceLookup = function(parent, region, cb) {
    childProcess(
      'dnaSequenceLookup.bash',
      /* postData */ '', 
      /* useFile */ false,
      /* fileName */ undefined,
      /* moreParams */ [parent, region],
      dataOutReply, cb, /*progressive*/ false);

    let chunks = [];
    /** Receive the results from the child process.
     * @param chunk is a Buffer
     * null / undefined indicates child process closed with status 0 (OK) and sent no output.
     * @param cb is cbWrap of cb passed to dnaSequenceLookup().
     */
    function dataOutReply(chunk, cb) {
      /** based on searchDataOut() */
      if (! chunk) {
        // chunks is []
        cb(null, chunks);
      } else
      if (chunk && (chunk.length >= 6) && (chunk.asciiSlice(0,6) === 'Error:')) {
        cb(new ErrorStatus(400, chunk.toString()));
      } else {
        // chunks.push(chunk)
        cb(null, chunk.toString());
      }
    };

  };

  Block.remoteMethod('dnaSequenceLookup', {
    accepts: [
      {arg: 'parent', type: 'string', required: true},
      {arg: 'region', type: 'string', required: true},
    ],
    http: {verb: 'get'},
    returns: {arg: 'sequence', type: 'string'},
    description: "DNA Sequence Lookup e.g. samtools faidx, returns nucleotide sequence output as text string"
  });

  // ---------------------------------------------------------------------------

  /**
   * @param id  blockId.  block.scope === scope, and block.datasetId === datasetId
   * @param datasetId  name of parent or view dataset, or vcf directory name
   * @param scope e.g. '1A'; identifies the vcf file, i.e. datasetId/scope.vcf.gz
   */
  Block.genotypeSamples = function(id, datasetId, scope, options, cb) {
    const fnName = 'genotypeSamples';
    {
      this.blockDatasetLookup(id, options)
        .then(samples.bind(this));

      function samples([block, dataset]) {
        if (dataset.tags?.includes('VCF')) {
          this.vcfGenotypeSamples(datasetId, scope, cb);
        } else if (dataset.tags?.includes('Germinate')) {
          this.germinateGenotypeSamples(datasetId, scope, cb);
        } else {
          console.log(fnName, 'applicable to Genotype, not', dataset.tags, datasetId);
        }
      }
    }
  };

  Block.vcfGenotypeSamples = function(datasetId, scope, cb) {
    const fnName = 'vcfGenotypeSamples';

    childProcess(
      'vcfGenotypeLookup.bash',
      /* postData */ '', 
      /* useFile */ false,
      /* fileName */ undefined,
      /* moreParams */ ['query', datasetId, scope, /*isecFlags*/ '', /*isecDatasetIds*/'', /*preArgs*/ '-l'],
      dataOutReplyClosure(cb), cb, /*progressive*/ false);

  };

  Block.germinateGenotypeSamples = function(datasetId, scope, cb) {
    const fnName = 'germinateGenotypeSamples';
    germinateGenotypeSamples(datasetId, scope, cb);
  };

  Block.remoteMethod('genotypeSamples', {
    accepts: [
      {arg: 'id', type: 'string', required: true},
      {arg: 'datasetId', type: 'string', required: true},
      {arg: 'scope', type: 'string', required: true},
      {arg: 'options', type: 'object', http: 'optionsFromRequest'},
    ],
    http: {verb: 'get'},
    returns: {arg: 'text', type: 'string'},
    description: "VCF genotype Samples e.g. samtools bcftools, returns list of samples defined in .vcf TSV table as text string"
  });

  // ---------------------------------------------------------------------------

  /**
   * @param datasetId  name of VCF / Genotype / view dataset, or vcf directory name
   * @param scope e.g. '1A'; identifies the vcf file, i.e. datasetId/scope.vcf.gz
   * Could pass blockId instead  of datasetId and scope.
   * @param nLines if defined, limit the output to nLines.
   * @param preArgs args to be inserted in command line, additional to the vcf file name.
   * See comment in frontend/app/services/auth.js : vcfGenotypeLookup()
   */
  Block.vcfGenotypeLookup = function(datasetId, scope, preArgs, nLines, options, cb) {
    const
    fnName = 'vcfGenotypeLookup';

    parseBooleanFields(preArgs, ['snpPolymorphismFilter', 'requestSamplesAll', 'requestInfo', 'headerOnly', 'mafUpper']);

    /** Caching is generally not applicable to this request, because the region
     * / interval is always present - when zoomed out only the features counts
     * will be used.
     * The sample names request genotypeSamples() could be cached.
     * Possibly requests for dataset intersection wil be small enough to cache
     * - leaving indentation room for this.
     * Based on blockFeaturesCounts(), blockDatasetFeatureCounts() above.
     */
    {
      this.datasetLookup(datasetId, options)
        .then(genotypeLookup.bind(this));

      function genotypeLookup([dataset]) {
        if (dataset.tags?.includes('VCF')) {
          vcfGenotypeLookup(datasetId, scope, preArgs, nLines, undefined, cb);
        } else if (dataset.tags?.includes('Germinate')) {
          ensureSamplesParam(preArgs).then(
            preArgs => germinateGenotypeLookup(datasetId, scope, preArgs, nLines, undefined, cb))
            .catch(cb);
        } else {
          console.log(fnName, 'applicable to Genotype, not', dataset.tags, datasetId);
        }
      }

      /** Ensure that preArgs.samples is defined : if undefined, request samples
       * and use the first one.  */
      function ensureSamplesParam(preArgs) {
        let argsP;
        if (! preArgs?.samples?.length) {
          argsP = germinateGenotypeSamplesP(datasetId, scope)
            .then(samples => {
              let sample;
              if (samples.length) {
                sample = samples[0];
              } else {
                sample = '';
              }
              // could use Object.assign() to avoid mutating preArgs.
              preArgs.samples = sample;
              return preArgs;
            });
        } else {
          argsP = Promise.resolve(preArgs);
        }
        return argsP;
      }
    }
  };

  /** POST version of Feature.search, which is addressed by verb GET.
   */
  Block.vcfGenotypeLookupPost = Block.vcfGenotypeLookup;

  const vcfGenotypeLookupOptions = {
    accepts: [
      {arg: 'datasetId', type: 'string', required: true},
      {arg: 'scope', type: 'string', required: true},
      {arg: 'preArgs', type: 'object', required: false},
      {arg: 'nLines', type: 'number', required: false},
      {arg: "options", type: "object", http: "optionsFromRequest"},
    ],
    http: {verb: 'get'},
    returns: {arg: 'text', type: 'string'},
    description: "VCF genotype Lookup e.g. samtools bcftools, returns subset of .vcf TSV table as text string"
  };
  Block.remoteMethod('vcfGenotypeLookup', vcfGenotypeLookupOptions);

  const vcfGenotypeLookupPostOptions = Object.assign({}, vcfGenotypeLookupOptions);
  // or delete vcfGenotypeLookupPostOptions.http, because 'post' is default for http.verb
  vcfGenotypeLookupPostOptions.http = {verb: 'post'};
  Block.remoteMethod('vcfGenotypeLookupPost', vcfGenotypeLookupPostOptions);


  // ---------------------------------------------------------------------------

  Block.cacheClearKey = function(cacheId, cb) {
    /** cacheId could be : pre + id + post,
     * with params : id, pre, post.
     * This would check that the user session had permission for the block.
     */
    const value = blockFeatures.cacheClearKey(cache, cacheId);
    cb(null, value);
  };

  const cacheClearKeyOptions = {
    accepts: [
      {arg: 'cacheId', type: 'string', required: true},
    ],
    http: {verb: 'get'},
    returns: {arg: 'result', type: 'object'},
    description: "Clear cached result for given cacheId and return the removed result."
  };
  Block.remoteMethod('cacheClearKey', cacheClearKeyOptions);


  //----------------------------------------------------------------------------


  acl.assignRulesRecord(Block)
  acl.limitRemoteMethods(Block)
  acl.limitRemoteMethodsSubrecord(Block)
  acl.limitRemoteMethodsRelated(Block)
};
