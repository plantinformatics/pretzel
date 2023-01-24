'use strict';

/* global exports */

/** Add a .statusCode field to an object returned by Error().
 * Express recognises response.statusCode
 */
exports.ErrorStatus = function(statusCode, text)
{
  let e = Error(text);
  e.statusCode = statusCode;
  return e;
};
