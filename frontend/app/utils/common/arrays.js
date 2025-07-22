//------------------------------------------------------------------------------

export { toggleString };

/** Equivalent to toggleObject() but for String.
 * Use .find ( ... object.startsWith( ) ) instead of .includes() which matches
 * string but not String.   toggleObject() uses .includes().
 * This enables an array of Strings / strings to be used in the same way as a
 * Set; using a Set is more succinct, but Set().size seems not be be effective
 * as a ComputedProperty dependency, whereas array.length is.
 * @param array [String, ... ]
 * @param name
 * (name instanceof String)
 */
function toggleString(array, name) {
  const
  index = array.findIndex(name_ => name.startsWith(name_));
  if (index !== -1) {
    array.removeAt(index, 1);
  } else {
    array.pushObject(name);
  }
}

//------------------------------------------------------------------------------

export {arrayChoose};
/** Choose all possible sets of k elements from array.
 * @return array of arrays
 * @desc
 * From : https://stackoverflow.com/a/64414875 by Bergi
 */
function arrayChoose(array, k, prefix=[]) {
  if (k == 0) return [prefix];
  return array.flatMap((v, i) =>
    arrayChoose(array.slice(i+1), k-1, [...prefix, v])
  );
}



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
 * This uses some, which in theory could use O(1) time and space - it exits on the first iteration.
 * But in practice it is slow and variable, and Object.keys(array)[0] is fast.
 *
 * Equivalent to firstIndex = Object.keys(array)[0], which allocates an array of keys / indices.
 * Usage : array?.[sparseArrayFirstIndex(array)];
 */
function sparseArrayFirstIndex_via_some(array) {
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
/** Same as above sparseArrayFirstIndex_via_some(); tests indicate this will perform better.
 * @see sparseArrayFirstIndex_via_some()
 */
function sparseArrayFirstIndex(array) {
  const index = Object.keys(array)[0];
  return index;
}

export { arraysConcat, sparseArrayFirstIndex };

//------------------------------------------------------------------------------

function defaultCmp(a, b) { return a === b ? 0 : a < b ? -1 : 1; }
export { defaultCmp, nameSort };
/** Sort the given array of names.
 * Currently used for chromosome names, which are typically
 * {[Cc]chr}?<number><remainder>, where number may contain '.'
 *
 * The sort order is :
 * - lexicographic for the text prefix,
 * - numeric order for the number part, then
 * - lexicographic for the remainder.
 *
 * This could be used for sorting marker and gene names also.
 */
function nameSort(array) {
  /** indexes into the result of regexp match. */
  const iText = 1, iNumber = 2, iRest = 3;
  const
  sorted = array
    .map(c => {const m = c.match(/^([^0-9]*)([0-9.]*)(.*)/); return [c, m]; })
    .sort((A, B) => {
      const
      /** the regexp match results */
      a = A[1], b = B[1],
      order = ! a || ! b ? defaultCmp(A[0], B[0]) :
        (a[iText] !== b[iText]) ? defaultCmp(a[iText], b[iText]) :
        a[iNumber] === b[iNumber] ? defaultCmp(a[iRest], b[iRest]) : (a[iNumber] - b[iNumber]);
      return order;
    })
    .mapBy('0');
  return sorted;
}

//------------------------------------------------------------------------------

/** Return a comparator function for Array.sort(), which will
 * sort a array using the given array compareFunctions, which have
 * the same signature as the cmpFn parameter to Array.sort().
 * Each of the compare functions is applied in turn until one returns a non-zero comparison.
 * i.e. compareFunctions defines a nested sort - if the first function compares
 * equal, then continue to evaluate the next compare function.
 * @param compareFunctions	array of (a, b) => a-b  (returning -ve/0/+ve)
 * @return (a, b) => -ve/0/+ve
 * @desc
 *
 * Example usage :
 *   [["a", 56], ["a", 34], ["b" 12"]].sort(
 *    arraySortNestedComparator(
 *      [(a,b) => a[0].localeCompare(b[0]),
 *       (a,b) => (b[1] - a[1])])
 */
export function arraySortNestedComparator(compareFunctions) {
  const fn = (a, b) => {
    let cmp = 0;
    /** Find the first non-zero comparison. The result of find() is not
     * used. cmp is exported. */
    compareFunctions.find(compareFunction => (
      cmp = compareFunction(a, b)
    ));
    return cmp;
  };
  return fn;
}


//------------------------------------------------------------------------------
