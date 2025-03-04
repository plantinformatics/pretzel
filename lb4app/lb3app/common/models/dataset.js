'use strict';

const YAML = require('yaml');


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
const { GffParse } = require('../utilities/gff_read');
const { loadAliases } = require('../utilities/load-aliases');
const { cacheClearBlocks } = require('../utilities/localise-blocks');
const { cacheblocksFeaturesCounts } = require('../utilities/block-features');

// replacing require with import from package
// const { vcfGenotypeFeaturesCountsStatus, checkVCFsAreInstalled } = require('../utilities/vcf-genotype');
let vcfGenotypeFeaturesCountsStatus, checkVCFsAreInstalled;
// Copied from ./block.js; after backend node upgrade these can be updated.
import('@plantinformatics/vcf-genotype-brapi/dist/vcf-genotype-brapi-node.mjs').then(vcfGenotypeBrapi => {
  const vcfGenotype = vcfGenotypeBrapi.default.vcfGenotype;
  console.log('vcfGenotypeBrapi', vcfGenotypeBrapi, 'vcfGenotype', vcfGenotype);
  vcfGenotypeFeaturesCountsStatus = vcfGenotype.vcfGenotypeFeaturesCountsStatus;
  checkVCFsAreInstalled = vcfGenotype.checkVCFsAreInstalled;
});
//; //require('../utilities/vcf-genotype');

const { ErrorStatus } = require('../utilities/errorStatus.js');
const { objectLookup } = require('../utilities/mongoDB-driver-lib');
const { ensureItem, query, datasetIdGetVector } = require('../utilities/vectra-search.js');
const { flattenJSON } = require('../utilities/json-text.js');
const { text2Commands } = require('../utilities/openai-query.js');
const { noCacheResult } = require('../utilities/remote-method.js');

