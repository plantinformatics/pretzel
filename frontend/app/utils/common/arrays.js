/*----------------------------------------------------------------------------*/

/** @return array resulting from concatenating the given arrays a,b
 * @param a,b  if either is undefined or [], then the result is the other array.
 * (this avoids unnecessary re-creation of arrays, and retains the
 * array reference where there is no change e.g. for CP result.)
 */
function arraysConcat(a, b) {
  let c = (a && a.length) ? ((b && b.length) ? a.concat(b) : a) : b;
  return c;
};

/*----------------------------------------------------------------------------*/

/** @return the first index of the given sparse array, or undefined if the array is empty.
 * @desc
 * This uses O(1) time and space - it exits on the first iteration.
 *
 * Equivalent to firstIndex = Object.keys(array)[0], which allocates an array of keys / indices.
 * Usage : array?.[sparseArrayFirstIndex(array)];
 */
function sparseArrayFirstIndex(array) {
  /** from :  https://stackoverflow.com/a/40917838, Dec 1, 2016 at 18:26, Nina Scholz
   * https://stackoverflow.com/questions/3570889/get-first-element-of-a-sparse-javascript-array
 */
  let value, index;
  array.some(function (v, i) {
    value = v;
    index = i;
    return true;
  });
  return index;
}



export { arraysConcat, sparseArrayFirstIndex };
