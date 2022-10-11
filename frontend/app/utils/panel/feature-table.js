// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

/** Handle selection in a handsOnTable when has feature rows.
 * Used by afterSelection() in table-brushed.js and matrix-view.js.
 * See also ./axis-table.js
 */
function afterSelectionFeatures(table, row, col) {
  const fnName = 'afterSelectionFeatures';
  const data = this.get('data');
  let features;

  // ^A (Select All) causes row===-1, col===-1
  if (row === -1) {
    features = data;
  } else {
    const
    ranges = table.selection?.selectedRange?.ranges;
    features = data?.length && ranges && ranges.reduce((fs, r) => {
      /** from,to are in the order selected by the user's click & drag.
       * ^A can select row -1.
       */
      dLog('afterSelection', r.from.row, r.to.row);
      let ft = [r.from.row, r.to.row].sort();
      for (let i = Math.max(0, ft[0]); i <= ft[1]; i++) {
        let f = data[i];
        fs.push(f);
      }
      return fs;
    }, []);
  }

  dLog('afterSelection', features, table, row, col);
  this.set('tableSelectedFeatures', features);
  /* in the case of table-brushed, the caller will also set
   * this.controls.tableSelectedFeatures.  That is used by
   * panel/sequence-search, and hence not applicable to manage-genotype
   * because vcfLookup features do not define .values.Sequence
   */
  /* because of data transpose row/column, data from manage-genotype does not
   * currently have features .feature or [Symbol.for('feature')] */
  if (! this.blockSamples) {
    this.highlightFeature(features);
  }

  return features;
}

// -----------------------------------------------------------------------------

export {
  afterSelectionFeatures,
};
