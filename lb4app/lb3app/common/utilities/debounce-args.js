var { debounce }  = require('lodash/function');

/* global require */
/* global exports */

// -----------------------------------------------------------------------------

/** Wrap lodash debounce() to enable a string-able arg to be passed to the
 * function being debounced, i.e. each arg value determines a distinct debounce
 * sequence.
 */
class ArgsDebounce {
  constructor () {
    this.cache = {};
  }
  debounced(fn, arg, wait) {
    let
    argText = '' + arg,
    debouncedFn = this.cache[argText] || (
      this.cache[argText] = debounce(() => fn(arg), wait));
    return debouncedFn;
  }

}

exports.ArgsDebounce = ArgsDebounce;

// -----------------------------------------------------------------------------
