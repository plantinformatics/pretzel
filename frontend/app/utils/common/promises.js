

/** if value is a promise then call fn(value) when the promise resolves, otherwise call it now.
 * @return a promise, yielding fn(value), if value is a promise, otherwise fn(value)
 */
function thenOrNow(value, fn) {
  let result;
  if (value.then) {
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
  return p.content || p;
}

export { thenOrNow, contentOf };
