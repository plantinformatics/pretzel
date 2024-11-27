import { later } from '@ember/runloop';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

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

export { pollCondition }
/** If condition is truthy, do okFn,
 * else wait initialWait, with back-off, until condition is truthy, or time is > 10sec.
 * @param initialWait	milliseconds to wait before first retry, 
 * @param conditionFn	function returning booleanish
 * @param okFn
 */
function pollCondition(initialWait, conditionFn, okFn) {
  if (conditionFn()) {
    okFn();
  } else if (initialWait > 10e3) {
    console.warn('pollCondition', 'timed out', initialWait, conditionFn, okFn);
  } else {
    dLog('pollCondition', initialWait);
    later(() => pollCondition(initialWait * 2, conditionFn, okFn), initialWait);
  }
}

//------------------------------------------------------------------------------

export { promiseThrottle }
/** If there is not a recent promise object[symbol] then perform fnP and record
 * the returned promise in object[symbol], along with the current time.  The
 * param delay is used to measure whether a previous promise is recent.
 *
 * @param object
 * @param symbol
 * @param delay
 * @param fnP	returns a promise
 * @return the cached promise object[symbol].promise, or the result of fnP()
 */
function promiseThrottle(object, symbol, delay, fnP) {
  const fnName = 'promiseThrottle';
  let promise;
  const previous = object[symbol], time = Date.now();
  if (!previous || (previous.time + delay < time)) {
    dLog(fnName,  previous && (previous.time - time), object.id);
    promise = fnP();
    object[symbol] = {time, promise};
  } else {
    promise = previous.promise;
  }
  return promise;
}

//------------------------------------------------------------------------------
