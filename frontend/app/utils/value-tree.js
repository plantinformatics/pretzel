
/* global Ember */

const trace_values = 0;
const dLog = console.debug;


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

/** Count the leaf values, i.e. the blocks.
 * This is used when deciding whether to auto-expand all levels down to the leaves.
 * It is desirable to expand all (using allActive) if the displayed list is then
 * only a couple of pages, i.e. if there are a reasonable number of leaves.
 * @see autoAllActive(), allActive
 *
 * @param levelMeta annotations of the value tree, e.g. dataTypeName text.
 * @param values  a value tree
 */
function leafCount(levelMeta, values) {
  /** Traverse the value tree, similar to logV() above; it is probably not
   * necessary to handle all node types as logV() does, since leafCount() is
   * simply counting the leaves not visiting them.
   */
  let 
    datasetIds = Object.keys(values),
  count0 =
    datasetIds.reduce((count1, d) => {
      let
        value = values[d],
      /** If value is an array of Blocks, simply add .length to count, otherwise
       * it is a hash of scopes - traverse them and sum the .length of the
       * blocks array of each.
       * Ember.isArray(scopes) could instead be used to discern these 2 cases.
       */
      valueType = levelMeta.get(value);
      if (valueType == "Blocks") {
        count1 += value.length;
      }
      else if (
        // getting "Dataset";  not sure if values should include that.
        (valueType == "Dataset") && 
          value.get &&
          value.get('isLoaded')) {
        dLog('leafCount', valueType, value.get('id'), value.get('name'), value.get('blocks'));
        count1 += value.get('blocks.length');
      }
      else {
        let
          scopes = value,
          scopeNames =  Object.keys(scopes);
        count1 = scopeNames.reduce((sum, s) => {
          if (trace_values > 1)
          dLog(sum, s, scopes[s]);
          return sum+=scopes[s].length;
        }, count1);
      }
      if (trace_values > 1)
      console.log(value, valueType, count1);
      return count1;
    }, 0);
  if (trace_values)
  console.log('leafCount', values, datasetIds, count0);

  return count0;
}

/*----------------------------------------------------------------------------*/

export { mapHash, forEachHash, justUnmatched, logV, leafCount };
