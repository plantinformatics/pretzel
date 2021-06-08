import Component from '@ember/component';
import { observer, computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { later as run_later, bind } from '@ember/runloop';

import { alias } from '@ember/object/computed';

import config from '../../../config/environment';
import { nowOrLater } from '../../../utils/ember-devel';


/* global Handsontable */

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/**
 * based on backend/scripts/dnaSequenceSearch.bash : columnsKeyString
 * This also aligns with createTable() : colHeaders below.
 */
const columnsKeyString = [
  'name', 'chr', 'pcIdentity', 'lengthOfHspHit', 'numMismatches', 'numGaps', 'queryStart', 'queryEnd', 'pos', 'end'
];
/** Identify the columns of dataFeatures and dataMatrix.
 */
const c_name = 0, c_chr = 1, c_pos = 8, c_end = 9;
/** Identify the columns of dataForTable, which has an additional 'View' column inserted on the left.
 * so e.g. t_name would be c_name + 1.
 */
const t_view = 0;

/** Display a table of results from sequence-search API request
 * /Feature/dnaSequenceSearch
 * @param search  search inputs and status
 * @param active  true if the tab containing this component is active
 * @param tableModal  true if this component is displayed in a modal dialog
 * This enables the full width of the table to be visible.
 */
export default Component.extend({

  /** Similar comment to data-csv.js applies re. store (user could select server via GUI).
   * store is used by upload-table.js : getDatasetId() and submitFile()
   */
  store : alias('apiServers.primaryServer.store'),
  auth: service('auth'),
  transient : service('data/transient'),

  /*--------------------------------------------------------------------------*/

  /** true means display the result rows as triangles - clickedFeatures. */
  viewFeaturesFlag : true,

  /*--------------------------------------------------------------------------*/

  /** style of the div which contains the table.
   * If this component is in a modal dialog, use most of screen width.
   */
  containerStyle : computed('tableModal', function () {
    return this.get('tableModal') ? 'overflow-x:hidden; width:70vw' : undefined;
  }),

  /*--------------------------------------------------------------------------*/

  /** Result data, split into columns
   */
  dataMatrix : computed('data.[]', function () {
    let
    data = this.get('data'),
    cells = data ? data
      /** the last row is empty, so it is filtered out. */
      .filter((row) => (row !== ''))
      .map((r) => r.split('\t')) :
      [];
    return cells;
  }),
  viewRow : computed('dataMatrix', 'viewFeaturesFlag', function () {
    let
    data = this.get('dataMatrix'),
    viewFeaturesFlag = this.get('viewFeaturesFlag'),
    viewRow  = data.map((row) => viewFeaturesFlag);
    return viewRow;
  }),

  /** Result data formatted for upload-table.js : submitFile()
   */
  dataFeatures : computed('dataMatrix.[]', function () {
    let data = this.get('dataMatrix');
    let features =
    data
      .map((row) => {
        let feature = {
          name: row[c_name],
          // blast output chromosome has prefix 'chr' e.g. 'chr2A'; Pretzel uses simply '2A'.
          block: row[c_chr].replace(/^chr/, ''),
          // Make sure val is a number, not a string.
          val: Number(row[c_pos])
        };
        if (row[c_end] !== undefined) {
          feature.end = Number(row[c_end]);
        }
        return feature;
      });
    dLog('dataFeatures', features.length, features[0]);
    return features;
  }),
  blockNames : computed('dataMatrix.[]', function () {
    let data = this.get('dataMatrix');
    /** based on dataFeatures - see comments there. */
    let names =
    data
      .map((row) =>  row[c_chr].replace(/^chr/, ''));
    dLog('blockNames', names.length, names[0]);
    return names;
  }),
  /** Result data formatted for handsontable : loadData()
   * Prepend a checkbox column.
   */
  dataForTable : computed('dataMatrix.[]', 'viewRow', function () {
    let
    data = this.get('dataMatrix'),
    viewRow = this.get('viewRow'),
    /** prepend with view flag (initially true). Use of [].concat() copies row array (not mutate). */
    rows = data.map((row, i) => [viewRow[i]].concat(row) );
    return rows;
  }),
  dataForTableEffect : computed('table', 'dataForTable.[]', function () {
    let table = this.get('table');
    if (table) {
      table.loadData(this.get('dataForTable'));
    }
  }),

  /*--------------------------------------------------------------------------*/

  didRender() {
    // this.showTable();
    dLog('didRender', this.get('active'), this.get('tableVisible'), this.get('tableModal'));
  },

  willDestroyElement() {
    this.viewFeatures(false);
    this._super(...arguments);
  },

  /*--------------------------------------------------------------------------*/

    /** Map from .dataFeatures to the format required for store.normalize and .push().
     *
     * construct feature id from name + val (start position) because
     * name is not unique, and in a blast search result, a feature
     * name is associated with the sequence string to search for, and
     * all features matching that sequence have the same name.
     * We may use UUID (e.g. thaume/ember-cli-uuid or ivanvanderbyl/ember-uuid).
     */
    dataFeaturesForStore : computed('dataFeatures.[]', function () {
    let
    features = this.get('dataFeatures')
      .map((f) => ({
        _id : f.name + '-' + f.val, name : f.name, blockId : f.block,
        value : [f.val, f.end]}));
      return features;
  }),

  viewAllResultAxesChange(proxy) {
    const fnName = 'viewAllResultAxesChange';
    let checked = proxy.target.checked;
    /** this value seems to be delayed */
    let viewAll = this.get('viewAllResultAxesFlag');
    dLog(fnName, checked, viewAll);

    
  },

  viewFeaturesEffect : computed('dataFeaturesForStore.[]', 'viewFeaturesFlag', 'active', function () {
      /** Only view features of the active tab. */
      let viewFeaturesFlag = this.get('viewFeaturesFlag') && this.get('active');
    this.viewFeatures(viewFeaturesFlag);
  }),
  viewFeatures(viewFeaturesFlag) {
    const fnName = 'viewFeaturesEffect';
    let
    features = this.get('dataFeaturesForStore');
    if (features && features.length) {
      if (viewFeaturesFlag) {
        let parentName = this.get('search.parent');
        dLog(fnName, 'viewDataset', parentName, this.get('search.timeId'));
        this.get('viewDataset')(parentName, true, this.get('blockNames'));
      }
      let
      transient = this.get('transient'),
      datasetName = this.get('newDatasetName') || 'blastResults',
      namespace = this.get('namespace'),
      dataset = transient.pushDatasetArgs(
        datasetName,
        this.get('search.parent'),
        namespace
      );
      let blocks = transient.blocksForSearch(
        datasetName,
        this.get('blockNames'),
        namespace
      );
      /** When changing between 2 blast-results tabs, this function will be
       * called for both.
       *
       * Ensure that for the tab which is becoming active,
       * showFeatures is called after the call for the tab becoming in-active,
       * so that the inactive tab's features are removed from selected features
       * before the active tab's features are added, so that in the case of
       * overlap, the features remain displayed.  Perhaps formalise the sequence
       * of this transition, as the functionality evolves.
       *
       * Modifies selected.features, and hence updates clickedFeaturesByAxis,
       * which is used by axis-ticks-selected.js : featuresOfBlockLookup();
       * renderTicksThrottle() uses throttle( immediate=false ) to allow time
       * for this update.
       */
      nowOrLater(
        viewFeaturesFlag,
        () => transient.showFeatures(dataset, blocks, features, viewFeaturesFlag));
    }
  },

  /*--------------------------------------------------------------------------*/
  /** comments for activeEffect() and shownBsTab() in @see data-csv.js
   * @desc
   * active is passed in from parent component sequence-search to indicate if
   * the tab containing this sub component is active.
   *
   * @param tableVisible x-toggle value which enables display of the table.
   * The user may hide the table for easier viewing of the input
   * parameters and button for adding the result as a dataset.
   */
  activeEffect : computed('active', 'tableVisible', 'tableModal', function () {
    let active = this.get('active');
    if (active && this.get('tableVisible')) {
      this.shownBsTab();
    }
  }),
  shownBsTab() {
    run_later(() => this.showTable(), 500);
  },
  /*--------------------------------------------------------------------------*/


  showTable() {
    // Ensure table is created when tab is shown
    let table = this.get('table');
    if (! table || ! table.rootElement || ! table.rootElement.isConnected) {
      this.createTable();
    } else {
      // trigger rerender when tab is shown
      table.updateSettings({});
      // or .updateSettings({ data : ... })
      table.loadData(this.get('dataMatrix'));
    }
  },

  createTable() {
    const cName = 'upload/blast-results';
    const fnName = 'createTable';
    dLog('createTable');
    $(() => {
      let eltId = this.search.tableId;
      let hotable = $('#' + eltId)[0];
      if (! hotable) {
        console.warn(cName, fnName, ' : #', eltId, ' not found', this);
        return;  // fail
      }
      /**
blast output columns are
query ID, subject ID, % identity, length of HSP (hit), # mismatches, # gaps, query start, query end, subject start, subject end, e-value, score, query length, subject length
      */
      var table = new Handsontable(hotable, {
        data: [[false, '', '', '', '', '', '', '', '', '', '', '', '', '', '']],
        // minRows: 20,
        rowHeaders: true,
        headerTooltips: true,

        /** column field data name is default - array index.  */
        columns: [
          {
            type: 'checkbox',
            className: "htCenter"
          },
          // remaining columns use default type
          { },
          { },
          { },
          { },
          { },
          { },
          { },
          { },
          { },
          { },
          { },
          { },
          { },
          { },
          /*
          {
            data: 'name',
            type: 'text'
          },
          {
            data: 'block',
            type: 'text'
          },
          {
            data: 'val',
            type: 'numeric',
            numericFormat: {
              pattern: '0,0.*'
            }
          }
          */
        ],

        colHeaders: [
          'view', 'query ID', 'subject ID', '% identity', 'length of HSP (hit)', '# mismatches', '# gaps', 'query start', 'query end', 'subject start', 'subject end', 'e-value', 'score', 'query length', 'subject length'
        ],
        height: 500,
        // colWidths: [100, 100, 100],
        manualRowResize: true,
        manualColumnResize: true,
        manualRowMove: true,
        manualColumnMove: true,
        contextMenu: ['undo', 'redo', 'readonly', 'alignment', 'copy'], // true

        // prevent insert / append rows / cols
        minSpareRows: 0,
        minSpareCols: 0,

        sortIndicator: true,
        columnSorting: true,

        afterChange: bind(this, this.afterChange),
        /*
        afterRemoveRow: function() {
        },
        */
        /* see comment re. handsOnTableLicenseKey in frontend/config/environment.js */
        licenseKey: config.handsOnTableLicenseKey
      });
      this.set('table', table);

    });
  },


  clearTable() {
    var table = this.get('table');
    table.updateSettings({data:[]});
  },

  /*--------------------------------------------------------------------------*/

  afterChange(changes, source) {
    let 
    transient = this.get('transient'),
    features = this.get('dataFeaturesForStore');

    if (changes) {
      changes.forEach(([row, prop, oldValue, newValue]) => {
        dLog('afterChange', row, prop, oldValue, newValue);
        /** prop is the property / column index. */
        /** column 0 is the view checkbox. */
        if (prop !== t_view) {
          // no action for other columns
        } else if (row >= features.length) {
          this.set('warningMessage', 'Display of added features not yet supported');
        } else {       
          let feature = transient.pushFeature(features[row]),
              viewFeaturesFlag = newValue;
          transient.showFeature(feature, viewFeaturesFlag);
        }
      });
    }
  },

  /*--------------------------------------------------------------------------*/


  /** upload-table.js : submitFile() expects this function.
   * In blast-results, the data is not user input so validation is not required.
   */
  validateData() {
    /** based on data-csv.js : validateData(), which uses table.getSourceData();
     * in this case sourceData is based on .dataMatrix instead
     * of going via the table.
     */
    return new Promise((resolve, reject) => {
      let table = this.get('table');
      if (table === null) {
        resolve([]);
      }
      let
      validatedData = this.get('dataFeatures');
      resolve(validatedData);
    });
  }



  /*--------------------------------------------------------------------------*/

});
