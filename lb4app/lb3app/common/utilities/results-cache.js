// let flatCache = require('flat-cache');
import { /*FlatCache,*/ create } from 'flat-cache';


/* global require */

/* global exports */

/*----------------------------------------------------------------------------*/

// old API, available via require()
// let cache = flatCache.load('resultsCache');
// const cache = new FlatCache();
// cache.load('resultsCache');
// './' is likely not required.
const
cacheId = 'resultsCache',
cacheDir = './Cache/',
cache = create({ cacheId, cacheDir });


/*----------------------------------------------------------------------------*/


/** Expose the same API as memory-cache, to enable an easy substitution. 
 */

export const get = (key) => {
  let cacheContent = cache.getKey(key);
  return cacheContent;
};

export const put = (key, body) => {
  cache.setKey(key, body);
  /** https://github.com/royriojas/flat-cache#readme : "Non visited
   * keys are removed when cache.save() is called" if noPrune is not
   * true
   */
  cache.save(/*noPrune*/ true);
};

/*----------------------------------------------------------------------------*/
