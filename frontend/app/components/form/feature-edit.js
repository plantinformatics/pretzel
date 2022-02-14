import Component from '@ember/component';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { alias, and } from '@ember/object/computed';

import { resolve, all } from 'rsvp';

import { toPromiseProxy } from '../../utils/ember-devel';
import { thenOrNow } from '../../utils/common/promises';

/* global d3 */
/* global Handsontable */

/*----------------------------------------------------------------------------*/

const trace = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** result of getSelected() is [selection_rect], where selection_rect is :
 *  [start_row, start_col, end_row, end_col], e.g. [ 3, 12, 3, 12 ] for [3,12] - [3,12]
 */
const s_start_row = 0, s_start_col = 1, s_end_row = 2, s_end_col = 3;

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
  row : computed('cell', function row () {
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
      /** getCell(row, 0) may be undefined if column 0 is not in view (scrolled
       * sideways); in this case use hot.getSelected() because the selected
       * columns are likely to be in view, and only the row <tr> is required
       * here (in fact the selected column (s_{start,end}_column) are the column
       * of the OntologyId which is being edited, unless the user has used
       * multiple selections."
       * See also following comment re. this.tableData
       */
      let
      selected = hot.getSelected();
      // result is in cell
      selected.any((rect) => (cell = hot.getCell(row, rect[s_start_col]) || hot.getCell(row, rect[s_end_col])));
    }
    let tr, feature;
    if (cell) {
      tr = cell.parentElement;
      feature = tr?.__dataPretzelFeature__;
    }
    if (! feature && ! (feature = hot.getDataAtRowProp(row, 'dataPretzelFeature')))  {
      /** association of feature with the <tr> via setRowAttributes() is not
       * reliable because of partial rendering - the rows out of view may not be
       * rendered and setRowAttributes() is not called.
       * Associating the feature with the <tr> seems preferable to passing in
       * tableData from the parent component table-brushed, but there may not be
       * a simple way to ensure it is always available - setRowAttribute() and
       * getRowTrElement() seem to ensure that connection in testing so far, but
       * it's a complex solution compared to simply passing in tableData.
       */
      let
      rowData = this.tableData[row];
      feature = rowData?.feature;
    }
    dLog('feature', feature, row, hot, cell, tr);
    return feature;
  }),
  owner : alias('feature.blockId.datasetId.owner'),
  editable : and('owner', 'feature.blockId.isQTL'),
  notEditableMessage : computed('editable', function () {
    let message = 
        (! this.owner) ? 'Edit is available only to the owner of this dataset' :
        (! this.editable) ? 'Ontology ID edit is available only for QTL datasets' :
        null;
    return message;
  }),
  trait : computed('feature', function trait() {
    let feature = this.get('feature'),
        trait = feature?.values?.Trait;
    return trait;
  }),
  ontology : computed('feature', function ontology() {
    let feature = this.get('feature'),
        ontology = feature?.values?.Ontology;
    return ontology;
  }),

  /*--------------------------------------------------------------------------*/

  ontologyText : computed('editOntology', function () {
    let name;
    let o = this.editOntology;
    if (o && (name = this.get('ontologyService').getNameViaPretzelServer(o))) {
      if (name && name.then) {
        let proxy = toPromiseProxy(name);
        name = proxy;
      }
    }
    return name;
  }),

  /** @return url for user to view details of Ontology on the cropOntology.org web site.
   */
  ontologyUrl : computed('editOntology', function () {
    let url;
    let o = this.editOntology;
    if (o) {
      url = 'https://cropontology.org/term/' + o;
    }
    return url;
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