const cacheLibraryName = '../utilities/results-cache'; // 'memory-cache';
const cache = require(cacheLibraryName);


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

    if (! msg.fileName && (req.headers['content-type'] === 'text/gff3')) {
      const
      q = req.query,
      datasetId = q.fileName || ('gff3_dataset_' + req.readableLength),
      replaceDataset = typeof q.replaceDataset === 'string' ?
        JSON.parse(q.replaceDataset.toLowerCase()) : true,
/*
      uint8Array = req.read(req.readableLength),
      bodyData = uint8Array.asciiSlice();
*/
      parser = new GffParse(),
      // gffUploadData() also sets dataset.name = datasetId
      dataset = parser.startDataset({name : datasetId});
      parser.dataset = dataset;
      parser.bodyPipe(req)
        .then(dataObj =>
      // gffDataToJsObj(bodyData);
          this.gffUploadData(dataObj, datasetId, replaceDataset, options, models, cb)
        );
    } else
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
    } else if (
      msg.fileName.endsWith('.gff') || msg.fileName.endsWith('.gff3')
    ) {
        this.gffUpload(msg, options, models, cb);
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

    const
    checkP = Promise.all(checkVCFsAreInstalled(datasets, status));
    /** filter out VCF datasets which are not installed */
    checkP.then(statuses => {
      const
      datasetsOk = statuses.map((datasetStatus, i) => {
        const
        dataset = datasets[i],
        datasetOk = datasetStatus ? dataset : undefined;
        if (! datasetStatus) {
          const
          datasetError = pick(dataset, ['name', 'errors', 'warnings']),
          errors = datasetError.errors || (datasetError.errors = []);
          errors.push('VCF and SNPList are not installed for VCF dataset');
          status.datasetsWithErrorsOrWarnings.push(datasetError);
        }
        return datasetOk;
      })
        .filter(d => d);
      if (datasetsOk.length) {
        // in this case status is not reported

        /** share values which are used by both parts,
         * i.e. spreadsheetUploadInternal{,Database}()
         */
        const shared = {status, datasets : datasetsOk, fileName, };
        Dataset.spreadsheetUploadInternalDatabase(msg, options, models, shared, cb);
      } else {
        cb(null, status);
      }
    })
      .catch(err => { console.log(fnName, err.message); cb(err); });
  };
  /** Continuation of spreadsheetUploadInternal() - originally these 2 were a
   * single function, but split to enable additional (asynchronous)
   * error-checking before proceeding with database changes.
   * Params are the same as spreadsheetUploadInternal(), plus the shared local values :
   * @param shared
   */
  Dataset.spreadsheetUploadInternalDatabase = function(msg, options, models, shared, cb) {
    const {status, datasets, fileName} = shared;
    const fnName = 'spreadsheetUploadInternalDatabase';

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
      const
      /** dataset .aliases and .datasetMetadata are handled here, and the
       * remainder pass into the upload. process */
      datasetsRemainder = datasets
        .filter((dataset) => {
          /** true means filter out of datasets */
          let out;
          if ((out = dataset.aliases)) {
            aliasesP.push(loadAliases(dataset, models));
          } else if ((out = dataset.datasetMetadata)) {
            aliasesP.push(upload.datasetSetMeta(dataset.datasetMetadata, models, options));
          }
          return ! out;
        });

      let datasetsDone = 0;
      let datasetRemovedPs =
      datasetsRemainder.map((dataset) => {
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
          .then(() => setTimeout(() => loadAfterDelete(datasets[i]), i * 3000));
      });
      // or : Promise.all(datasetRemovedPs.map(...)).then(() => aliasesToCb());
      if (! datasets.length) {
        aliasesToCb();
      }
    
      function cbCountDone(error, result) {
        if (error) {
          cb(error, result);
        } else {
          /* if (! error) then result is dataset.name */
          if (++datasetsDone === datasets.length) {
            if (! error) {
              aliasesToCb();
            }
          }
        }
      }
      /** Convey results from non-dataset uploads, i.e. aliases and datasetMetadata,
       * to cb
       */
      function aliasesToCb() {
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

      /* loadAfterDelete() in spreadsheetUploadExternal() is similar but also
       * does loadAfterDeleteCb() : readFile() then uploadParsedTry() : JSON.parse().
       */
      function loadAfterDelete(datasetObj) {
        const fnName = 'loadAfterDelete';
        console.log(fnName, datasetObj.name);
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

  //----------------------------------------------------------------------------


  /**
   * @param msg
   * @param options
   * @param models
   * @param cb
   * @desc
   * return via cb : {errors, warnings, datasetName}
   * .errors and .warnings may have [datasetName] : [] text messages
   */
  Dataset.gffUpload = function(msg, options, models, cb) {
    // based on .spreadsheetUploadInternal
    const fnName = 'gffUpload';
    const fileName = msg.fileName;

    console.log(fnName, msg.fileName, msg.data.length);
    const
    datasetId = msg.fileName.replace(/\.gff3?/, ''),
    replaceDataset = !!msg.replaceDataset,
    parser = new GffParse(),
    dataObj = parser.gffDataToJsObj(msg.data, {name : datasetId});
    this.gffUploadData(dataObj, datasetId, replaceDataset, options, models, cb);
  };
  /** Parse and insert the given GFF data string into the database.
   * @param dataObj
   * @param dataset
   * @param replaceDataset
   * @param options
   * @param models
   * @param cb
   */
  Dataset.gffUploadData = function(dataObj, datasetId, replaceDataset, options, models, cb) {
    // based on .spreadsheetUploadInternal
    const fnName = 'gffUploadData';

    cb = this.spreadsheetUploadCbWrap(cb);


    let dataset = dataObj.dataset;
    dataset.name = datasetId;
    let status = pick(dataObj, ['warnings', 'errors']);
    status.datasetName = dataset.name;

    const datasets = [dataset];
    status.datasetsWithErrorsOrWarnings =
      datasets.filter((d) => d.warnings?.length || d.errors?.length)
      .map((dataset) => pick(dataset, ['name', 'errors', 'warnings']));


    // if ! dataset then cbCountDone() is not called, so send warnings here.
    if (status.errors?.length || (status.warnings?.length && ! dataset)) {
      status.fileName = fileName;
      /* status may contain {errors, warnings, .. } and Error() takes only a
       * string, so send status result back as return value instead of error.
       */
      // ErrorStatus(400, JSON.stringify(status))
      cb(null, status);
    } else {

      let datasetsDone = 0;
      let datasetRemovedPs =
      datasets.map((dataset) => {
        const
        datasetName = dataset.name;
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
          .catch((error) => cb(error))
          .then(() => loadAfterDelete(datasets[i]));
      });

      function loadAfterDelete(datasetObj) {
        function cbOneDataset(error, result) {
          /* if ! error, expect that result === datasetObj.name  */
          if (error?.message) {
            error.message = datasetObj.name + ' : ' + error.message;
          } else if (typeof error === 'string') {
            error = datasetObj.name + ' : ' + error;
          }
          cb(error, result || datasetObj.name);
        }


        upload.uploadDataset(datasetObj, models, options, cbOneDataset);
      }
    }

  };


  //----------------------------------------------------------------------------

  Dataset.cacheClear = function(time, options, cb) {
    let db = this.dataSource.connector,
    models = this.app.models;
    cacheClearBlocks(db, models, time)
      .then((removed) => cb(null, removed))
      .catch((err) => cb(err));
  };


  /**
   * @param userOptions user settings : {
   *   mafThreshold, snpPolymorphismFilter, featureCallRateThreshold,
   *   minAlleles, maxAlleles, typeSNP}
   */
  Dataset.cacheblocksFeaturesCounts = function(id, userOptions, options, cb) {
    const
    fnName = 'cacheblocksFeaturesCounts',
    db = this.dataSource.connector,
    models = this.app.models;
    if (! id) {
      cb(ErrorStatus(400, 'dataset id is a required parameter of ' + fnName));
    } else {
    cacheblocksFeaturesCounts(db, models, id, userOptions, options)
      .then((result) => cb(null, result))
      .catch((err) => {
        console.log(fnName, id, err.statusCode, err);
        cb(err);});
    }
  };

  //----------------------------------------------------------------------------

  Dataset.naturalSearch = function naturalSearch(search_text, options, cb) {
    console.log('naturalSearch', search_text);
    /** embedDatasets() -> datasetForEmbed() -> ensureItem(), adding to index
     * which is used by query() */
    embedDatasets(Dataset, options).then(() => {
    query(search_text)
      .then((results) => cb(null, results))
      .catch((err) => cb(err));
    });
  };

  Dataset.text2Commands = function text2CommandsEndpoint(commands_text, options, cb) {
    console.log('text2Commands', commands_text);
    text2Commands(commands_text)
      .then((results) => cb(null, results))
      .catch((err) => cb(err));
  };


  Dataset.getEmbeddings = function getEmbeddingsEndpoint(options, cb) {
    getEmbeddings(Dataset, options)
      .then((results) => cb(null, results))
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
  };

  //----------------------------------------------------------------------------

  /** Get the status of .vcf.gz files for this dataset.
   * @param datasetId  name of VCF / Genotype / view dataset, or vcf directory name
   */
  Dataset.vcfGenotypeFeaturesCountsStatus = function(datasetId, options, cb) {
    const
    fnName = 'vcfGenotypeLookup';
    objectLookup(Dataset, 'Dataset', fnName, datasetId, options)
      .then(genotypeStatus.bind(this));

    function genotypeStatus(dataset) {
      if (dataset.tags?.includes('VCF')) {
        vcfGenotypeFeaturesCountsStatus(datasetId, cb);
      }
    }
  };
  Dataset.remoteMethod('vcfGenotypeFeaturesCountsStatus', {
    accepts: [
      {arg: 'id', type: 'string', required: true},
      {arg: 'options', type: 'object', http: 'optionsFromRequest'},
    ],
    http: {verb: 'get'},
    returns: {arg: 'text', type: 'string'},
    description: "Get the status of .vcf.gz files for this dataset."
  });
  Dataset.afterRemote('vcfGenotypeFeaturesCountsStatus', noCacheResult);

  //----------------------------------------------------------------------------

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
      /** If dataset is a copy from another server (it has ._origin), then the
       * group is an object of the remote server, which does any required group
       * permission check.
       */
    if (data.groupId && ! data.meta?._origin) {
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

  Dataset.remoteMethod('cacheblocksFeaturesCounts', {
    accepts: [
      {arg: 'id', type: 'string', required: true, http: {source: 'query'}},
      {arg: 'userOptions', type: 'object', required: false, http: {source: 'body'}},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'post'},
    returns: {type: 'number', root: true},
   description: "Pre-warm the cache of blockFeaturesCounts for each block of this dataset."
  });

  Dataset.remoteMethod('naturalSearch', {
    accepts: [
      {arg: 'search_text', type: 'string', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
   description: "Use OpenAI to convert search_text to an vector embedding and search for matching datasets using Vectra."
  });

  Dataset.remoteMethod('text2Commands', {
    accepts: [
      {arg: 'commands_text', type: 'string', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
   description: "Use OpenAI to convert commands_text to text commands for viewing datasets."
  });

  Dataset.remoteMethod('getEmbeddings', {
    accepts: [
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {type: 'array', root: true},
   description: "Get vector embeddings of metadata of all datasets."
  });




  acl.assignRulesRecord(Dataset);
  acl.limitRemoteMethods(Dataset);
  acl.limitRemoteMethodsRelated(Dataset);
};

//------------------------------------------------------------------------------

/** Indicate if embedDatasets() has been done. */
let embeddingP;

/** Call ensureItem() for each dataset, if this has not already been done.
 * @param Dataset model
 * @param options including session accessToken
 */
function embedDatasets(Dataset, options) {
  const
  fnName = 'embedDatasets',
  cacheId = fnName,
  useCache = true;
  let cached;
  if (embeddingP) {
    // no action required
  } else if (useCache && (cached = cache.get(cacheId))) {
    console.log(fnName, 'cache.get', cacheId, cached.length);
    embeddingP = Promise.resolve(cached);
  } else {
    embeddingP = embedDatasetsNoCache(Dataset, options);
    if (useCache) {
      /* result is array of undefined; it simply signifies that the item is
       * stored in vectra. */
      embeddingP
        .then(vectors => {
          console.log(fnName, 'cache.put', cacheId, vectors.length);
          cache.put(cacheId, vectors);
        });
    }

  }
  return embeddingP;
}

/** Call ensureItem() for each dataset, if this has not already been done.
 * @param Dataset model
 * @param options including session accessToken
 * @return promise which resolves with no value for each dataset when
 * datasetForEmbed() has resolved for each dataset
 */
function embedDatasetsNoCache(Dataset, options) {
  const fnName = 'embedDatasetsNoCache';
  console.log(fnName);
  embeddingP = Dataset.find({}, options)
    .then(
      datasets => {
        console.log(fnName, datasets.length);
        const
        datasetsP =
        datasets
          .filter(d => ! d.meta?._origin)
          // .slice(0, 30)
          .map(dataset => datasetForEmbed(dataset)),
        allP = Promise.all(datasetsP);
        return allP;
      });

  return embeddingP;
}

function getEmbeddings(Dataset, options) {
  const
  fnName = 'getEmbeddings',
  cacheId = fnName,
  useCache = true;
  let cached, embeddingsP;
  if (useCache && (cached = cache.get(cacheId))) {
    console.log(fnName, 'cache.get', cacheId, cached.length);
    embeddingsP = Promise.resolve(cached);
  } else {
    embeddingsP = getEmbeddingsNoCache(Dataset, options);
    embeddingsP
      .then(datasetsVectors => {
        if (useCache)
          console.log(fnName, 'cache.put', cacheId, datasetsVectors.length);
          cache.put(cacheId, datasetsVectors);
      });
  }
  return embeddingsP;
}

function getEmbeddingsNoCache(Dataset, options) {
  const
  fnName = 'getEmbeddingsNoCache',
  // or just embedDatasets(Dataset, options)
  embedP = ! embeddingP ?
    embedDatasets(Dataset, options) :
    Promise.resolve(),
  resultP = embedP.then(() => {
    const
    embeddingsP = 
      Dataset.find({}, options)
      .then(
        datasets => {
          console.log(fnName, datasets.length);
          const
          embeddingsPromises =
            datasets
            .filter(d => ! d.meta?._origin)
            // .slice(0, 30)
            .map(async dataset => {
              const
              id = dataset.id,
              vector = await datasetIdGetVector(id);
              return {id, vector};
            });
          return Promise.all(embeddingsPromises);
        });
    return embeddingsP;
  });
  return resultP;
}

/**
 * @return promise yielding undefined
 */
function datasetForEmbed(dataset) {
  const
  fnName = 'datasetForEmbed',
  /** _id is not present in dataset.__data
   * .__data does contain .name, which is equal.
   */
  id = dataset.getId(),
  /** Reformat the tags array into a text list.
   * Omit clientId, groupId because they are hexadecimal DB ids and not
   * semantically informative.
   */
  {tags, clientId, groupId, ...datasetSansTags} = dataset.__data,
  tagsText = Array.isArray(tags) ? ' ' + tags.join(' ') : '',

  /** Initially used selected fields to minimise context size, but now
   * requesting embedding of each dataset separately, and only once at
   * startup, so size and cost is not a concern.
   * description = pick(dataset.__data, ['_id', 'meta.type', 'meta.shortName', 'tags', 'meta.commonName', 'namespace' ]);
   * description.id = id;
   */
  description = Object.assign({/*id*/}, datasetSansTags),
  prefix = 'The YAML form of the dataset named ' + id + ' is :\n',
  // JSON.stringify(description)
  // datasetToText(description)
  readable = prefix + datasetToYaml(description) + 'tags: ' + tagsText;
  function datasetToText(description) {
    return flattenJSON(description).join(', ');
  }

  console.log(fnName, readable);
  const embedP = ensureItem(id, readable);
  return embedP;
}

/**
 * @return string with a trailing newline
 */
function datasetToYaml(dataset) {
  const text = YAML.stringify(dataset, /*options*/ undefined);
  return text;
}

//------------------------------------------------------------------------------
