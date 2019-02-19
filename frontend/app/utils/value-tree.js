
/* global Ember */

/*----------------------------------------------------------------------------*/
/* Functional programming utilities.
 * Lodash is already included by various packages, so may use that, or possibly Ramda.
 */

/** Analogous to Array map(), produce a result parallel to the input, having the
 * same keys, and a value for each key based on the corresponding value of the
 * input hash.
 * @param h  input hash (object)
 * @param fn function(key, value) -> value which transforms the values.
 */
function mapHash(h, fn) {
  let result = {};
  for (var key in h) {
    if (h.hasOwnProperty(key)) {
      let value = h[key];
      console.log('mapHash', key, value);
      result[key] = fn(key, value);
    }
  }
  console.log('mapHash', h, '->', result);
  return result;
}

/*----------------------------------------------------------------------------*/


/** Analogous to Array forEach(), call function for each key:value pair of the
 * input hash.
 * Similar to mapHash().
 * @param h  input hash (object)
 * @param fn function(key, value)
 */
function forEachHash(h, fn) {
  // based on mapHash().
  console.log('forEachHash', h);
  for (var key in h) {
    if (h.hasOwnProperty(key)) {
      let value = h[key];
      console.log('forEachHash', key, value);
      fn(key, value);
    }
  }
}


/*============================================================================*/

/* global d3 */

/**
 * @return true if value is just {unmatched : ... }, i.e. it is an objet with
 * only 1 key, and that key is 'unmatched'.
 */
function justUnmatched(value) {
  // could instead pass a flag to datasetFilter() to discard unmatched.
  let result = value.hasOwnProperty('unmatched') && (d3.keys(value).length === 1);
  return result;
}

/*============================================================================*/
/* For logging value tree constructed in data explorer - manage-explorer.js */

/** For devel logging - log the contents of the given value tree v.
 * @param levelMeta annotations of the value tree, e.g. dataTypeName text.
 */
function logV(levelMeta, v) {
  console.log(v);
  if (v && v.constructor === Map) {
    v.forEach(function (key, value) {
      console.log(key, levelMeta.get(value));
      logV(levelMeta, value);
    });
  }
  /** may have Ember.isArray(v) and (typeof v === 'object') (e.g. result of
   * computed property / promise array proxy), so test for array first.
   */
  else if (Ember.isArray(v)) {
    v.forEach(function (value) {
      console.log(levelMeta.get(value));
      logV(levelMeta, value);
    });
  }
  else if (v.constructor.modelName) {
    /* Ember object */
    console.log(
      v.constructor.modelName,
      v.get('name'),
      v._internalModel.__data
    );
  }
  else if (typeof v === 'object') {
    forEachHash(v, function (key, value) {
      console.log(key, levelMeta.get(value));
      logV(levelMeta, value);
    });
  }
  else
    console.log(levelMeta.get(v), v);
}

/*----------------------------------------------------------------------------*/

export { mapHash, forEachHash, justUnmatched, logV };
