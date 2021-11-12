import Component from '@ember/component';
import { computed } from '@ember/object';


/* global d3 */
/* global Handsontable */

/*----------------------------------------------------------------------------*/

const trace = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

function findPropColumn(hot, row, propName) {
h.getCellMeta(0,6)
h.countSourceCols()

}

/*----------------------------------------------------------------------------*/

export default Component.extend({

  didInsertElement() {
    this._super(...arguments);

    dLog("form/feature-edit.js: didInsertElement", this);
  },
  columnIndexes : computed('cell', function columnIndexes () {
    let
    hot = this.get('cell.hot'),
    length = hot.countSourceCols(),
    range = Array.from({length}, (v,k) => k + 1);
    return range;
  }),
  row : computed('cell', function columnIndexes () {
    let
    cell = this.get('cell'),
    row = cell.cellProperties.row;
    return row;
  }),
  columnHeadings : computed('columnIndexes', function columnHeadings () {
    let
    hot = this.get('cell.hot'),
    columnIndexes = this.get('columnIndexes'),
    columnHeadings = columnIndexes.map((i) => hot.getCellMeta(0, i).prop);
    return columnHeadings;
  }),
  columnHeading2Index : computed('columnHeadings', function columnHeading2Index () {
    let
     columnHeading2Index = this.get('columnHeadings')
      .reduce((result, heading, i) => {
        result[heading] = i;
        return result;
      }, {});
    dLog('columnHeading2Index', columnHeading2Index);
    return columnHeading2Index;
  }),

  trait0 : computed('columnHeading2Index', function () {
    let
    columnHeading2Index = this.get('columnHeading2Index'),
    hot = this.get('cell.hot'),
    row = this.get('row'),
    columnIndex = columnHeading2Index.Trait,
    trait = hot?.getValue(row, columnIndex);
    dLog('trait', trait, hot, row, columnIndex);
    return trait;
  }),

  feature : computed('row', function feature() {
    let
    row = this.get('row'),
    hot = this.get('cell.hot'),    
    /** similar to setRowAttributes() */
    cell = hot?.getCell(row, 0),
    tr = cell?.parentElement,
    feature = tr?.__dataPretzelFeature__;
    dLog('feature', feature, row, hot, cell, tr);
    return feature;
  }), 
  trait : computed('feature', function trait() {
    let feature = this.get('feature'),
        trait = feature?.values.Trait;
    return trait;
  }),
  ontology : computed('feature', function ontology() {
    let feature = this.get('feature'),
        ontology = feature?.values.Ontology;
    return ontology;
  }),

});

/*----------------------------------------------------------------------------*/
