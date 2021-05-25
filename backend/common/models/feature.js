'use strict';

/* global require */
/* global process */

var acl = require('../utilities/acl')
const { childProcess } = require('../utilities/child-process');
var upload = require('../utilities/upload');


module.exports = function(Feature) {
  Feature.search = function(filter, options, cb) {
    Feature.find({
        "include": 
        {
          "block": "dataset"
        },
        "where":
        {
          "name":
          {
            "inq": filter
          }
        }
    }, options).then(function(features) {
      // filter out the features for which the user doesn't have access to the dataset
      features = features.filter(function(feature) {
        return feature.__data.block.__data.dataset
      })
      return process.nextTick(() => cb(null, features))
    })
  };

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

  /**
   * @param data contains :
   * @param dnaSequence FASTA format for Blast; text string input for other searchType-s, e.g. string "actg..."
   * @param parent  datasetId of parent / reference of the blast db which is to be searched
   * @param searchType 'blast'
   * @param resultRows
   * @param addDataset
   * @param datasetName
   * @param options
   *
   * @param cb node response callback
   */
  Feature.dnaSequenceSearch = function(data, cb) {
    const models = this.app.models;

    let {dnaSequence, parent, searchType, resultRows, addDataset, datasetName, options} = data;
    const fnName = 'dnaSequenceSearch';
    console.log(fnName, dnaSequence.length, parent, searchType);

    /** Receive the results from the Blast.
     * @param chunk is a Buffer
     * @param cb is cbWrap of cb passed to dnaSequenceSearch().
     */
    let searchDataOut = (chunk, cb) => {
      if (chunk.asciiSlice(0,6) === 'Error:') {
        cb(new Error(chunk.toString()));
      } else {
        const
        textLines = chunk.toString().split('\n');
        textLines.forEach((textLine) => {
          if (textLine !== "") {
            console.log(fnName, 'stdout data',  "'", textLine,  "'");
          }
        });
        if (addDataset) {
          let jsonFile='tmp/' + datasetName + '.json';
          console.log('before removeExisting "', datasetName, '"', '"', jsonFile, '"');
          upload.removeExisting(models, datasetName, /*replaceDataset*/true, cb, loadAfterDelete);

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

    if (true) {
    let child = childProcess(
      'dnaSequenceSearch.bash',
      dnaSequence, true, 'dnaSequence', [parent, searchType, resultRows, addDataset, datasetName], searchDataOut, cb, /*progressive*/ false);
    } else {
      let features = dev_blastResult;
      cb(null, features);
    }
  };


  Feature.remoteMethod('search', {
    accepts: [
      {arg: 'filter', type: 'array', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {arg: 'features', type: 'array'},
    description: "Returns features and their datasets given an array of feature names"
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
      {arg: "options", type: "object", http: "optionsFromRequest"}
      resultRows, addDataset, datasetName
      */
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

