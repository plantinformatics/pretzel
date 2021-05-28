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
  cache.save();
};

/*----------------------------------------------------------------------------*/
