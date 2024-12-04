'use strict';

var fs = require('fs');
var Promise = require('bluebird')
const bent = require('bent');

const { datasetParentContainsNamedFeatures } = require('./data-check');
const { gatherClientId } = require('./identity');

const load = require('./load');

const { bufferSlice } = require('./buffer-slice');
const { ErrorStatus } = require('./errorStatus.js');

/* global require */
/* global exports */
/* global process */

/*----------------------------------------------------------------------------*/

function notDefined(value) { return value === undefined || value === null; }

/*----------------------------------------------------------------------------*/

/**
 * Divide array into smaller chunks
 * @param {Array} arr - array of data to be processed
 * @param {String} len - array chunk length
 */
function chunk (arr, len) {
  var chunks = [];
  var i = 0;
  var n = arr.length;
  while (i < n) {
    chunks.push(arr.slice(i, i += len));
  }
  return chunks;
}

/**
 * Perform chunked database object creation
 * @param {Array} data - array of objects / object
 * @param {Object} model - Loopback database model
 * @param {String} len - array chunk length
 */
function createChunked (data, model, len) {
  console.log('createChunked')
  var dataChunked = chunk(data, len)
  console.log('creating data', data.length)
  console.log('creating data chunked', dataChunked.length)

  // dataChunked = dataChunked.slice(0, 2)

  return model.create(data)

  // return Promise.all(dataChunked.map(model.create)).then(data => {
  //   console.log('num jobs' + data.length);
  //   return 'done'
  // });

  // var promises = []

  // dataChunked.forEach(function(chunk) {
  //   console.log('model create')
  //   promises.push(
  //     model.create(chunk)
  //     .then(function(data) {
  //       console.log('done chunk')
  //       return 'done'
  //     })
  //   )
  // })

  // // console.log(promises)

  // return Promise.all(promises)
  // .catch(function(err) {
  //   console.log('ERROR', err)
  // })


  // return Promise.reduce(dataChunked, function(total, chunk) {
  //   console.log('promise')
  //   return model.create(chunk)
  //   .then(function(data) {
  //     console.log('done data batch')
  //     return 'done'
  //   })
  // })
  // .then(function(results) {
  //   console.log('done with upload')
  //   return true
  // })
}




/**
 * Send a json dataset structure to the database
 * @param {Object} data - The dataset object to be processed
 * @param {Object} models - Loopback database models
 */
exports.uploadDataset = (data, models, options, cb) => {
  const fnName = 'uploadDataset';
  let dataset_id
  let json_blocks = []

  //create dataset
  models.Dataset.create(data, options)
  .then(function(dataset) {
    dataset_id = dataset.name
    if (dataset.__cachedRelations.blocks) {
      dataset.__cachedRelations.blocks.forEach(function(json_block) {
        json_block.datasetId = dataset.id
        if (json_block.namespace == null && data.namespace != null) {
          json_block.namespace = data.namespace;
        }
        json_blocks.push(json_block)
      })
    }
    //create blocks
    return models.Block.create(json_blocks, options)
  })
    .then(function(blocks) {
      uploadDatasetContent(dataset_id, blocks, models, options, cb);
    })
    .catch((error) => {
      console.log(fnName, dataset_id, error);
      cb(error);
    });
};
/**
 * @return promise
 */
function uploadDatasetContent(dataset_id, blocks, models, options, cb) {
  const fnName = 'uploadDatasetContent';
  let json_annotations = [];
  let json_intervals = [];
  let json_features = [];

    blocks.forEach(function(block) {
      if (block.__cachedRelations.annotations) {
        block.__cachedRelations.annotations.forEach(function(json_annotation) {
          json_annotation.blockId = block.id
          json_annotations.push(json_annotation)
        })
      }
      if (block.__cachedRelations.intervals) {
        block.__cachedRelations.intervals.forEach(function(json_interval) {
          json_interval.blockId = block.id
          json_intervals.push(json_interval)
        })
      }
      if (block.__cachedRelations.features) {
        block.__cachedRelations.features.forEach(function(json_feature) {
          json_feature.blockId = block.id;
          json_feature.parentId = null;
          json_features.push(json_feature);
        })
      }
    });

  let promise =
    //create annotations
  models.Annotation.create(json_annotations, options)
  .then(function(annotations) {
    //create intervals
    return models.Interval.create(json_intervals, options)
  }).then(function(intervals) {
    //create features using connector for performance
    models.Feature.dataSource.connector.connect(function(err, db) {
      insert_features_recursive(db, dataset_id, json_features, true, cb)
        /* cb already called. */
        .catch((err) => console.log(fnName, err.message || err));
    });
  }).catch(cb);
  return promise;
}
exports.uploadDatasetContent = uploadDatasetContent;

