import Component from '@ember/component';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import ObjectProxy from '@ember/object/proxy';
import PromiseProxyMixin from '@ember/object/promise-proxy-mixin';
import { resolve, all } from 'rsvp';

import { thenOrNow } from '../../utils/common/promises';

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
  ontologyService : service('data/ontology'),
  block : service('data/block'),


  browseTreeEnable : false,

  controlOptions : {
    /** comment in manage-explorer.js */
    showHierarchy : true,
  },

  /*--------------------------------------------------------------------------*/

  didInsertElement() {
    this._super(...arguments);

    dLog("form/feature-edit.js: didInsertElement", this);
    this.set('editOntology', this.ontology);
  },

  /*--------------------------------------------------------------------------*/

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
    cell = hot?.getCell(row, 0);
    if (! cell && hot) {
      let
      selected = hot.getSelected();
      // result is in cell
      selected.any((rect) => (cell = hot.getCell(row, rect[0]) || hot.getCell(row, rect[1])));
    }
    let
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

  /*--------------------------------------------------------------------------*/

  ontologyText : computed('editOntology', function () {
    let name;
    let o = this.editOntology;
    if (o && (name = this.get('ontologyService').getNameViaPretzelServer(o))) {
      if (name && name.then) {
        let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);
        let proxy = ObjectPromiseProxy.create({ promise: resolve(name) });
        name = proxy;
      }
    }
    return name;
  }),

  setFeatureOntology() {
    dLog('inputOntology', this.editOntology);
    this.feature.set('values.Ontology', this.editOntology);
    this.saveFeature(this.editOntology);
    // .then().catch()
  },
  saveFeature(editOntology) {
    let promise = this.feature.save();
    promise
      .then((feature) => {
        this.get('block').featureSaved();
        dLog('saveFeature', feature, this, this.cell);
        let textP = this.get('ontologyText');
        thenOrNow(textP, (text) => this.finishEditing(editOntology + ' : ' + text));
      })
      .catch((err) => {
        dLog('saveFeature', 'err', err, this, arguments);
        this.set('errorMessage', err);
      });
    return promise;
  },
  finishEditing(editOntology) {
    // this.cell.editedValue = editOntology;
    this.displayValue(editOntology);
    // can be used for finishEditing(, callback), but not required - no validity checking configured.
    // let afterCheckCallback = (valid) => dLog('saveFeature', 'afterCheckCallback', valid, arguments); ;
    this.cell.finishEditing(/*restoreOriginalValue*/false, /*ctrlDown*/false, /*callback*/undefined);
    this.close();
  },
  cancel() {
    this.cell.finishEditing(/*restoreOriginalValue*/true, /*ctrlDown*/false, undefined);
    this.selectCell();
    this.close();
  },
  selectCell() {
    let
    p = this.cell.cellProperties,
    hot = this.cell.hot;
    hot.selectCell(p.row, p.col);
  },
  /** Display value in the cell which opened this feature-edit. */
  displayValue(value) {
    let
    p = this.cell.cellProperties,
    hot = this.cell.hot;
    hot.setDataAtCell(p.row, p.col, value /*,default source is 'edit'*/);
    // or elt = ... .getCell(p.row, p.col);     elt.textContent = value;

    hot.selectCell(p.row, p.col);
  },
  showBrowseTree() {
    dLog('showBrowseTree');
    this.set('browseTreeEnable', true);
  },

  /*--------------------------------------------------------------------------*/

  selectExpander(nodeName) {
    dLog('selectExpander', nodeName);
    /** nodeName is e.g. "[CO_321:0001489]  Booting initiation thermal time"
     * trim to just the OntologyId
     */
    let match = nodeName.match(/^\[(CO_[0-9]{3}:[0-9]{7})\]/);
    if (match) {
      nodeName = match[1];
    }
    this.set('browseTreeEnable', false);
    this.feature.set('values.Ontology', nodeName);
    /* ontologyText depends on .editOntology. for setFeatureOntology() it is set by <input>. */
    this.set('editOntology', nodeName);
    this.saveFeature(nodeName);
  },



  /*--------------------------------------------------------------------------*/

});

/*----------------------------------------------------------------------------*/
