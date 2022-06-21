import { helper } from '@ember/component/helper';

import { toArrayPromiseProxy } from '../utils/ember-devel';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

/** Wrap the given promise of an array with ArrayProxy.extend(PromiseProxyMixin).
 * @param positionalParams  array of length 1
 * It is not useful to return an array of promise-proxies, so only positionalParams[0] is used.
 * @param namedParams  not used
 */
export default helper(function toArrayPromiseProxyHelper(positionalParams, namedParams) {
  let result;
  if ((positionalParams.length !== 1) || (namedParams && Object.keys(namedParams).length)) {
    dLog('toArrayPromiseProxyHelper', 'just 1 param is expected', positionalParams, namedParams);
  } else {
    result = toArrayPromiseProxy(positionalParams[0]);
  }
  return result;
});