/** 
 * @param dataset_id  passed to cb
 * @param ordered false enables insertMany() to insert later documents after a document
 * which cannot be inserted because of a duplicate key.
 * (refn : https://docs.mongodb.com/v3.2/reference/method/db.collection.insertMany/#error-handling )
 * @return promise  (no value)
 */
function insert_features_recursive(db, dataset_id, features_to_insert, ordered, cb) {
  // no more features
  if (features_to_insert.length == 0) {
    /** this promise is only to satisfy the .catch() in uploadDatasetContent().
     * result is not used, and resolve time doesn't matter.  */
    return new Promise((resolve, reject) => {
      process.nextTick(() => { cb(null, dataset_id); resolve();});
    });
  }

  let next_level_features = [];
  // collect and prepare next level features
  features_to_insert.forEach(function(feature, i) {
    if (feature.features) {
      feature.features.forEach(function(child_feature) {
        child_feature.blockId = feature.blockId;
        // save parent index to link with children after insertion
        child_feature.parentIndex = i;
        next_level_features.push(child_feature);
      });
      delete feature.features;
    }
    /** snps2Dataset.pl generates value_0:null for QTL;
     * models/block.js : loadRequiredData() -> allFeatures() ->
     * getBlockFeaturesInterval( true) loads all the features of a QTL block, so
     * QTL value_0 is not used.
     */
    if (! notDefined(feature.value) && (feature.value_0 === undefined)) {
      const value = feature.value;
      feature.value_0 = (value.length === 0) ? null : 
        value.length ? value[0] : value;
    }
  });

  let promise =
  // insert current features
    db.collection('Feature').insertMany(features_to_insert, {ordered})
    .then(function(result) {
      console.log('insert_features_recursive', result.insertedCount, features_to_insert.length);
      // link parent ids
      next_level_features.forEach(function(child_feature) {
        child_feature.parentId = result.insertedIds[child_feature.parentIndex];
        delete child_feature.parentIndex;
      });
      // insert next level
      return insert_features_recursive(db, dataset_id, next_level_features, ordered, cb);
    })
    .catch((err) => {
      console.log('insert_features_recursive', err.message, err.code);
      if (err.writeErrors) console.log(err.writeErrors.length, err.writeErrors[0]);
      // if !ordered then duplicates are OK - called from blockAddFeatures().
      if (err.code === 11000) {
        let dupCount = err.writeErrors && err.writeErrors.length || 0;
        return Promise.resolve(features_to_insert.length - dupCount);
      }
      else {
        cb(ErrorStatus(400, err.message));
        return Promise.reject(err.message);
      }
    });
  return promise;
};
exports.insert_features_recursive = insert_features_recursive;


/**
 * Check whether the specified dataset already exists in the db
 * @param {Object} name - the name of dataset to check
 * @returns {boolean} - true if exists
 */
function checkDatasetExists(name, models) {
  return models.Dataset.find({where: {name: name}, limit: 1})
  .then(function(results) {
    return results.length > 0;
  });
}


/*----------------------------------------------------------------------------*/

/** Handle POST-ed JSON data, either plain file or gzip-ed,
 * parse the JSON and apply the given function uploadParsed to it.
 * Call cb().
 * @param msg received API request message
 * @param uploadParsed  function to pass parsed JSON object to
 * @param cb  node callback
 */
exports.handleJson = function(msg, uploadParsed, cb) {
  // factored from dataset.js : Dataset.upload(), which can be changed to use this.

  // Parse as either .json or .gz
  if (msg.fileName.endsWith('.json')) {
    try {
      let jsonMap = JSON.parse(msg.data);
      uploadParsed(jsonMap);
    } catch (e) {
      console.log(e);
      cb(Error("Failed to parse JSON"));
    }
  } else if (msg.fileName.endsWith('.gz')) {
    var buffer = new Buffer(msg.data, 'binary');
    load.gzip(buffer).then(function(json) {
      let jsonMap = json;
      uploadParsed(jsonMap);
    })
      .catch(function(err) {
        console.log(err);
        cb(Error("Failed to read gz file"));
      });
  } else {
    cb(Error('Unsupported file type'));
  }
};

