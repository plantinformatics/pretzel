'use strict';

/* global exports */

/** For use in progressively transitioning from LB3 to LB4,
 * convert a promise which yields the result of an API endpoint call,
 * to call a callback with either error or result.
 * Now that the LB4 controllers are used, the cb will be wrapped back into a
 * promise, so this function will be dropped out as cb-based functions
 * transition to yield promises.
 * 
 * This is roughly the reverse of promisify.
 * @param promise	yielding result of an API endpoint call
 * @param cb Node.js response callback
 */
exports.promiseToCb = function(promise, cb) {
  promise
    .then(result => cb(null, result))
    .catch(error => cb(error));
};
