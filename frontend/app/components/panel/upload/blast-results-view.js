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

/*----------------------------------------------------------------------------*/

/** Blast databases usually have chr or Chr prefixed to the sub-genome name,
 * e.g. chr7A
 * In the Pretzel database the 'chr' is omitted.
 * This function strips the leading chr / Chr off, so that the chr
 * name can be matched with the block name / scope.
 * This is no longer used - instead the Pretzel scope and blast database
 * (chromosome) scope are configured to be the same.  See related comment in
 * dataFeatures() re. using Block .name instead of .scope; may need a reference
 * dataset.meta configuration for the chromosome prefix of each external
 * database.
 */
function chrName2Pretzel(chrName) {
  return chrName.replace(/^chr/i, '');
}

/*----------------------------------------------------------------------------*/

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
    if (! this.get('viewRow.length')) {
      /** viewFeaturesFlag is initially true, so this will set all viewRow[*] to true. */
      this.viewRowInit(this.get('viewFeaturesFlag'));
    } else {
      this.viewFeaturesFlagIntegrate();
    }

    /** not clear yet where addDataset functionality will end up, so wire this up for now. */
    this.registerDataPipe({
      validateData: () => this.validateData()
    });
  },

  /*--------------------------------------------------------------------------*/

  /** set viewFeaturesFlag false if any of viewRow[*] are false,
   * enabling the user to toggle them all on.
   * The user is able to change the view flag for individual features,
   * and to change all with the viewFeaturesFlag toggle;  these changes are
   * propagated both ways :
   * viewRow  --[viewFeaturesFlagIntegrate()]--> viewFeaturesFlag
   *                <--[viewRowInit()]--
   */
  viewFeaturesFlagIntegrate() {
    dLog('viewRow', this.viewRow, 'viewFeaturesFlag', this.viewFeaturesFlag);
    this.set('viewFeaturesFlag',  ! this.get('viewRow').any((v) => !v));
  },

  /*--------------------------------------------------------------------------*/

  /** style of the div which contains the table.
   * If this component is in a modal dialog, use most of screen width.
   */
  containerStyle : computed('tableModal', function () {
    /** 80vw is wide enough to expose all columns; otherwise get 
     * 'The provided element is not a child of the top overlay' in getRelativeCellPosition()
     * from setupHandlePosition().
     * If the table is wider than the screen, it could be scrolled right then
     * left initially to expose all columns so they get initialised.
     */
    return this.get('tableModal') ? 'overflow-x:hidden; width:90vw' : undefined;
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
  viewRowInit(viewFeaturesFlag) {
    let
    data = this.get('dataMatrix'),
    viewRow  = data.map((row) => viewFeaturesFlag);
    this.set('search.viewRow', viewRow);
    dLog('viewRowInit', data.length, viewRow);
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
          /** Update : Pretzel is switching to using Chr prefix to match with
           * the VCFs, so this is no longer suitable.  A better approach would
           * be, as is done with vcfGenotypeLookup(), to use Block .name to
           * relate to the VCF file chromosome name, and reserve .scope for
           * matching data blocks to their axis.  I.e.  chrName2Pretzel() could
           * map .dataMatrix row[c_chr] from blocks.mapBy('name') to
           * blocks.mapBy('scope'), where blocks is dataset.blocks.toArray() and
           * dataset is as in resultParentBlocks(), i.e.  parentName =
           * this.get('search.parent'); store =
           * this.get('apiServers').get('primaryServer').get('store'), dataset =
           * store.peekRecord('dataset', parentName); which could be a CP.  For
           * the moment it is sufficient to disable use of chrName2Pretzel().
           *
           * Update : resultParentBlocks() now calculates .blockScopes, which is
           * passed from viewFeatures() to blocksForSearch() to enable it to map
           * from result chr name to scope, and set up the result block with
           * corresponding name and scope so that
           * selectedFeaturesOfBlockLookup() -> transientFeaturesLookup() can
           * match axis reference scope with result chr; it also enables
           * .referenceBlock to be defined, which could be used.
           */
          block: /*chrName2Pretzel*/(row[c_chr]),
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
      .map((row) => /*chrName2Pretzel*/(row[c_chr]));
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
    this._super.apply(this, arguments);

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
    /** this action function is called before .viewAllResultAxesFlag is changed. */
    let viewAll = this.get('viewAllResultAxesFlag');
    dLog(fnName, checked, viewAll);
    viewAll = checked;
    // narrowAxesToViewedEffect() will call narrowAxesToViewed() if checked
    /* Potentially viewAllResultAxesFlag===false could mean that axes are not
     * automatically viewed/unviewed in response to user viewing/unviewing features.
     * From user / stakeholder feedback it seems viewAllResultAxesFlag===true will
     * be suitable, and hence viewAllResultAxesFlag===false is not required,
     * so these can be dropped :
     *  viewAllResultAxesChange(), viewAllResultAxesFlag, parentIsViewedEffect().
     *  hbs : checkbox name="viewAllResultAxesFlag"
     *
    this.viewFeatures(viewAll);
    if (! viewAll) {
      this.viewParent(viewAll);
    }
    */
  },
  /** View/Unview all features in the result set.
   */
  viewFeaturesAll(viewAll) {
    this.viewRowInit(viewAll);
    this.viewFeatures();
  },
  viewFeaturesChange(proxy) {
    const fnName = 'viewFeaturesChange';
    let viewFeaturesFlag = proxy.target.checked;
    dLog(fnName, viewFeaturesFlag);
    this.viewFeaturesAll(viewFeaturesFlag);
  },
  viewFeaturesEffect : computed('dataFeaturesForStore.[]', 'viewRow', 'active', function () {
    // viewFeatures() uses the dependencies : dataFeaturesForStore, viewRow, active.
    this.viewFeatures();
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
    /** it is possible that the parent reference does not have blocks with name matching the results (blockNames) */
    blocksByName = this.get('resultParentBlocksByName'),
    blocks = blocksByName;

    /** toView[<Boolean>] is an array of blockNames to view / unview (depending on <Boolean> flag). */
    let
    toView = blockNames.reduce((result, name) => {
      let
      /** undefined if parent does not have block with name matching result; don't display an axis. */
      block = blocks[name],
      /** may be undefined, which is equivalent to false. */
      viewedFeatures = hasViewedFeatures[name] ?? false,
      change = block && (block.get('isViewed') !== viewedFeatures);
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

  parentBlocks : computed('search.parent', function () {
    const fnName = 'parentBlocks';
    let parentName = this.get('search.parent');
    let
    /** lookup on the server selected in dataset explorer, not primary. */
    server = this.get('apiServers').get('serverSelected'),
    store = server.get('store'),
    dataset = store.peekRecord('dataset', parentName);
    /** If parentName not found ...  Same logic as commented in mapview.js : viewDataset().
     */
    if (! dataset) {
      dataset = server?.datasetsBlocks.findBy('name', parentName);
      dLog(fnName, 'serverSelected dataset', dataset, parentName);
    }
    let
    blockNames = this.get('blockNames'),
    blocks = dataset && dataset.get('blocks').toArray()
      .filter((b) => (blockNames.indexOf(b.get('name')) !== -1) );
    /** blockScopes is parallel to blockNames, and enables a mapping
     * from name (result) to scope (axis reference) */
    this.blockScopes = blockNames.map(name => blocks.findBy('name', name)?.scope);
    return blocks;
  }),
  resultParentBlocksByName : computed('parentBlocks', 'blockNames.[]', function () {
    const fnName = 'resultParentBlocksByName';

    let blockNames = this.get('blockNames');
    const
    blocks = this.parentBlocks
      .reduce((result, block) => {result[block.get('name')] = block; return result; }, {});

    if (! blocks.length && blockNames.length) {
      const parentName = this.get('search.parent');
      dLog(fnName, parentName, blockNames, blocks);
    }
    return blocks;
  }),
  /** View the blocks of the parent which are identifeid by .blockNames.
   * @param viewFlag true/false for view/unview
   */
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
  /**
   * @param active  willDestroyElement passes false, otherwise default to this.active.
   */
  viewFeatures(active) {
    const fnName = 'viewFeatures';
    /** Only view features of the active tab. */
    if (active === undefined) {
      active = this.get('active');
    }
    let
    features = this.get('dataFeaturesForStore');
    if (features && features.length) {
      if (active) {
        /* viewParent() could be used initially.
         * viewParent() views all of .blockNames in the parent,
         * whereas narrowAxesToViewed() takes into account .viewRow
         */
        this.narrowAxesToViewed();
        // this.viewParent(viewFeaturesFlag);
      }
      let
      transient = this.get('transient'),
      parentName = this.get('search.parent'),
      /** append parentName to make transient datasets distinct by parent */
      datasetName = this.get('newDatasetName') || ('blastResults_' + parentName),
      namespace = this.get('namespace'),
      dataset = transient.pushDatasetArgs(
        datasetName,
        this.get('search.parent'),
        namespace
      );
      const
      blocksByName = this.get('resultParentBlocksByName'),
      scopesForNames = this.get('blockNames').map(name => blocksByName[name]?.scope || name);
      let blocks = transient.blocksForSearch(
        datasetName,
        this.get('blockNames'),
        this.blockScopes,
        scopesForNames,
        namespace
      );
      transient.datasetBlocksResolveProxies(dataset, blocks);
      this.dataset = dataset;	// for development
      this.blocks = blocks;	//
      run_later(() =>
        this.get('viewDataset')(datasetName, active, blocks.mapBy('name')));

      /** change features[].blockId to match blocks[], which has dataset.id prefixed to make them distinct.  */
      let featuresU = features.map((f) => { let {blockId, ...rest} = f; rest.blockId = dataset.id + '-' + blockId; return rest; });
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
        active,
        /* when switching tabs got : this.isDestroyed===true, this.viewRow and this.get('viewRow') undefined
         * but this.search.viewRow OK */
        () => transient.showFeatures(dataset, blocks, featuresU, active, this.get('viewRow') || this.search.viewRow));
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
      dLog('showTable', p && p.state && p.state());
      p && p.then(() => {
        dLog('showTable then', this.get('data')?.length);
        // alternative : dataForTableEffect() could do this if ! table.
        this.shownBsTab(); });
    } else
    // Ensure table is created when tab is shown
    if (! (table = this.get('table')) ||
        ! table.rootElement ||
        ! table.rootElement.isConnected) {
      if (table) {
        dLog('showTable', table, table.rootElement);
        debugger;
      }
      this.createTable(this.get('dataForTable'));
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

  createTable(data) {
    const cName = 'upload/blast-results';
    const fnName = 'createTable';
    dLog('createTable');
    {
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
        data,
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
          // disable editor
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
          { editor: false },
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

    }

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
    let viewChangeCount = 0;

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
          viewChangeCount++;
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
      if (viewChangeCount) {
        this.viewFeaturesFlagIntegrate();
      }
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