/*----------------------------------------------------------------------------*/

/**
 * @param cb  (err, result) => { ... }
 * cb is called with Error(); the string err.message is passed back in the
 * response message and the .stack is not used; err.statusCode is used in the
 * response status.
 */
  exports.uploadParsedCb = 
    // Common steps for both .json and .gz files after parsing
  (models, jsonMap, options, cb) => {
      if(!jsonMap.name){
        cb(ErrorStatus(400, 'Dataset JSON has no "name" field (required)'));
      } else {
        checkQtlThenUpload();
        // This check is not required because uploadParsedCb() is called after removeExisting.
        // Check if dataset name already exists
        // Passing option of 'unfiltered: true' overrides filter for public/personal-only
        if (false)
        models.Dataset.exists(jsonMap.name, { unfiltered: true }).then((exists) => {
          if (exists) {
            cb(ErrorStatus(400, `Dataset name "${jsonMap.name}" is already in use`));
          } else {
            checkQtlThenUpload();
          }
        })
        .catch((err) => {
          console.log(err);
          cb(ErrorStatus(404, 'Error checking dataset existence'));
        });
      }

    function checkQtlThenUpload() {
            datasetParentContainsNamedFeatures(models, jsonMap, options, cb)
              .then((errorMsg) => {
                if (errorMsg) {
                  cb(ErrorStatus(400, `Dataset name "${jsonMap.name}" error : ` + errorMsg));
                } else {
                  // Should be good to process saving of data
                  exports.uploadDataset(jsonMap, models, options, cb);
                }
              });
    }
    };


  exports.uploadParsedTryCb = 
    /** Wrap uploadParsed with try { } and pass error to cb().
     * Also report error to cb() if jsonData is not defined.
     */
    function uploadParsedTryCb(models, jsonData, options, cb) {
      if (! jsonData) {
        let message = 'No upload data';
        console.log(message);
        cb(ErrorStatus(400, message));
      } else
      try {
        let jsonMap = JSON.parse(jsonData);
        exports.uploadParsedCb(models, jsonMap, options, cb);
      } catch (e) {
        let message = e.toString ? e.toString() : e.message || e.name;
        let context, position;
        if ((position = message.match(/in JSON at position ([0-9]+)/))) {
          context = bufferSlice(jsonData, +position[1]);
          console.log(position[1], context);
        }
        // logging e logs e.stack, which is also logged by cb(Error() )
        console.log(message || e);
        const
        augmentedMessage =
          "Failed to parse JSON" +
          (message ? ':\n' + message : '') +
          (context ? '  in : \n' + context : '');
        cb(ErrorStatus(400, augmentedMessage));
      }
    };

  /**
   * @param uploadFn  uploadParsedTry(jsonData)
   */
  exports.loadAfterDeleteCb =
    function loadAfterDeleteCb(fileName, uploadFn, err, cb) {
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
                    uploadFn(jsonData);
                  }
                });
              }
            };


  /** If Dataset with given id exists, remove it.
   * If id doesn't exist, or it is removed OK, then call okCallback,
   * otherwise pass the error to the (API request) replyCb.
   * @param options optionsFromRequest
   * @param id  datasetId
   * @param replaceDataset if false and dataset id exists, then fail - call replyCb() with Error.
   * @param replyCb called with (error)
   * @param okCallback called if OK
   */
  exports.removeExisting = function(models, options, id, replaceDataset, replyCb, okCallback) {
    const fnName = 'removeExisting';
    models.Dataset.exists(id, { unfiltered: true }).then((exists) => {
      console.log(fnName, "'", id, "'", exists);
      if (exists) {
        if (! replaceDataset) {
          replyCb(Error("Dataset '" + id + "' exists"));
        } else {
          /** also @see utilities/identity.js : queryFilterAccessible(), 
           * models/record.js, 
           * boot/access.js : canWrite(), datasetPermissions()
           */
          let clientIdString = gatherClientId(options);
          let clientId = options.accessToken.userId;
          console.log(fnName, options, clientIdString, clientId, typeof clientId);
          /** alternative : let where = {clientId: clientId, _id : id}; */
          models.Dataset.findById(id, {}, { unfiltered: true } )
            .then((dataset) => {
              console.log(fnName, dataset);
              /* if using .find( {where} )
               * let dataset = datasets && datasets.length && datasets.find((d) => d.id === id); */
              /** id exists, so dataset !== undefined.
               * If dataset is a copy from another server (it has ._origin),
               * then it is OK for any user to remove it and replace with their
               * own upload.
               * if using {where} then !dataset would imply it is owned by another user. */
              if (dataset && ! dataset.meta._origin &&
                  (clientIdString !== dataset.clientId.id.hexSlice())) {
                let error = ErrorStatus(403, 'Dataset ' + id + ' is not owned by this user');
                // .catch does replyCb(error);
                // don't proceed to following .then()
                throw error;
              }
            })
            .then(() => {
        /* without {unfiltered: true}, the dataset was not found by destroyAll.
         * destroyAllById(id ) also did not found the dataset (callback gets info.count === 0).
         * .exists() finds it OK.
         */
        models.Dataset.destroyAll/*ById(id*/ ({_id : id}, {unfiltered: true}, (err) => {
          if (err) {
            replyCb(err);
          } else {
            console.log(fnName, 'removed', id);
            okCallback();
          }
        });
            })
            .catch((error) => {
              replyCb(error);
            });
        }
      } else {
        okCallback();
      }
    });
  };

