import { isEqual } from 'lodash/lang';

//------------------------------------------------------------------------------

import {
  setRowAttribute,
  getRowAttribute,
 } from '../panel/axis-table';

// -----------------------------------------------------------------------------

const dLog = console.debug;

const featureSymbol = Symbol.for('feature');


//------------------------------------------------------------------------------

const progressiveMergeLimit = 10;

/** merge data[] into currentData[]
 * Perform a maximum of progressiveMergeLimit changes.
 * @param table HandsOnTable instance
 * @param data  new row data to display
 * Each row datum is in object form.
 * @param currentData current row data displayed by table;
 * Each row datum may be in array form, i.e. currentData may be table.getData().
 * @param columnNames column headers of table.
 *  Used to convert row data in object form to array form, i.e. one array element per cell.
 * @param colHeaders
 * @return true if merge is incomplete, i.e. this function should be called again.
 */
function tableRowMerge(table, data, currentData, columnNames, colHeaders) {
  const fnName = 'tableRowMerge';
  /** number of changes remaining in this cycle */
  let remainingChanges = progressiveMergeLimit;
  /** indexes into a0 and a1 respectively (data, currentData).
   * i0 is the next row to copy from. i1 is the next row to merge into.
   */
  let i0, i1;
  const a0 = data, a1 = currentData;
  for (
    i0 = 0, i1 = 0;
    (i0 < a0.length) && (i1 < a1.length) && (remainingChanges-- > 0); ) {
    let
    d0 = a0[i0], d1 = a1[i1],
    d1IsArray = Array.isArray(d1),
    /** d0 and d1 may be (and currently are) in object form; convert d0 to
     * Array, to pass each cell datum to setDataAtCell().
     */
    d0Array = rowObjDataToArray(d0, columnNames),
    cmp = d1IsArray ? dataRowArrayCmp(d0Array, d1) : dataRowCmp(d0, d1),
    visualRowIndex1 = table.toVisualRow(i1),
    feature = d0[featureSymbol] || d0?.Block?.[featureSymbol];

    if (visualRowIndex1 === null) {
      remainingChanges++;
    } else 
    if (cmp === 0) {
      const
      k0 = dataRowKeyFn(d0),
      k1 = d1IsArray ? dataRowArrayKeyFn(d1) : dataRowKeyFn(d1);
      if (k0 === k1) {
        // if more or less samples in the new data
        const sameData = d1IsArray ? isEqual(d1, d0Array) : isEqual(d1, d0);
        if (! sameData) {
        // replace d1 with d0
          a1[i1] = d0;
          tableSetRowData(table, visualRowIndex1, d0Array, feature);
        } else {
          // no change - don't count this
          remainingChanges++;
        }
        i0++;
        i1++;
      } else {
        // append d0 after d1
        i1++;
        visualRowIndex1 = table.toVisualRow(i1);
        // i1 is outside viewport, so skip it.
        if (visualRowIndex1 === null) {
          remainingChanges++;
        } else {
          a1.splice(i1, 0, d0);
          tableInsertRow(table, visualRowIndex1, d0Array, feature);
          i1++;
        }
      }
    } else if (cmp < 0) {
      // insert d0
      a1.splice(i1, 0, d0);  i0++;
      tableInsertRow(table, visualRowIndex1, d0Array, feature);
      i1++;
    } else {
      // delete d1
      a1.splice(i1, 1);
      table.alter('remove_row', visualRowIndex1);
      // deleting the only row seems to cause columns to be forgotten.
      if (table_getData_length(table) === 0) {
        table.updateSettings({colHeaders});
      }
      /* don't count deleting as a change : if a large block of data becomes
       * outside of the table scope, then all the corresponding rows should be
       * deleted in a single step because it will improve responsiveness.
       */
      remainingChanges++;
    }
  }
  if (i1 < a1.length) {
    const length = a1.length - i1;
    // delete a1[i1 .. a1.length-1] 
    a1.splice(i1, length);
    const visualRowIndex1 = table.toVisualRow(i1);
    table.alter('remove_row', visualRowIndex1, length);
    if (table_getData_length(table) === 0) {
      table.updateSettings({colHeaders});
    }
  } else for (; (i0 < a0.length) && (remainingChanges-- > 0); i0++, i1++) {
    const
    d0 = a0[i0],
    d0Array = rowObjDataToArray(d0, columnNames),
    feature = d0[featureSymbol] || d0?.Block?.[featureSymbol];
    // insert d0
    a1.splice(i1, 0, d0);
    /* append to table, so use countRows(). after insert toVisualRow(i1) will be
     * defined. */
    const visualRowIndex1 = table.countRows();
    tableInsertRow(table, visualRowIndex1, d0Array, feature);
  }

  /** For the edge case (remainingChanges === 0) && (i0 === a0.length) && (i1 >=
   * a1.length) i.e. progressiveMergeLimit changes was exactly enough to
   * complete the merge, the result could be true, but the added complexity of
   * the termination condition isn't warranted by the small time saving.
   */
  return remainingChanges <= 0;
}
/* Footnote to tableRowMerge() re. use of Array.splice() :
 * Alternatives to Array.splice() perform better at various array sizes
 * (https://stackoverflow.com/a/61406956); .splice() performs best at the
 * largest sizes, although likely table lengths are 100-s.
 */

/** row data from .data and .currentData (e.g. d0 and d1 in tableRowMerge())
 * may be (and currently are) in object form :
 * e.g. Object { Block: "rgb(76, 110, 219)", Position: 1420884, Ref: "A", Alt: "G" }
 * The available table set data functions take row data per cell, so
 * convert d0 to e.g. Array(4) [ "rgb(76, 110, 219)", 1420884, "A", "G" ]
 */
function rowObjDataToArray(rowData, columnNames) {
  const
  rowDataArray = Array.isArray(rowData) ?
    rowData :
    columnNames.map((name) => rowData[name]);
  return rowDataArray;
}

function table_getData_length(table) {
  const
  data = table.getData ? table.getData() : table.getSettings()?.data,
  length = data?.length;
  return length;
}

/**
 * @param row visualRowIndex
 * @param rowData row data in array form
 */
function tableSetRowData(table, row, rowData, feature) {
  rowData.forEach((d, col) => table.setDataAtCell(row, col, d));
  setRowAttribute(table, row, /*col*/undefined, feature);
}

/**
 * @param row visualRowIndex
 */
function tableInsertRow(table, row, rowData, feature) {
  table.alter('insert_row', row);
  tableSetRowData(table, row, rowData, feature);
}

/** In matrix-view, the first 4 columns are :
 * Block, Position, Ref, Alt.
 */
const col_Position = 1;


function dataRowKeyFn(d) {
  return d.Position;
}
function dataRowArrayKeyFn(d) {
  return d[col_Position];
}
function featureKeyFn(f) {
  return f.get('value.0');
}

function dataRowCmp(d1, d2) {
  return d1.Position - d2.Position;
}
function dataRowArrayCmp(d1, d2) {
  return d1[col_Position] - d2[col_Position];
}


//------------------------------------------------------------------------------

export {
  tableRowMerge,
};
