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

export { arraysConcat };
