
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

/** given the  _groups or _parents of a d3 selection, log the data values of its first sub-array [0].
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

/** given a d3 selection, log the data values of its _groups and _parents. */
function logSelection(s)
{
  console.log(s, s._groups.length, s._parents.length);
  logSelectionLevel(s._groups);
  logSelectionLevel(s._parents);
}

/** given a d3 selection, log its nodes. */
function logSelectionNodes(s)
{
  let a = s.nodes();
  console.log('logSelectionNodes', a.length);
  if ((a.length == 1) && (a[0].length))
  {
    console.log('sub');
    a = a[0];
  }
  if (a.length < 20)
    // .map is not defined on NodeList, use .forEach()
    a.forEach(function(c) { console.log(c);});
}

/*----------------------------------------------------------------------------*/

/** Given a d3 selection, select the immediate child nodes of the elements in the selection.
 */
function selectImmediateChildNodes(s)
{
  /* refn : https://stackoverflow.com/a/35694889
   * from https://stackoverflow.com/questions/20569670/d3-selector-for-immediate-children
   * noting that the accepted answer (d3.select(this).selectAll('div > ul'))
   * seems to match anywhere in the subtree under the given element, not
   * constrained to immediate children.
   */
  return s
    .select(function(){ return this.childNodes; });
}

/*----------------------------------------------------------------------------*/

export {  fromSelectionArray, logSelectionLevel, logSelection, logSelectionNodes, selectImmediateChildNodes };
