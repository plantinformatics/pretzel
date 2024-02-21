
/* related : ../ember-devel.js : nowOrLater(), promiseText(), to{,Array}PromiseProxy()  */


/** if value is a promise then call fn(value) when the promise resolves, otherwise call it now.
 * @return a promise, yielding fn(value), if value is a promise, otherwise fn(value)
 * @param value
 * Until 8dcbf8d0 value was expected to be defined. Now if it is undefined,
 * fn(value) is called immediately.
 * @param fn (value) -> result
 */
function thenOrNow(value, fn) {
  let result;
  if (value?.then) {
    result = value.then(fn);
  }
  else {
    result = fn(value);
  };
  return result;
}

/** @return	p.content if p is a promise, otherwise p.
 */
function contentOf(p) {
  return p?.content ?? p;
}

export { thenOrNow, contentOf };

//------------------------------------------------------------------------------

export { reduceInSeries };
/** Reduce the array to a promise; map each array element to a promise using
 * elt2PromiseFn, in series (not in parallel).
 * @param array
 * @param elt2PromiseFn (previousResult, element) -> promise
 * @param starting_promise  Start after this initial promise yields
 * Defaults to Promise.resolve() if undefined.
 */
function reduceInSeries(array, elt2PromiseFn, starting_promise) {
  /** based on ensureCounts() in lb4app/lb3app/common/utilities/block-features.js
   * and also https://stackoverflow.com/a/21372567 user663031
   * @param previousP head of chain of promises
   * @param previous result value yielded by previousP
   */
  const promise = array.reduce(
    (previousP, currentElement) => previousP.then(
      (previous) => elt2PromiseFn(previous, currentElement)),
    starting_promise ?? Promise.resolve());
  return promise;
}

//------------------------------------------------------------------------------
