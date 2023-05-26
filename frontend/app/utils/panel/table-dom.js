/* global $ */

//------------------------------------------------------------------------------

const trace = 0;
const dLog = console.debug;

//------------------------------------------------------------------------------
/** @file DOM Elements of HandsOnTables,
 * e.g. genotype table (manage-genotype / matrix-view)
 */
/**
 * Related :
 *  ./axis-table.js    : Relationship between axes and HandsOnTables, via Features which are the metadata of tables.
 *  ./feature-table.js : Handle selection in a handsOnTable which has feature rows.
 */


//------------------------------------------------------------------------------

/** Get the Y position of the top of the table, and its height. */
function tableYDimensions() {
  let dim;
  const
  fname = 'tableYDimensions',
  tableDiv$ = $('div#observational-table.handsontable');
  if (tableDiv$.length) {
    const
    tableDiv = tableDiv$[0],
    offsetHeight = tableDiv.offsetHeight,// : 830
    offsetTop = tableDiv.offsetTop; // : 104
    dim = {offsetTop, offsetHeight};
    dLog(fname, dim, tableDiv);
  }
  return dim;
}

//------------------------------------------------------------------------------

export {
  tableYDimensions
}
