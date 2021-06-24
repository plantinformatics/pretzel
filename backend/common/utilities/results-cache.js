let flatCache = require('flat-cache');


/* global require */

/* global exports */

/*----------------------------------------------------------------------------*/


let cache = flatCache.load('resultsCache');

/*----------------------------------------------------------------------------*/


/** Expose the same API as memory-cache, to enable an easy substitution. 
 */

exports.get = (key) => {
  let cacheContent = cache.getKey(key);
  return cacheContent;
};

exports.put = (key, body) => {
  cache.setKey(key, body);
  /** https://github.com/royriojas/flat-cache#readme : "Non visited
   * keys are removed when cache.save() is called" if noPrune is not
   * true
   */
  cache.save(/*noPrune*/ true);
};

/*----------------------------------------------------------------------------*/