/** Call removeExisting() and return a promise instead of calling the replyCb or okCallback callbacks.
  */
exports.removeExistingP = function(models, options, id, replaceDataset) {
  /** */
  let promise = new Promise(function (resolve, reject) {
    function replyCb(error) { reject(error); }
    function okCallback() { resolve(); }
    exports.removeExisting(models, options, id, replaceDataset, replyCb, okCallback);
  });
  return promise;
};




/*----------------------------------------------------------------------------*/

/**
 * @param rows array, 1 dataset per row, datasetId is given by rows[*]['Current dataset name']
 * From sheetToDatasetsMetadata().
 * @desc
 * For each dataset in rows, merge the data given in rows into dataset.meta.
 * Generate warnings for datasets which don't exist.
 * @param models
 * @param options
 */
exports.datasetSetMeta = datasetSetMeta;
function datasetSetMeta(rows, models, options) {
  const
  fnName = 'datasetSetMeta',

  /* .observe() : models = ctx.Model.app.models, options = ctx.options */
  Dataset = models.Dataset,

  /** array of promises, 1 per row / dataset */
  updatePs = rows.map(row => {
    const
    /** datasetId */
    id = row['Current dataset name'];
    delete row['Current dataset name'];

    /** based on removeExisting(). */
    let clientIdString = gatherClientId(options);
    let clientId = options.accessToken.userId;
    console.log(fnName, options, clientIdString, clientId, typeof clientId);
    const
    updateP = 
      models.Dataset.findById(id, {}, { unfiltered: true } )
      .then((dataset) => {
        console.log(fnName, dataset);

        if (! dataset) {
          let error = ErrorStatus(404, 'Dataset ' + id + ' does not exist');
          throw error;
        } else
        if (dataset && ! dataset.meta._origin &&
            (clientIdString !== dataset.clientId.id.hexSlice())) {
          let error = ErrorStatus(403, 'Dataset ' + id + ' is not owned by this user');
          throw error;
        } else {
          const
          meta = Object.assign({}, dataset.meta),
          merged = Object.assign(meta, row);

          /** based on Group.observe('after delete' ) */
          let where = {_id : id};
          console.log(fnName, where);

          let promise = Dataset.update(where, {meta : merged}, options);
          promise.then((done) => { console.log(fnName, done); return 1; })
            .catch((error) => console.log(fnName, 'error', error));
          return promise;
        }
      });
    return updateP;
  });
  const
  /** updateP yields 1, so .length is sufficient to count OK updates. */
  countUpdates = Promise.all(updatePs)
    .then((updates) => updates.length);
  return countUpdates;
}


//------------------------------------------------------------------------------
