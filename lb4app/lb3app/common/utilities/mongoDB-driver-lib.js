'use strict';

const { ErrorStatus } = require('./errorStatus.js');

/* global require */
/* global exports */
/* global Buffer */

const { ObjectID } = require('mongodb');


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

/** Rehydrate a MongoDb ObjectID which has been stored in cache and read back,
 * and hence has lost its prototype.
 * @param {object} obj
 * e.g. {"_bsontype":"ObjectID","id":{"0":97,"1":3,"2":221,"3":216,"4":121,"5":100,"6":79,"7":16,"8":229,"9":189,"10":66,"11":236}}
 */
let hexToObjectID = function (obj) {
  const objectID = new ObjectID(Buffer.from(Object.values(obj.id)));
  return objectID;
};
function x(objectID) {
  // Convert to hex string
  const hexString = objectID.toHexString();
  return hexString;
};
// hexToId(temp1)


/** If i has .toHexString, call it to transform it to the equivalent hex string.
 * Otherwise if it has ._bsontype and .id, convert to a MongoDb ObjectID object, then use .toHexString().
 * Otherwise no change.
 * @param {string|object} i either a (hex) string, or a MongoDb ObjectID object.
 * @return hex string representing an MongoDb ObjectID.
 */
let idToHex = function(i) {
  const
  hex = i.toHexString ? i.toHexString() :
    (i._bsontype && i.id) ? hexToObjectID(i).toHexString() :
    i ;
  return hex;
};
/** In the given array of objects, convert id fields, identified by fieldName,
 * to hex string representation.
 * id values in cached results should be in hex string representation.
 * This function is used to fix cached results, and to ensure results have ids
 * in hex string representation before they are written to cache.
 * Calling cb(null, result) probably converts objects using .toString(), which
 * for id fields which are ObjectID will convert them to hex representation. But
 * reading this value back from cache does not re-hydrate its .__proto__.
 * So when that result is returned via cb(), it is apparently converted via
 * JSON.stringify(), i.e. the _bsontype and array of integers is sent instead of
 * the hex representation.
 * @param {Array<object>} a result array; each element is an object containing
 * [fieldname] which is some representation of an ObjectID.
 * @param {string} fieldName	name of id field, e.g. '_id'
 */
exports.arrayFieldToHex =  function(a, fieldName) {
  return a.map(({[fieldName] : i, ... e}) => ({ [fieldName] : idToHex(i), ... e}));
};
// arrayFieldToHex(data, '_id')
// arrayFieldToHex(cached, '_id')

//------------------------------------------------------------------------------
