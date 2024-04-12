'use strict';

/*----------------------------------------------------------------------------*/

const Queue = require('promise-queue');


/*----------------------------------------------------------------------------*/

/* global module */
/* global require */
/* global process */

var acl = require('../utilities/acl')
const { childProcess } = require('../utilities/child-process');
var upload = require('../utilities/upload');
var { filterBlastResults } = require('../utilities/sequence-search');
var blockFeatures = require('../utilities/block-features');
const { ArgsDebounce } = require('../utilities/debounce-args');

const cacheLibraryName = '../utilities/results-cache';
var cache = require(cacheLibraryName);

/*----------------------------------------------------------------------------*/

const trace = 1;


/*----------------------------------------------------------------------------*/

const sequenceSearchQueue = new Queue(/*concurrency:*/ 1);

/*----------------------------------------------------------------------------*/

/** ids of sessions which have sent request : dnaSequenceSearch */
var sessionIds=[];

/** Map session ID (accessToken.id) to a small integer index.
 */
function sessionIndex(sessionId) {
  let index = sessionIds.indexOf(sessionId);
  if (index === -1) {
    sessionIds.push(sessionId);
    index = sessionIds.length - 1;
  }
  return index;
}


/*----------------------------------------------------------------------------*/

module.exports = function(Feature) {

  /*--------------------------------------------------------------------------*/

  let argsDebounce = new ArgsDebounce();

  /** Clear result cache entries which may be invalidated by the save.
   */
  Feature.observe(
    'after save',
    (ctx, next) => {
      if (ctx.instance) {
        let blockId = ctx.instance.blockId;
        if (trace > 3) {
          console.log('Feature', 'after save',  ctx.instance.id, ctx.instance.name, blockId);
        }
        argsDebounce.debounced(featureAfterSave, blockId, 1000)();
        next();
      }
    });

  /** identical to blockAfterSave()
   */
  function featureAfterSave(blockId) {
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

  /*--------------------------------------------------------------------------*/



  /** Search for Features matching the given list of Feature names in filter[].
   * If blockId is given, only search within that block.
   */
  Feature.search = function(blockId, filter, options, cb) {
    let where = {
          "name":
          {
            "inq": filter
          }
        };
    if (blockId) {
      where.blockId = blockId;
    }
    Feature.find({
        "include": 
        {
          "block": "dataset"
        },
        where
    }, options).then(function(features) {
      // filter out the features for which the user doesn't have access to the dataset
      features = features.filter(function(feature) {
        return feature.__data.block.__data.dataset
      })
      return process.nextTick(() => cb(null, features))
    })
  };
  /** POST version of Feature.search, which is addressed by verb GET.
   */
  Feature.searchPost = Feature.search;

  /*--------------------------------------------------------------------------*/

  /** Search for Aliases matching the given list of Feature names,
   * then search for Features matching the Feature names or Aliases.
   */
  Feature.aliasSearch = function(featureNames, options, cb) {
    const fnName = 'aliasSearch';
    let aliasesP = Feature.app.models.Alias.stringSearch(featureNames);
    aliasesP
      .toArray()
      .then((aliases) => {
      let aliasNames = aliases.reduce((result, a) => {
        result.push(a.string1);
        result.push(a.string2);
        return result;
      }, []);
      let aliasAndFeatureNames = featureNames.concat(aliasNames);
        let featuresP = Feature.search(/*blockId*/undefined, aliasAndFeatureNames, options, searchCb);
        function searchCb(err, features) {
          if (err) {
            console.log(fnName, 'ERROR', err, featureNames.length || featureNames);
            cb(err);
          } else {
            let fa = {aliases, features};
            cb(null, fa);
          }
        };
      });
  };

  /*--------------------------------------------------------------------------*/

  Feature.depthSearch = function(blockId, depth, options, cb) {
    let include_n_level_features = function(includes, n) {
      if (n < 1) {
        return includes;
      }
      return include_n_level_features({'features': includes}, n-1);
    }

    Feature.find({
      "where": {
        "blockId": blockId,
        "parentId": null
      },
      'include': include_n_level_features({}, depth)
    }, options).then(function(features) {
      return process.nextTick(() => cb(null, features));
    });
  };

  /*--------------------------------------------------------------------------*/

  /**
   * @param data contains :
   * @param dnaSequence FASTA format for Blast; text string input for other searchType-s, e.g. string "atgcn..."
   * @param parent  datasetId of parent / reference of the blast db which is to be searched
   * @param searchType 'blast'
   * @param resultRows
   * @param addDataset
   * @param datasetName
   * @param minLengthOfHit, minPercentIdentity, minPercentCoverage : minimum values to filter results
   * @param options
   *
   * @param cb node response callback
   *
   * The frontend component panel/sequence-search offers selection of datasets with the tag BlastDb (refn datasetsToSearch() in frontend/app/components/panel/sequence-search.js) 
   * and will send a request via auth.dnaSequenceSearch() :
   *   dnaSequenceSearch(
   *     apiServer, dnaSequence, parent, searchType, resultRows, addDataset, datasetName,
   *     minLengthOfHit, minPercentIdentity, minPercentCoverage,
   *     options
   *   )
   * 
   * This is received by Feature.dnaSequenceSearch() in pretzel/lb4app/lb3app/common/models/feature.js, which sends the request via childProcess('dnaSequenceSearch.bash', ). It also has the capability to upload the result to mongoDb via upload.uploadParsedTryCb()
   * It forwards requests via a queue with concurrency of 1 (sequenceSearchQueue), so that just 1 blastn is executed at a time; running multiple blast-s multiplies the memory use and can log-jam with even small numbers of requests (depending on available memory).
   * 
   * The script pretzel/lb4app/lb3app/scripts/dnaSequenceSearch.bash recognises when it is running in a container and configures to use : blastn=$resourcesDir/blastn_request.bash
   * Alternately blastn is used directly, which is used in development, or when running pretzel directly.
   * 
   * pretzel/lb4app/lb3app/scripts/blastn_request.bash uses curl to post the request to blastnUrl=http://$hostIp:4000/commands/blastn
   * which replies with a URL to watch for a result, which is retrieved with curl. This result is asynchronous, to allow for the time delay of blastn which is normally 5-300 secs.
   * 
   * The Flask web api server pretzel/lb4app/lb3app/scripts/blastServer.py exposes 1 command : blastn, which calls the script pretzel/lb4app/lb3app/scripts/blastn_cont.bash
   * (this could be incorporated into blastServer.py - the current approach simply maps from a request name to a script filename which implements the request, in which sense it is simply a switch routing requests to the appropriate implementation).
   * It also maps dnaSequenceLookup to dnaSequenceLookup.bash
   * 
   * blastn_cont.bash implements the request by running blastn directly, or if it is not installed, via docker run ncbi/blast blastn.
   * 
   */
  Feature.dnaSequenceSearch = function(data, options, cb) {
    const models = this.app.models;

    let {dnaSequence, parent, searchType, resultRows, addDataset, datasetName,
         minLengthOfHit, minPercentIdentity, minPercentCoverage
        } = data;
    // data.options : params for streaming result, used later.
    const fnName = 'dnaSequenceSearch';
    /** each user session may have 1 concurrent dnaSequenceSearch.
     * Use session id for a unique index for dnaSequence fileName.  */
    // investigating why options.accessToken is undefined on a server.
    if (! options.accessToken) {
      console.log(fnName, 'options', options);
    }
    const
    index = options.accessToken?.id ? sessionIndex(options.accessToken.id) : 0,
    queryStringFileName = 'dnaSequence.' + index + '.fasta';
    console.log(fnName, dnaSequence.length, parent, searchType, index, queryStringFileName);

    /** Receive the results from the Blast.
     * @param chunk is a Buffer
     * null / undefined indicates child process closed with status 0 (OK) and sent no output.
     * @param cb is cbWrap of cb passed to dnaSequenceSearch().
     */
    let searchDataOut = (chunk, cb) => {
      if (! chunk) {
        cb(null, []);
      } else
      if (chunk && (chunk.length >= 6) && (chunk.asciiSlice(0,6) === 'Error:')) {
        cb(new Error(chunk.toString()));
      } else {
        const
        textLines = chunk.toString().split('\n')
          .filter((textLine) => filterBlastResults(
            minLengthOfHit, minPercentIdentity, minPercentCoverage, textLine));
        if (trace) {
          (trace > 3 ? textLines : textLines.slice(0, 2))
            .forEach((textLine) => {
              if (textLine !== "") {
                console.log(fnName, 'stdout data',  "'", textLine,  "'");
              }
            });
        };
        if (addDataset) {
          let jsonFile='tmp/' + datasetName + '.json';
          /** same as convertSearchResults2Json() in dnaSequenceSearch.bash */
          let datasetNameFull=`${parent}.${datasetName}`;
          console.log('before removeExisting "', datasetNameFull, '"', '"', jsonFile, '"');
          upload.removeExisting(models, options, datasetNameFull, /*replaceDataset*/true, cb, loadAfterDelete);

          function loadAfterDelete(err) {
            upload.loadAfterDeleteCb(
              jsonFile, 
              (jsonData) => 
                upload.uploadParsedTryCb(models, jsonData, options, cb), 
              err, cb);
          }

        }

        cb(null, textLines);
      }
    };

    /* For development, disable this to use dev_blastResult. there is also
     * dev_blastResult() in dnaSequenceSearch.bash. */
    if (true) {
      function qLog(status) {
        console.log(fnName, status, 'sequenceSearchQueue', sequenceSearchQueue.getPendingLength(), sequenceSearchQueue.getQueueLength());
      }
      sequenceSearchQueue.add(searchP);
      function searchP() {
        let promise = new Promise(
          function (resolve, reject) {
            let cbWrap = function () { qLog('complete:' + queryStringFileName); resolve(); cb.apply(this, arguments); };
            qLog('starting:' + queryStringFileName);
            let child = childProcess(
              'dnaSequenceSearch.bash',
              dnaSequence, true, queryStringFileName, [parent, searchType, resultRows, addDataset, datasetName], searchDataOut, cbWrap, /*progressive*/ false);
          }
        );
        return promise;
      }
    } else {
      let features = dev_blastResult;
      cb(null, features);
    }
  };


  Feature.remoteMethod('search', {
    accepts: [
      {arg: 'blockId', type: 'string', required: false},
      {arg: 'filter', type: 'array', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {arg: 'features', type: 'array'},
    description: "Returns features and their datasets given an array of feature names"
  });

  Feature.remoteMethod('searchPost', {
    accepts: [
      {arg: 'blockId', type: 'string', required: false},
      {arg: 'filter', type: 'array', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'post'},
    returns: {arg: 'features', type: 'array'},
    description: "Returns features and their datasets given an array of feature names"
  });


  Feature.remoteMethod('aliasSearch', {
    accepts: [
      {arg: 'featureNames', type: 'array', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {type: 'object', root: true},
    description: "Given an array of feature names, returns matching aliases and features matching the aliases"
  });

  Feature.remoteMethod('depthSearch', {
    accepts: [
      {arg: 'blockId', type: 'string', required: true},
      {arg: 'depth', type: 'number', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {arg: 'features', type: 'array'},
    description: "Returns features by their level in the feature hierarchy"
  });
 
  Feature.remoteMethod('dnaSequenceSearch', {
    accepts: [
      {arg: 'data', type: 'object', required: true, http: {source: 'body'}},
      /* Within data : .dnaSequence, and :
      {arg: 'parent', type: 'string', required: true},
      {arg: 'searchType', type: 'string', required: true},
      resultRows, addDataset, datasetName
      */
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    // http: {verb: 'post'},
    returns: {arg: 'features', type: 'array'},
    description: "DNA Sequence Search e.g. Blast, returns TSV output as text array"
  });
 
  acl.assignRulesRecord(Feature)
  acl.limitRemoteMethods(Feature)
  acl.limitRemoteMethodsSubrecord(Feature)
  acl.limitRemoteMethodsRelated(Feature)
};

/*----------------------------------------------------------------------------*/

const dev_blastResult = [
  "BobWhite_c10015_641     chr2A   100.000 50      0       0       1       50      154414057       154414008       2.36e-17        93.5    50      780798557",
  "BobWhite_c10015_641     chr2B   98.000  50      1       0       1       50      207600007       207600056       1.10e-15        87.9    50      801256715"
];
/*----------------------------------------------------------------------------*/

