import { helper } from '@ember/component/helper';

import { toPromiseProxy } from '../utils/ember-devel';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

/** Wrap the given promise of an object with Proxy.extend(PromiseProxyMixin).
 * @param positionalParams  object
 * @param namedParams  not used
 */
export default helper(function toPromiseProxyHelper(positionalParams, namedParams) {
  let result;
  if ((positionalParams.length !== 1) || (namedParams && Object.keys(namedParams).length)) {
    dLog('toPromiseProxyHelper', 'just 1 param is expected', positionalParams, namedParams);
  } else {
    let p = positionalParams[0];
    result = p?.then ? toPromiseProxy(p) : p;
  }
  return result;
});
