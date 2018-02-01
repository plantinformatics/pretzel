
/*----------------------------------------------------------------------------*/

/** library of functions for logging d3 selections
 * @see also utils/domElements.js
 */

/*----------------------------------------------------------------------------*/

/** Collate data values from a d3 selection array.
 * @param s d3 selection array
 * @param datum if true then use the __data__ attribute of the DOM elements in the array
 * Used by logSelectionLevel() and thence logSelection(), possibly not a useful export.
 */
function fromSelectionArray(s, datum)
{
  let a=[];
  for (let i=0; i<s.length; i++)
    a.push(datum ? s[i] && s[i].__data__ : s[i]);
  return a;
}

/** given the  _groups or _parents of a d3 delection, log the data values of its first sub-array [0].
 * For  _groups, the __data__ attribute is collated;  for _parents the value is used directly.
 */
function logSelectionLevel(sl)
{
  if (sl.length && sl[0].length)
  {
    console.log(fromSelectionArray(sl[0], false));
    console.log(fromSelectionArray(sl[0], true));
  }
}

/** given a d3 delection, log the data values of its _groups and _parents. */
function logSelection(s)
{
  console.log(s, s._groups.length, s._parents.length);
  logSelectionLevel(s._groups);
  logSelectionLevel(s._parents);
}

/*----------------------------------------------------------------------------*/

export {  fromSelectionArray, logSelectionLevel, logSelection };
