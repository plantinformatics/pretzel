import { axisFeatureCircles_selectOneInAxis } from '../draw/axis';

/* global d3 */

//------------------------------------------------------------------------------
/** @file Relationship between axes and HandsOnTables, via Features which are the
 * metadata of tables.
 */

/*----------------------------------------------------------------------------*/

const featureSymbol = Symbol.for('feature');

const trace = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** Support featureSymbol for string values, which can't have [Symbol].
 * Convert string to new String() object, then assign reference to Feature
 * to [featureSymbol]
 */
function stringGetFeature(sampleValue) {
  return sampleValue[featureSymbol];
}
/** Convert sampleValue to an Object (new String) if it is not already.
 * to enable assigning a reference using the given Symbol.
 * @return String object
 */
function stringSetSymbol(referenceSymbol, value, reference) {
  const s = (typeof value === 'object') ? value : new String(value);
  s[referenceSymbol] = reference;
  return s;
}
/** Assign a reference to feature to the given sampleValue,
 * converting it to String as required.
 */
function stringSetFeature(sampleValue, feature) {
  return stringSetSymbol(featureSymbol, sampleValue, feature);
}

/*----------------------------------------------------------------------------*/

/** Assign Feature reference to each row.
 * @param table HandsOnTable
 * @param data  array of data which correspond to rows, and is parallel.
 * If dataIsRows then data are Features, otherwise row data which references a feature.
 * @param dataIsRows  data passed to matrix-view may be in the form of columns (displayData), or rows (displayDataRows)
 * The original use of matrix-view formulated the table data as columns
 * corresponding to Blocks, each with an array of Features (parallel positions)
 * manage-genotype :
 * . vcfFeatures2MatrixView() provides the table data as columns, with each column
 *   data element containing an array .features, which is passed as data here.
 *   These are cell values {name, value, [featureSymbol]}.
 * . vcfFeatures2MatrixViewRows() provides the table data as rows, with each row
 *   corresponding to a Position (gtMergeRows) or a Feature (! gtMergeRows).
 */
function setRowAttributes(table, data, dataIsRows) {
  /** genotype data is samples[], and contains samples[i].features
   * These 2 uses should fall into alignment as the genotype table requirements evolve.
   */
  const dataIsColumns = ! dataIsRows && data?.length;
  if (dataIsRows) {
    /* displayDataRows is a sparse array, indexed by Position (value.0)
     * Object.values() returns the non-empty values, which will correspond to the table rows.
     */
    data = Object.values(data);
  }
  // expect that data.length matches  table.countRows()
  data.forEach((feature, physicalRow) => {
    const row = table.toVisualRow(physicalRow);
    if (row === null) {
    } else
    if (dataIsColumns) {
      feature = feature[featureSymbol];

      setRowAttribute(table, row, /*col*/undefined, feature);
    } else if (dataIsRows) {
      const featureColumnValues = Object.values(feature);
      /* feature.Block is no longer defined, so use feature.Ref - it will have
       * features in all rows whereas the dataset columns may not.
       * value String should define [featureSymbol]. 
       * Setting all cells is slow, so maybe set just column 0 as a fall-back.
       * Transitioning away from HandsOnTable would solve this difficulty of
       * associating metadata with table cells.
       */
      feature = (feature.Block || feature.Ref) [Symbol.for('feature')];
      featureColumnValues.forEach((value, physicalCol) => {
        const col = table.toVisualColumn(physicalCol);
        if (col !== null) {
          /* For gtMergeRows, a row can combine several Features, so it may be
           * necessary to use a per-cell value for feature here.
           * Currently used in rowHeaders() for feature .Position, which will be
           * common for Features in a single row.
           * Also used for cell hover (afterOnCellMouseOver() ->
           * tableCoordsToFeature()), and for this it would be useful to have
           * references to the individual features.
           const feature = value[featureSymbol] || stringGetFeature(value);
          */
          setRowAttribute(table, row, col, feature);
        }
      });
    }
  });
}
/**
 * @param row visualRowIndex
 * @param col visualColIndex
 */
function setRowAttribute(table, row, col, feature) {
  /* original table-brushed.js setRowAttributes() used .setRowAttribute(),
   * which used tr.__dataPretzelFeature__; CellMeta seems better.
   * This will transition to use Symbol.for('feature') once all uses are going via this function.
   */
  /* This was intended to save time and unnecessary updates, but it
   * looks like getRowAttribute() -> value() is expensive (also), so
   * try without this :
  if (getRowAttribute(table, row, col) !== feature)
  */
 {
    table.setCellMeta(row, col || 0, 'PretzelFeature', feature);
  }
}
/**
 * @param row visualRowIndex
 * @param col visualColIndex
 */
