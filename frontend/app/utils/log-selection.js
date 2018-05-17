
/*----------------------------------------------------------------------------*/

/** library of functions for logging d3 selections
 * @see also utils/domElements.js
 */

/*----------------------------------------------------------------------------*/


/** combine map and filter in one step.
 * @param a array
 * @param f map / filter function : falsey return values will be filtered out.
 * @return undefined if a.forEach and a.reduce are not defined.
 */
function mapAndFilter(a, f) {
  let out;
  // .reduce is not defined on NodeList, use .forEach()
  if (a.forEach)
  {
    let result = (out = []);
    a.forEach(
      function (element) {
        let mapped = f(element);
        if (mapped)
          result.push(mapped);
      });
  }
  else if (a.reduce)
  {
    out = a.reduce(
      function (result, element) {
        let mapped = f(element);
        if (mapped)
          result.push(mapped);
        return result;
      }, []);
  }
  // else out is undefined
  return out;
}

function domElementData(e) {
  return e && e.__data__;
}
function domElementNode(e) {
  return e && e.node();
}
function domElementValueOf(e) {
  return e && e.valueOf();
}

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

/** for small arrays, output the elements individually so the values can be seen
 * in Web Inspector console without having to click to expand the array. */
function logArrayElements(a) {
  if (! a.length || (a.length > 5))
    console.log(a);
  else
    a.map(function (ai) { console.log(ai); });
}
/** given the  _groups (just one element) or _parents of a d3 selection, log the data values of its first sub-array [0].
 * 2 outputs :
 * * an array of the collated __data__ attributes;  (may only be applicable to _groups)
 * * an indication of the html of the elements.
 * @param sl  selection level, either selection._groups or selection._parents
 */
function logSelectionLevel(sl)
{
  if (! sl)
  { }
  else if (sl.length > 10)
  {
    console.log(sl.length);
  }
  else if (true)
  {
    logArrayElements(mapAndFilter(sl, domElementData));
    logArrayElements(mapAndFilter(sl, domElementValueOf));
  }
  else
    /* previous implementation, based on fromSelectionArray(), which :
     * . does not filter out the empty elements.
     * . outputs raw elements instead of .valueOf(),
     *   which are displayed, respectively, as g#id2 or <g class=​"stack" id=​"id2">​…​</g>​
     * Currently not used, but perhaps sometimes it is of interest where the
     * defined and undefined values are within a selection.
     */
  {
    console.log(fromSelectionArray(sl, false));
    console.log(fromSelectionArray(sl, true));
  }
}

/** given a d3 selection, log the data values of its _groups and _parents. */
function logSelection(s)
{
  console.log(s, s._groups.length, s._parents.length);

  console.log('_groups');
  let sl = s._groups;
  if (sl.length && sl[0].length)
    logSelectionLevel(sl[0]);

  console.log('_parents');
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
