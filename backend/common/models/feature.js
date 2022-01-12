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
    let index = sessionIndex(options.accessToken.id),
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
        textLines.forEach((textLine) => {
          if (textLine !== "") {
            console.log(fnName, 'stdout data',  "'", textLine,  "'");
          }
        });
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

