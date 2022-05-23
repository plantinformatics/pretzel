'use strict';

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
