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

export { Object_filter };
