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

const tableHeight = 500;  // pixels

/*----------------------------------------------------------------------------*/

/**
 * based on backend/scripts/dnaSequenceSearch.bash : columnsKeyString
 * This also aligns with createTable() : colHeaders below.
 */
const columnsKeyString = [
  'name',           // query ID
  'chr',            // subject ID
  'pcIdentity',     // % identity
  'lengthOfHspHit', // length of HSP (hit)
  'numMismatches',  // # mismatches
  'numGaps',        // # gaps
  'queryStart',     // query start
  'queryEnd',       // query end
  'pos',            // subject start
  'end',            // subject end
  'eValue',         // e-value
  'score',          // score
  'queryLength',    // query length
  'subjectLength',  // subject length
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
  apiServers: service(),
  block : service('data/block'),
  transient : service('data/transient'),

  /*--------------------------------------------------------------------------*/

  /** true means display the result rows as triangles - clickedFeatures. */
  viewFeaturesFlag : true,

  /** Control of viewing the axes of the parent blocks corresponding to the result features.
   * Originally a toggle to view all / none;  now constant true, and narrowAxesToViewed() is used.
   */
  viewAllResultAxesFlag : true,

  statusMessage : 'Searching ...',

  /*--------------------------------------------------------------------------*/

  didReceiveAttrs() {
    this._super(...arguments);

    let promise = this.get('search.promise');
    if (promise) {
      promise.catch(() => {
        this.set('statusMessage', 'The search did not complete');
      });
    }

    /** search.viewRow will be undefined when this is the first
     * blast-results-view instance to display this search result.
     */
    if (! this.get('viewRow')) {
      this.viewRowInit();
    } else {
      /** set viewFeaturesFlag false if any of viewRow[*] are false,
       * enabling the user to toggle them all on.
       */
      this.set('viewFeaturesFlag',  ! this.get('viewRow').any((v) => !v));
    }

    /** not clear yet where addDataset functionality will end up, so wire this up for now. */
    this.registerDataPipe({
      validateData: () => this.validateData()
    });
  },

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

    if (data) {
      this.set('statusMessage', (cells.length ? undefined : 'The search completed and returned 0 hits') );
    }
    return cells;
  }),
  viewRowInit() {
    let
    data = this.get('dataMatrix'),
    /** viewFeaturesFlag is initially true */
    viewFeaturesFlag = this.get('viewFeaturesFlag'),
    viewRow  = data.map((row) => viewFeaturesFlag);
    this.set('search.viewRow', viewRow);
  },
  viewRow : alias('search.viewRow'),

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
        // place the remainder of the columns into feature.values
        feature.values = row.reduce((v, c, i) => {
          switch (i) {
          case c_name:
          case c_chr:
          case c_pos:
          case c_end:
            break;
          default:
            v[columnsKeyString[i]] = c;
            break;
          }
          return v;
        }, {});

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
    // probably not required - renders OK without this.
    if (false && this.get('table')) {
      this.shownBsTab();
    }
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
    viewAll = checked;
    this.viewFeatures(viewAll);
    if (! viewAll) {
      this.viewParent(viewAll);
    }
  },

  viewFeaturesChange(proxy) {
    const fnName = 'viewFeaturesChange';
    let viewFeaturesFlag = proxy.target.checked;
    dLog(fnName, viewFeaturesFlag);
    // wait for this.viewFeaturesFlag to change, because viewRowInit() reads it.
    run_later(() => this.viewRowInit());
  },
  viewFeaturesEffect : computed('dataFeaturesForStore.[]', 'viewFeaturesFlag', 'active', function () {
      /** Only view features of the active tab. */
      let viewFeaturesFlag = this.get('viewFeaturesFlag') && this.get('active');
    this.viewFeatures(viewFeaturesFlag);
  }),
  /** if .viewAllResultAxesFlag, narrowAxesToViewed()
   */
  narrowAxesToViewedEffect : computed(
    'viewAllResultAxesFlag', 'dataFeatures', 'blockNames', 'viewRow',
    'resultParentBlocks',
    function () {
      const fnName = 'narrowAxesToViewedEffect';
      if (this.get('viewAllResultAxesFlag'))  {
        this.narrowAxesToViewed();
      }
    }),
  /** unview parent blocks of result features which are de-selected / un-viewed.
   * If parent block has other viewed data blocks on it, don't unview it.
   */
  narrowAxesToViewed () {
    const fnName = 'narrowAxesToViewed';
    let
    blockNames = this.get('blockNames'),
    /** could use dataFeaturesForStore, or feature record handles from transient.pushFeature() */
    features = this.get('dataFeatures'),
    viewRow = this.get('viewRow'),

    /** indexed by block name, true if there are viewed / selected
     * features within this parent block in the result.
     */
    hasViewedFeatures = features.reduce((result, feature, i) => {
      dLog(feature, feature.block, feature.blockId, viewRow[i]);
      if (viewRow[i]) {
        result[feature.block] = true;
      }
      return result; }, {});

    let
    blocks = this.get('resultParentBlocks'),
    /** split resultParentBlocks() into parentBlocks and resultParentBlocksByName(); array result is not required. */
    blocksByName = blocks.reduce((result, block) => {result[block.get('name')] = block; return result; }, {});
    blocks = blocksByName;

    /** toView[<Boolean>] is an array of blockNames to view / unview (depending on <Boolean> flag). */
    let
    toView = blockNames.reduce((result, name) => {
      let
      block = blocks[name],
      /** may be undefined, which is equivalent to false. */
      viewedFeatures = hasViewedFeatures[name] ?? false,
      change = block.get('isViewed') !== viewedFeatures;
      if (change && (viewedFeatures || ! block.get('viewedChildBlocks.length'))) {
        (result[viewedFeatures] ||= []).push(name);
      }
      return result; }, {});

    let
    parentName = this.get('search.parent');
    dLog(fnName, 'viewDataset', parentName, this.get('search.timeId'));
    [true, false].forEach(
      (viewFlag) => toView[viewFlag] && this.get('viewDataset')(parentName, viewFlag, toView[viewFlag]));
  },

  resultParentBlocks : computed('search.parent', 'blockNames.[]', function () {
    const fnName = 'resultParentBlocks';
    let parentName = this.get('search.parent');
    let blockNames = this.get('blockNames');
    let
    store = this.get('apiServers').get('primaryServer').get('store'),
    dataset = store.peekRecord('dataset', parentName);
    let
    blocks = dataset && dataset.get('blocks').toArray()
      .filter((b) => (blockNames.indexOf(b.get('name')) !== -1) );

    dLog('resultParentBlocks', parentName, blockNames, blocks);
    return blocks;
  }),
  viewParent(viewFlag) {
    const fnName = 'viewParent';
    let parentName = this.get('search.parent');
    dLog(fnName, 'viewDataset', parentName, this.get('search.timeId'));
    this.get('viewDataset')(parentName, viewFlag, this.get('blockNames'));
  },
  /** User may un-view some of the parent axes viewed via viewParent();
   * if so, clear viewAllResultAxesFlag so that they may re-view all
   * of them by clicking the toggle.
   * Probably will be replaced by narrowAxesToViewedEffect
   */
  parentIsViewedEffect : computed('block.viewed.[]', 'blockNames.length', function () {
    let parentName = this.get('search.parent');
    /** blocks of parent which are viewed */
    let
    viewedBlocks = this.get('block.viewed')
      .filter((block) => (block.get('datasetId.id') === parentName)),
    allViewed = viewedBlocks.length === this.get('blockNames.length');
    dLog('parentIsViewed', viewedBlocks.length, this.get('blockNames.length'));
    this.set('viewAllResultAxesFlag', allViewed);
  }),
  viewFeatures(viewFeaturesFlag) {
    const fnName = 'viewFeatures';
    let
    features = this.get('dataFeaturesForStore');
    if (features && features.length) {
      if (viewFeaturesFlag) {
        /* viewParent() could be used initially.
         * viewParent() views all of .blockNames in the parent,
         * whereas narrowAxesToViewed() takes into account .viewRow
         */
        this.narrowAxesToViewed();
        // this.viewParent(viewFeaturesFlag);
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
        () => transient.showFeatures(dataset, blocks, features, viewFeaturesFlag, this.get('viewRow')));
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
      /** table.suspendExecution() after tableModal changes, and
       * .resumeExecution() it again in showTable(); this protects
       * handsontable from being confused during move between the two
       * div#blast-results-table-{modal,panel};   without this the table
       * moves to modal ok, but is not shown when moved back.
       *
       * Update : updateSettings({ height : ... } ) is required, and possibly sufficient -
       * it may not be necessary to suspend/resume Execution/Render.
       */
      let table = this.get('table');
      if (table) {
        dLog('activeEffect', 'suspendExecution');
        table.suspendExecution();
        table.suspendRender();
        run_later(() => {
          dLog('activeEffect', 'showTable', 'resumeExecution', this.get('tableModal'));
          table.updateSettings({ height : tableHeight });
          table.refreshDimensions(); table.resumeExecution(); table.resumeRender();
        }, 400);
        // this runs before showTable() from following shownBsTab().
      }
      this.shownBsTab();
    }
  }),
  shownBsTab() {
    run_later(() => this.showTable(), 500);
  },
  /*--------------------------------------------------------------------------*/


  showTable() {
    let table;
    // delay creation of table until data is received
    let data = this.get('data');
    if (! data || ! data.length) {
      let p = this.get('search.promise');
      dLog('showTable', p.state && p.state());
      p.then(() => {
        dLog('showTable then', this.get('data')?.length);
        // alternative : dataForTableEffect() could do this if ! table.
        this.shownBsTab(); });
    } else
    // Ensure table is created when tab is shown
    if (! (table = this.get('table')) ||
        ! table.rootElement ||
        ! table.rootElement.isConnected) {
      this.createTable();
    } else {
      dLog('showTable', table.renderSuspendedCounter);
      /*
      table.resumeExecution();
      table.resumeRender();
      table.render();
      */

      // trigger rerender when tab is shown
      // table.updateSettings({});
      // or .updateSettings({ data : ... })
      table.loadData(this.get('dataForTable'));
      table.refreshDimensions();
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
        height: tableHeight,
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
          let viewRow = this.get('viewRow');
          viewRow[row] = newValue;

          let feature = transient.pushFeature(features[row]),
              viewFeaturesFlag = newValue;
          if (newValue) {
            this.narrowAxesToViewed();
          }
          // wait until axis is shown before showing features
          nowOrLater(
            newValue,
            () => transient.showFeature(feature, viewFeaturesFlag));
          if (! newValue) {
            this.narrowAxesToViewed();
          }
        }
      });
   }
  },

  /*--------------------------------------------------------------------------*/


  /** upload-table.js : submitFile() expects this function.
   * In blast-results, the data is not user input so validation is not required.
   * Add just those features for which the 'viewed' checkbox is clicked.
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
      validatedData = this.get('dataFeatures'),
      // or view = this.get('viewRow'),
      view = table.getDataAtCol(t_view),
      viewed = validatedData.filter((r,i) => view[i]);
      resolve(viewed);
    });
  }



  /*--------------------------------------------------------------------------*/

});
