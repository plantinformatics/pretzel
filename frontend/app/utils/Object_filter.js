/*----------------------------------------------------------------------------*/

/** filter an Object.
 * Usage : 
 * import { Object_filter } from '../utils/Object_filter';
 * Object.filter = Object_filter;
 *
 * from : https://stackoverflow.com/a/5072145  */
function Object_filter(obj, predicate) {
  var result = {}, key;
  for (key in obj) {
    if (obj.hasOwnProperty(key) && predicate(obj[key])) {
      result[key] = obj[key];
    }
  }
  return result;
};

/*----------------------------------------------------------------------------*/

/** Compare each field of a & b.
 * Recurse into sub-objects.
 * @param compareFn signature is (a, b) -> value (e.g. boolean)
 * @return object with same keys as a & b, value of result.x is a.x === b.x
 * @desc In the primary use case, keys(a) === keys(b), so this is assumed.
 * The keys are taken from the 1st object (a).
 *
 * Usage example :
 *   let prev = this.get('resizePrev');
 *   this.set('resizePrev', result);
 *   if (prev) {
 *     delete result.changed;
 *     let changed = compareFields(prev, result, (a,b) => a !== b);
 *     result.changed = changed;
 *   }
 */
function compareFields(a, b, compareFn) {
  // related : isEqual from 'lodash/lang';
  let result = {};
  for (let k in a) {
    if (! b || ! b[k])
      result[k] = undefined;
    else if (typeof a[k] === "object")
      result[k] = compareFields(a[k], b[k], compareFn);
    else
      result[k] = compareFn(a[k], b[k]);
  }
  return result;
};

/*----------------------------------------------------------------------------*/

export { Object_filter, compareFields };
