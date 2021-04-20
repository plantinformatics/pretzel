'use strict';

/* global module */
/* global require */
/* global Buffer */
/* global process */


const { spawn } = require('child_process');
var fs = require('fs');

var _ = require('lodash');


var acl = require('../utilities/acl');
var identity = require('../utilities/identity');
var upload = require('../utilities/upload');
var load = require('../utilities/load');
const { cacheClearBlocks } = require('../utilities/localise-blocks');

module.exports = function(Dataset) {

/** Add the given dataset / blocks / features json data to the db.
 * Uses upload.uploadDataset(), which is also the basis of @see createComplete().
 * @desc
 * This function, relative to createComplete(), adds .json.gz support,
 * and 2 data checks : 
 * . data has a .name at the top level - Dataset name
 * . .name does not already exist in models.Dataset
 */
  Dataset.upload = function(msg, options, req, cb) {
    req.setTimeout(0);
    var models = this.app.models;
    // Common steps for both .json and .gz files after parsing
    const uploadParsed = (jsonMap) => {
      if(!jsonMap.name){
        cb(Error('Dataset JSON has no "name" field (required)'));
      } else {
        // Check if dataset name already exists
        // Passing option of 'unfiltered: true' overrides filter for public/personal-only
        models.Dataset.exists(jsonMap.name, { unfiltered: true }).then((exists) => {
          if (exists) {
            cb(Error(`Dataset name "${jsonMap.name}" is already in use`));
          } else {
            // Should be good to process saving of data
            upload.uploadDataset(jsonMap, models, options, cb);
          }
        })
        .catch((err) => {
          console.log(err);
          cb(Error('Error checking dataset existence'));
        });
      }
    };
    /** Wrap uploadParsed with try { } and pass error to cb().
     */
    function uploadParsedTry(jsonData) {
      try {
        let jsonMap = JSON.parse(jsonData);
        uploadParsed(jsonMap);
      } catch (e) {
        let message = e.toString ? e.toString() : e.message || e.name;
        // logging e logs e.stack, which is also logged by cb(Error() )
        console.log(message || e);
        cb(Error("Failed to parse JSON" + (message ? ':\n' + message : '')));
      }
    };
    // Parse as either .json or .gz
    // factored as handleJson()
    if (msg.fileName.endsWith('.json')) {
      uploadParsedTry(msg.data);
    } else if (msg.fileName.endsWith('.gz')) {
      var buffer = new Buffer(msg.data, 'binary');
      load.gzip(buffer).then(function(json) {
        let jsonMap = json;
        uploadParsed(jsonMap);
      })
      .catch(function(err) {
        console.log(err);
        cb(Error("Failed to read gz file"));
      })
    } else if (
      msg.fileName.endsWith('.xlsx') || msg.fileName.endsWith('.xls') || 
        msg.fileName.endsWith('.ods')
    ) {
      /** Each worksheet in the .xslx will result in a dataset passed
       * to upload.uploadDataset() which call cb(), so it is necessary
       * to limit this to a single call-back, using cbWrap and cbCalled.
       * It would be better to assemble an array of datasetId-s from
       * insert_features_recursive(), and pass that to cb when complete.
       * The client does not use this result value.
       *
       * Refn : async/dist/async.js : onlyOnce(fn)
       */
      let cbOrig = cb,
          cbCalled = 0;
      function cbWrap(err, message, last) {
        console.log('cbWrap', err && err.toString(), message, last);
        /* insert_features_recursive() "passes" last === undefined,
         * and when !err, message is datasetId (i.e. datasetName)
         */
        if (last || (last === undefined) || err) {
          if (cbCalled++ === 0) {
            cbOrig(err, message);
          }
        }
      }
      cb = cbWrap;
      /** msg.fileName : remove punctuation other than .-_, retain alphanumeric */
      const useFile = true;
      if (useFile) {
        const data = new Uint8Array(Buffer.from(msg.data, 'binary'));
        fs.writeFile(msg.fileName, data, (err) => {
          if (err) {
            cb(err);
          } else {
            console.log('Written', msg.data.length, data.length, 'to', msg.fileName);
          }
        });
      }

      const
      /** msg.replaceDataset is defined by uploadSpreadsheet(), but not by data-json.js : submitFile()
       */
      replaceDataset = !!msg.replaceDataset, 
      currentDir = process.cwd(),
      scriptsDir = currentDir.endsWith("/backend") ? 'scripts' : 'backend/scripts',
      // process.execPath is /usr/bin/node,  need /usr/bin/ for mv, mkdir, perl
      PATH = process.env.PATH + ':' + scriptsDir,
      options = {env : {PATH},  stdio: ['pipe', 'pipe', process.stderr] };
      const child = spawn('uploadSpreadsheet.bash', [msg.fileName, useFile], options);
      child.on('error', (err) => {
        console.error('Failed to start subprocess.', 'uploadSpreadsheet', msg.fileName, err.toString());
        // const error = Error("Failed to start subprocess to upload xlsx file " + msg.fileName + '\n' + err.toString());
        cb(err/*or*/);
      });
      console.log('uploadSpreadsheet', /*child,*/ msg.fileName, msg.data.length, replaceDataset, scriptsDir, currentDir);
      if (! useFile) {
        child.stdin.write(msg.data);
        child.stdin.end();
      }

      child.stdout.on('data', (chunk) => {
        // data from the standard output is here as buffers
        // Possibly multiple lines, separated by \n,
        // completed by \n.
        const
        textLines = chunk.toString().split('\n');
        textLines.forEach((textLine) => {
          if (textLine !== "") {
            let [fileName, datasetName] = textLine.split(';');
            console.log('uploadSpreadsheet stdout data',  "'", fileName,  "', '", datasetName, "'");
            if (fileName.startsWith('Error:') || ! datasetName) {
              cb(new Error(fileName + " Dataset '" + datasetName + "'"));
            } else {
              console.log('before removeExisting "', datasetName, '"');
              this.removeExisting(datasetName, replaceDataset, cb, loadAfterDelete);
            }
            function loadAfterDelete(err) {
              if (err) {
                cb(err);
              }
              else {
                fs.readFile(fileName, (err, jsonData) => {
                  if (err) {
                    cb(err);
                  } else {
                    console.log('readFile', fileName, jsonData.length);
                    // jsonData is a Buffer;  JSON.parse() handles this OK.
                    uploadParsedTry(jsonData);
                  }
                });
              }
            };
          }
        });
      });

      // since these are streams, you can pipe them elsewhere
      // child.stderr.pipe(dest);
      child.on('close', (code) => {
        console.log('child process exited with code',  code);
        if (code) {
          const error = Error("Failed to read xlsx file " + msg.fileName);
          cb(error);
        } else {
          // process each tmp/out_json/"$datasetName".json
          const message = 'Uploaded xlsx file ' + msg.fileName;
          if (child.killed) {
            cb(null, message, true);
          } // else check again after timeout
        }
      });
    } else {
      cb(Error('Unsupported file type'));
    }
  }

  /** If Dataset with given id exists, remove it.
   * If id doesn't exist, or it is removed OK, then call okCallback,
   * otherwise pass the error to the (API request) replyCb.
   * @param if false and dataset id exists, then fail - call replyCb() with Error.
   */
  Dataset.removeExisting = function(id, replaceDataset, replyCb, okCallback) {
    var models = this.app.models;

    models.Dataset.exists(id, { unfiltered: true }).then((exists) => {
      console.log('removeExisting', "'", id, "'", exists);
      if (exists) {
        if (! replaceDataset) {
          replyCb(Error("Dataset '" + id + "' exists"));
        } else {
        /* without {unfiltered: true}, the dataset was not found by destroyAll.
         * destroyAllById(id ) also did not found the dataset (callback gets info.count === 0).
         * .exists() finds it OK.
         */
        models.Dataset.destroyAll/*ById(id*/ ({_id : id}, {unfiltered: true}, (err) => {
          if (err) {
            replyCb(err);
          } else {
            console.log('removeExisting removed', id);
            okCallback();
          }
        });
        }
      } else {
        okCallback();
      }
    });
  };

  Dataset.tableUpload = function(data, options, cb) {
    var models = this.app.models;
    var blocks = {};
    var datasetGroup = null;
    var blocks_by_name = [];
    var existing_blocks = [];

    models.Dataset.findById(data.dataset_id, {include: "blocks"}, options)
    .then(function(dataset) {
      if (dataset) {
        datasetGroup = dataset;
        data.features.forEach(function(feature) {
          blocks[feature.block] = false;
        });
        dataset.blocks().forEach(function(block) {
          if (block.name in blocks) {
            blocks[block.name] = true;
            existing_blocks.push(block.id);
            blocks_by_name[block.name] = block.id;
          }
        });
        // delete old features
        return models.Feature.deleteAll({blockId: {inq: existing_blocks}}, options)
      } else {
        cb(Error("Dataset not found"));
      }
    })
    .then(function(deleted_features) {
      return models.Block.updateAll({id: {inq: existing_blocks}}, {updatedAt: new Date()}, options)
    }).then(function(updated_blocks) {
      var new_blocks = [];
      Object.keys(blocks).forEach(function(name) {
        if (blocks[name] === false) {
          let payload = {
            scope: name,
            datasetId: datasetGroup.id,
            namespace: data.namespace
          }
          new_blocks.push(payload);
        }
      });
      // create new blocks
      return models.Block.create(new_blocks, options);
    })
    .then(function(new_blocks) {
      new_blocks.forEach(function(block) {
        blocks_by_name[block.name] = block.id;
      });
      var array_features = [];
      data.features.forEach(function(feature) {
        array_features.push({
          name: feature.name,
          value: [feature.val],
          blockId: blocks_by_name[feature.block]
        });
      });
      // create new features
      return models.Feature.create(array_features);
    })
    .then(function(new_features) {
      cb(null, "Successfully uploaded " + new_features.length + " features");
    });
  }


  Dataset.cacheClear = function(time, options, cb) {
    let db = this.dataSource.connector,
    models = this.app.models;
    cacheClearBlocks(db, models, time)
      .then((removed) => cb(null, removed))
      .catch((err) => cb(err));
  };
  

  /*--------------------------------------------------------------------------*/

  /** Based on uploadDataset(), similar to @see upload().
   * @desc
   * createComplete() is used in backend/test/
   * and in functions_dev.bash : uploadData(),
   * but not in frontend/
   */
  Dataset.createComplete = function(data, options, req, cb) {
    req.setTimeout(0);
    var models = this.app.models;
    upload.uploadDataset(data, models, options, cb);
  }

  Dataset.observe('before delete', function(ctx, next) {
    var Block = ctx.Model.app.models.Block
    /** ctx.where contains the datasetId, but differently depending on the call which requested delete of the dataset :
     * - deletes done via URL (as in curl -X DELETE api/Datasets/) place the datasetId in ctx.where.and[1].name
     * - removeExisting() does Dataset.destroyAll({_id : id}, ) and that condition is copied to ctx.where, so where._id is the datasetId.
     */
    let
    where = ctx.where,
    datasetId = where.and ? where.and[1].name : where._id;
    if (where.and) {
      console.log('Dataset.observe(before delete', where.and[0], where.and[1]);
    }
    Block.find({
      where: {
        datasetId
      }
    }, ctx.options).then(function(blocks) {
      blocks.forEach(function(block) {
        Block.destroyById(block.id, ctx.options, function () {
        });
      })
    })
    next()
  })

  /*--------------------------------------------------------------------------*/


  Dataset.remoteMethod('upload', {
    accepts: [
      {arg: 'msg', type: 'object', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: "req", type: "object", http: {source: "req"}}
    ],
    returns: {arg: 'status', type: 'string'},
    description: "Perform a bulk upload of a dataset with associated blocks and features"
  });
  Dataset.remoteMethod('tableUpload', {
    accepts: [
      {arg: 'data', type: 'object', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {arg: 'status', type: 'string'},
    description: "Perform a bulk upload of a features from tabular form"
  });
  Dataset.remoteMethod('createComplete', {
    accepts: [
      {arg: 'data', type: 'object', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: "req", type: "object", http: {source: "req"}}
    ],
    returns: {arg: 'id', type: 'string'},
    description: "Creates a dataset and all of its children"
  });

  Dataset.remoteMethod('cacheClear', {
    accepts: [
      {arg: 'time', type: 'number', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
   description: "Clear cached copies of datasets / blocks / features from a secondary Pretzel API server."
  });


  acl.assignRulesRecord(Dataset);
  acl.limitRemoteMethods(Dataset);
  acl.limitRemoteMethodsRelated(Dataset);
};
