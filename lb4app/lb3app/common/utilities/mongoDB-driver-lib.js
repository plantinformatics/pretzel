'use strict';

const { ErrorStatus } = require('./errorStatus.js');

/* global require */
/* global exports */

var ObjectId = require('mongodb').ObjectID;

/** @return true if id1 and id2 represent the same mongoDB ObjectId
 * @param id1, id2	String or ObjectId
 */
exports.ObjectId_equals = function(id1, id2) {
  const
  t1 = typeof id1 === 'string',
  t2 = typeof id2 === 'string',
  ok = (id1 === undefined || id2  === undefined) || (t1 && t2) ? id1 === id2 :
    t1 ? id2.equals(id1) : id1.equals(id2);
  return ok;
};


//------------------------------------------------------------------------------

/** Find object matching objectId.
 * @return promise yielding object
 * @desc
 * based on : Block.datasetLookup()
 * @param model e.g. Dataset or this.app.models.Dataset
 */
exports.objectLookup = function(model, modelName, fnName, objectId, options) {
  const
  objectP =
    model.findById(objectId, {}, options)
    .then(object => {
      if (! object) {
        const errorText = modelName + ' ' + objectId + ' not found. ' + fnName;
        throw new ErrorStatus(400, errorText);
      } else {
        return object;
      }
    });
  return objectP;
};


//------------------------------------------------------------------------------
