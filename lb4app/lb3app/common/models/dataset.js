'use strict';

/* global module */
/* global require */
/* global Buffer */
/* global process */


const { spawn } = require('child_process');
var fs = require('fs');

// var _ = require('lodash');
const { pick } = require('lodash/object');


var acl = require('../utilities/acl');
var { clientIsInGroup, clientOwnsGroup, groupIsWritable } = require('../utilities/identity');
var upload = require('../utilities/upload');
var load = require('../utilities/load');
const { spreadsheetDataToJsObj } = require('../utilities/spreadsheet-read');
const { loadAliases } = require('../utilities/load-aliases');
const { cacheClearBlocks } = require('../utilities/localise-blocks');
const { ErrorStatus } = require('../utilities/errorStatus.js');

//------------------------------------------------------------------------------

/** enables use of spreadsheetUploadExternal() : uploadSpreadsheet.bash and snps2Dataset.pl
 */
const spreadsheetUploadExternalEnabled = process.env.spreadsheetUploadExternalEnabled;

//------------------------------------------------------------------------------

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

    const fnName = 'upload';
    var models = this.app.models;
    const uploadParsed = (jsonMap) => upload.uploadParsedCb(models, jsonMap, options, cb);
    function uploadParsedTry(jsonData) {
      upload.uploadParsedTryCb(models, jsonData, options, cb);
    }

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
      if (spreadsheetUploadExternalEnabled) {
        this.spreadsheetUploadExternal(msg, options, models, uploadParsedTry, cb);
      } else {
        this.spreadsheetUploadInternal(msg, options, models, cb);
      }
    } else {
      cb(ErrorStatus(400, 'Unsupported file type'));
    }
  };

  Dataset.spreadsheetUploadCbWrap = function(cb) {
    let cbOrig = cb,
        cbCalled = 0;
    return cbWrapper;
    /** See comment for spreadsheetUploadExternal() : cbOrig, re. cbWrap().
     * @param result if ! err, then result is defined, i.e. dataset name/s
     */
    function cbWrapper(err, result) {
      const fnName = 'cbWrapper';
      if (cbCalled++ === 0) {
        cbOrig(err, result);
      } else {
        console.log(fnName, 'cb already called', cbCalled, err, result);
      }
    }
  };

  /**
   * @param msg
   * @param options
   * @param models
   * @param uploadParsedTry
   * @param cb
   */
  Dataset.spreadsheetUploadExternal = function(msg, options, models, uploadParsedTry, cb) {
    const fnName = 'spreadsheetUploadExternal';

      /** messages from child via file descriptors 3 and 4 are
       * collated in these arrays and can be sent back to provide
       * detail for / explain an error.
       */
      let errors = [], warnings = [];

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
      /**
       * @param message if ! err, then message is result, i.e. dataset name
       */
      function cbWrap(err, message, last) {
        console.log('cbWrap', err && err.toString(), message, last);
        /* insert_features_recursive() "passes" last === undefined,
         * and when !err, message is datasetId (i.e. datasetName)
         */
        if (last || (last === undefined) || err) {
          if (cbCalled++ === 0) {
            if (err && (errors.length || warnings.length)) {
              err = [err.toString()].concat(errors).concat(warnings).join("\n");
              errors = []; warnings = [];
            } else if (err && (typeof err.message === 'string')) {
              console.log(fnName, 'cbWrap', err.message);
              err = ErrorStatus(400, err.message);
              if (! message) {
                message = err.message;
              }
            }
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
      /** In the Docker container, server cwd is /.   uploadSpreadsheet.bash is in $scriptsDir/ */
      scriptsDir = process.env.scriptsDir ||
        ((currentDir === "/") ? "/app/lb3app/scripts" : 
         currentDir.endsWith("/lb4app") ? 'lb3app/scripts' : 'backend/scripts'),
      // process.execPath is /usr/bin/node,  need /usr/bin/ for mv, mkdir, perl
      PATH = process.env.PATH + ':' + scriptsDir,
      /** file handles : stdin, stdout, stderr, output errors, output warnings. */
      spawnOptions = {env : {PATH},  stdio: ['pipe', 'pipe', process.stderr, 'pipe', 'pipe'] };
      const child = spawn('uploadSpreadsheet.bash', [msg.fileName, useFile], spawnOptions);
      child.on('error', (err) => {
        console.error('Failed to start subprocess.', 'uploadSpreadsheet', msg.fileName, err.toString());
        if (err.constructor === Error) {
          err.statusCode = 400; // or default to 500, but that drops the message.
        }
        // const error = Error("Failed to start subprocess to upload xlsx file " + msg.fileName + '\n' + err.toString());
        cb(err/*or*/);
      });
      console.log('uploadSpreadsheet', /*child,*/ msg.fileName, msg.data.length, replaceDataset, scriptsDir, currentDir);
      if (! useFile) {
        child.stdin.write(msg.data);
        child.stdin.end();
      }

      // On MS Windows these handles may not be 3 and 4.
      child.stdio[3].on('data', (chunk) => {
        let message = chunk.toString();
        console.log('uploadSpreadsheet errors :', message);
        errors.push(message);
      });
      child.stdio[4].on('data', (chunk) => {
        let message = chunk.toString();
        console.log('uploadSpreadsheet warnings :', message);
        warnings.push(message);
      });

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
              cb(ErrorStatus(400, fileName + " Dataset '" + datasetName + "'"));
            } else {
              console.log('before removeExisting "', datasetName, '"');
              // utilities/upload
              upload.removeExisting(models, options, datasetName, replaceDataset, cb, loadAfterDelete);
            }
            function loadAfterDelete(err) {
              upload.loadAfterDeleteCb(
                fileName, 
                (jsonData) => uploadParsedTry(jsonData), 
                err, cb);
            }
          }
        });
      });

      // since these are streams, you can pipe them elsewhere
      // child.stderr.pipe(dest);
      child.on('close', (code) => {
        console.log('child process exited with code',  code);
        if (code) {
          const error = ErrorStatus(400, "Failed to read xlsx file " + msg.fileName);
          cb(error);
        } else {
          // process each tmp/out_json/"$datasetName".json
          const message = 'Uploaded xlsx file ' + msg.fileName;
          if (child.killed) {
            cb(null, message, true);
          } // else check again after timeout
        }
      });
  };

  /**
   * @param msg
   * @param options
   * @param models
   * @param cb
   * @desc
   * return via cb : {errors, warnings, datasetNames[]}
   * .errors and .warnings may have [datasetNames] : [] text messages
   */
  Dataset.spreadsheetUploadInternal = function(msg, options, models, cb) {
    const fnName = 'spreadsheetUploadInternal';
    const fileName = msg.fileName;

    console.log(fnName, msg.fileName, msg.data.length);
    cb = this.spreadsheetUploadCbWrap(cb);

    /** related : jsonData */
    const dataObj = spreadsheetDataToJsObj(msg.data);
    let datasets = dataObj.datasets;
    let status = pick(dataObj, ['warnings', 'errors']);
    const datasetNames = datasets.map((dataset) => dataset.name);
    status.datasetNames = datasetNames;

    status.datasetsWithErrorsOrWarnings =
      datasets.filter((d) => d.warnings?.length || d.errors?.length)
      .map((dataset) => pick(dataset, ['name', 'errors', 'warnings']));

    // if ! datasets.length then cbCountDone() is not called, so send warnings here.
    if (status.errors?.length || (status.warnings?.length && ! datasets.length)) {
      status.fileName = fileName;
      /* status may contain {errors, warnings, .. } and Error() takes only a
       * string, so send status result back as return value instead of error.
       */
      // ErrorStatus(400, JSON.stringify(status))
      cb(null, status);
    } else {
      /* aliases don't have much overlap with datasets - handle separately. */
      let aliasesP = [];
      datasets = datasets
        .filter((dataset) => {
          /** true means filter out of datasets */
          const out = dataset.aliases;
          if (out) {
            aliasesP.push(loadAliases(dataset, models));
          }
          return ! out;
        });

      let datasetsDone = 0;
      let datasetRemovedPs =
      datasets.map((dataset) => {
        const
        datasetName = dataset.name,
        replaceDataset = !!msg.replaceDataset;
        console.log('before removeExisting "', datasetName, '"');
        /* This will upload all datasets after all removed.
         * i.e. wait for all removes to succeeed, then upload all datasets.
         */
        const promise = upload.removeExistingP(models, options, datasetName, replaceDataset);
        return promise;
      });
      /* Added removeExistingP() to enable  :
       *   Promise.all(datasetRemovedPs)
       * which enables all of datasets[] to be removed before re-loading them
       * The requirement is currently : remove each dataset individually before it is loaded.
       */
      datasetRemovedPs.forEach((datasetRemovedP, i) => {
        datasetRemovedP
        .catch((error) => cbCountDone(error))
          .then(() => loadAfterDelete(datasets[i]));
      });
    
      function cbCountDone(error, result) {
        if (error) {
          cb(error, result);
        } else {
          /* if (! error) then result is dataset.name */
          if (++datasetsDone === datasets.length) {
            if (! error) {
              Promise.all(aliasesP)
                .catch((error) => cb(error))
                .then((aliasesDone) => {
                  /* aliasesDone is, per alias dataset:
                   *   [result.insertedCount, ..], or if delete, then e.g. {n: 0, ok: 10}
                   */
                  console.log('aliasesDone', aliasesDone);
                  /** If a dataset failed, then cb is already called and this will have
                   * no effect, so no need to filter out datasets which failed.
                   */
                  cb(null, status);
                });
            }
          }
        }
      }

      /* loadAfterDelete() in spreadsheetUploadExternal() is similar but also
       * does loadAfterDeleteCb() : readFile() then uploadParsedTry() : JSON.parse().
       */
      function loadAfterDelete(datasetObj) {
        /** related : uploadParsedTry(), upload.uploadParsedCb() */
        /** Delay sending result until all datasets are complete. */
        function cbOneDataset(error, result) {
          /* if ! error, expect that result === datasetObj.name  */
          if (error?.message) {
            error.message = datasetObj.name + ' : ' + error.message;
          } else if (typeof error === 'string') {
            error = datasetObj.name + ' : ' + error;
          }
          cbCountDone(error, result || datasetObj.name);
        }
        upload.uploadParsedCb(models, datasetObj, options, cbOneDataset);
      }

    }
  };


  /**
   * @param data  dataset, with .features with attributes :
   *   feature.name, .block (blockId), .val, .end (start, end position).
   */
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
        cb(ErrorStatus(404, "Dataset not found"));
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
        let value = [feature.val];
        if (feature.end !== undefined) {
          value.push(feature.end);
        }
        let f = {
          name: feature.name,
          value,
          value_0: feature.val,
          blockId: blocks_by_name[feature.block]
        };
        if (feature.values) {
          f.values = feature.values;
        }
        array_features.push(f);
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

  Dataset.observe('before save', function(ctx, next) {
    const
    fnName = 'Dataset:before save',
    models = ctx.Model.app.models,
    Dataset = ctx.Model,
    dataset = ctx.isNewInstance ? ctx.instance : ctx.currentInstance,
    data = ctx.data || dataset.__data;

    if (! data) {
      console.log(fnName, ''+dataset?.id, dataset, ctx);
    } else
    if (data.groupId) {
      let
      /** similar : models/group.js : sessionClientId(context),
       * utilities/identity.js : gatherClientId() */
      accessToken = ctx.options.accessToken,
      clientId = accessToken.userId;
      let groupId = data.groupId;
      let
      writable = groupIsWritable(groupId),
      ok = (writable && clientIsInGroup(clientId, groupId)) ||
          clientOwnsGroup(clientId, groupId);
      console.log(fnName, ok, ''+dataset.id, ''+groupId, dataset);
      if (! ok) {
        // Don't save
        const
        soText = ' so they cannot set that as group of dataset ' + dataset.id,
        errorText = writable ? 
              'User ' + clientId + ' is not a member of group ' + groupId + soText :
              'User ' + clientId + ' is not owner of group ' + groupId + ' which is not writable,' + soText;
        var err = ErrorStatus(403, errorText);
        console.log(errorText);
        next(err);
        return;
      }
    }

    if (ctx.isNewInstance) {
      /** create : ctx.instance is defined, instead of .currentInstance, .where and .data */
      if (dataset.public && dataset.groupId) {
        console.log(fnName, ''+dataset.id, ''+dataset.groupId, dataset);
        dataset.groupId = null; // or dataset.setAttribute('groupId',  )
      }
    } else if (dataset) { // update
      let
      /** check the new value if changing, or otherwise the current value. */
      isPublic = data.hasOwnProperty('public') ? data.public : dataset.public;
      if (isPublic && dataset.groupId) {
        console.log(fnName, isPublic, data, ''+dataset.id, ''+dataset.groupId, dataset);
        data.groupId = null;
      }
    }

    next();
  });

  // ---------------------------------------------------------------------------

  Dataset.remoteMethod('upload', {
    accepts: [
      {arg: 'msg', type: 'object', required: true, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"},
      {arg: "req", type: "object", http: {source: "req"}}
    ],
    returns: {arg: 'status', type: 'object'},
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