function getRowAttribute(table, row, col) {
  const fnName = 'getRowAttribute';
  /** The feature reference is constant for the row, and is only stored on col 0
   * (except for setRowAttributes() : dataIsRows), but may have to store on all
   * columns because for wide tables physical col 0 may have visual col null.
   */
  if (col === undefined) {
    col = table.toVisualColumn(/*physical col*/0);
    if (col === null) {
      dLog(fnName, 'col 0 -> null', table.countRows(), table.countCols());
    }
  }
  let
  feature = (col === null) ? undefined : table.getCellMeta(row, col)?.PretzelFeature;

  if (! feature) {
    /** matrix-view no longer uses axis-table.js : setRowAttributes();
     * Using references from cell values, which are available when gtMergeRows;
     * perhaps use matrix-view .data[physicalRow] instead, as in matrix-view : getRowAttribute().
     */
    const
    rowData = table.getDataAtRow(row),
    featureRefn = rowData.find(value => value?.[featureSymbol]);
    feature = featureRefn?.[featureSymbol];
  }
  return feature;
}


function getRowAttributeFromData(table, data, dataIsRows, visualRowIndex) {
  const
  fnName = 'getRowAttributeFromData',
  row = table.toPhysicalRow(visualRowIndex);
  let feature;
  /* based on related : setRowAttributes(table, data, dataIsRows), see comments there. */

  const dataIsColumns = ! dataIsRows && data.length && Array.isArray(data[0].features);
  if (dataIsColumns) {
    const df = data.find(d => d.features?.[0]);
    data = df?.features;
  } else if (dataIsRows) {
    data = Object.values(data);
  }
  feature = data[row];
  feature = feature && feature[featureSymbol];

  return feature;
}



/*----------------------------------------------------------------------------*/

/** table is passed as `this` to afterOnCellMouseOver(), so the surrounding
 * closure is not needed (unless a reference to the parent component becomes
 * required).
 */
function afterOnCellMouseOverClosure(hasTable) {
  /**
   * @param coords 	CellCoords 	Hovered cell's visual coordinate object.
   * refn : https://handsontable.com/docs/javascript-data-grid/api/hooks/#afteroncellmouseover
   */
  function afterOnCellMouseOver(event, coords, TD) {
    let
    table = hasTable.table, // === this
    feature = tableCoordsToFeature(table, coords);
    if (trace) {
      dLog('afterOnCellMouseOver', coords, TD, feature?.name, feature?.value);
    }
    /** clears any previous highlights if feature is undefined */
    highlightFeature(feature);
  }
  return afterOnCellMouseOver;
}

/**
 * @param table HandsOnTable
 * @param coords {row, col}  as passed to afterOnCellMouseDown
 *  coords 	CellCoords 	Hovered cell's visual coordinate object.
 * coords.col may be -1; this is seen in calls from
 * afterOnCellMouseOverClosure(), possibly when the mouse is hovered
 * on the row header
 * @return feature, or undefined if (coords.row === -1)
 */
function tableCoordsToFeature(table, coords) {
  let feature;

  if (coords.row === -1) {
    /* this may be ^A (Select All), or click outside, or click in header row.
     * No feature associated with those so return undefined.
     */
  } else if (table) {
    // getDataAtCell(coords.row, coords.col)
    // table?.getDataAtRow(coords.row);

    /** The meta is associated with column 0.
     * The data is currently the selected feature, which refers to the Ember
     * data object as .feature
     * coords.{row,col} are visual indexes, as required by getRowAttribute().
     */
    const col = coords.col === -1 ? 0 : coords.col;
    feature = getRowAttribute(table, coords.row, col) ||
      getRowAttribute(table, coords.row, /*col*/undefined);
    /*  for dataIsColumns (manage-genotype / matrix-view), this is the Ember
     *  data model feature object; for table-brushed this is the selection
     *  feature, which has attribute .feature which is the Ember object.
     */
    if (feature?.feature) {
      feature = feature.feature;
    }
  }

  return feature;
}

//------------------------------------------------------------------------------

/** @param feature may be name of one feature, or an array of features -
 * selectedFeatures data : {
 *   Chromosome: string : datasetId ':' block name (scope)
 *   Feature: string : feature name
 *   Position: number
 *   feature: ember-data object
 * }
 */
function highlightFeature(feature) {
  const fnName = 'highlightFeature';
  d3.selectAll("g.axis-outer > circle")
    .attr("r", 2)
    .style("fill", "red")
    .style("stroke", "red");
  if (feature) {
    if (Array.isArray(feature)) {
      feature.forEach(
        (f, i) => f ? highlightFeature1(f.feature) : dLog(fnName, f, i, feature));
    } else {
      highlightFeature1(feature);
    }
  }
};

/** Highlight 1 feature, given feature
 * Related : paths-table.js : highlightFeature().
 */
function highlightFeature1(feature) {
  /** see also handleFeatureCircleMouseOver(). */
  axisFeatureCircles_selectOneInAxis(undefined, feature)
    .attr("r", 5)
    .style("fill", "yellow")
    .style("stroke", "black")
    .moveToFront();
};

d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

//------------------------------------------------------------------------------

export {
  stringGetFeature,
  stringSetSymbol,
  stringSetFeature,
  setRowAttributes,
  setRowAttribute,
  getRowAttribute,
  getRowAttributeFromData,
  afterOnCellMouseOverClosure,
  tableCoordsToFeature,
  highlightFeature1,
  highlightFeature,
};
