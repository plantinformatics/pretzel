import { axisFeatureCircles_selectOneInAxis } from '../draw/axis';

/* global d3 */

/*----------------------------------------------------------------------------*/

const featureSymbol = Symbol.for('feature');

// const trace = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** Assign Feature reference to each row. */
function setRowAttributes(table, data) {
  /** genotype data is samples[], and contains samples[i].features
   * These 2 uses should fall into alignment as the genotype table requirements evolve.
   */
  const dataIsColumns = data.length && Array.isArray(data[0].features);
  if (dataIsColumns) {
    data = data[0].features;
  }
  // expect that data.length matches  table.countRows()
  data.forEach((feature, row) => {
    if (dataIsColumns) {
      feature = feature[featureSymbol];
    }
    /* original table-brushed.js setRowAttributes() used .setRowAttribute(),
     * which used tr.__dataPretzelFeature__; CellMeta seems better. */
    table.setCellMeta(row, 0, 'PretzelFeature', feature);
  });
}

/*----------------------------------------------------------------------------*/

/** table is passed as `this` to afterOnCellMouseOver(), so the surrounding
 * closure is not needed (unless a reference to the parent component becomes
 * required).
 */
function afterOnCellMouseOverClosure(hasTable) {
  function afterOnCellMouseOver(event, coords, TD) {
    let
    table = hasTable.table, // === this
    feature = tableCoordsToFeature(table, coords);
    dLog('afterOnCellMouseOver', coords, TD, feature?.name, feature?.value);
    /** clears any previous highlights if feature is undefined */
    highlightFeature(feature);
  }
  return afterOnCellMouseOver;
}

/**
 * @param table HandsOnTable
 * @param coords {row, col}  as passed to afterOnCellMouseDown
 * @return feature, or undefined if (coords.row === -1)
 */
function tableCoordsToFeature(table, coords) {
  let feature;

  if (coords.row === -1) {
    /* this may be ^A (Select All), or click outside, or click in header row.
     * No feature associated with those so return undefined.
     */
  } else {
    // getDataAtCell(coords.row, coords.col)
    // table?.getDataAtRow(coords.row);

    /** The meta is associated with column 0.
     * The data is currently the selected feature, which refers to the Ember
     * data object as .feature
     */
    feature = table?.getCellMeta(coords.row, 0)?.PretzelFeature;
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

/** Highlight 1 feature, given feature */
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


export {
  setRowAttributes,
  afterOnCellMouseOverClosure,
  tableCoordsToFeature,
  highlightFeature1,
  highlightFeature,
};
