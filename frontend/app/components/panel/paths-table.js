import { allSettled } from 'rsvp';
import { once, later, debounce, throttle } from '@ember/runloop';
import { computed, observer } from '@ember/object';
import Component from '@ember/component';
import $ from 'jquery';
import { inject as service } from '@ember/service';

/* global d3 */
/* global Handsontable */


import PathData from '../draw/path-data';
import {
  pathsResultTypes,
  pathsApiResultType,
  pathsResultTypeFor,
  featureGetFn,
  featureGetBlock
} from '../../utils/paths-api';
import { eltClassName } from '../../utils/domElements';
import { toTitleCase } from '../../utils/string';
import config from '../../config/environment';


const dLog = console.debug;
const trace = 0;
/** for trace */
const fileName = 'panel/paths-table.js';

const columnFields = ['block', 'feature', 'position', 'positionEnd'];
const capitalize = toTitleCase;
const columnFieldsCap = columnFields.map(capitalize);

/** Concat the given arrays.
 * If either array is empty then return the other array (possibly Array.concat()
 * does this optimisation already).
 * Used in tableData() - it is expected in this use case that one or both of
 * tableData{,Aliases} will commonly be empty.
 */
function concatOpt(a, b) {
  let c = (a.length && b.length) ? a.concat(b)
    : (b.length ? b : a);
  return c;
}


/** .moveToFront() is used in highlightFeature()
 * table-brushed.js:highlightFeature() will also install (and override) this.
 */
if (! d3.selection.prototype.moveToFront) {
    d3.selection.prototype.moveToFront = function() {
      return this.each(function(){
        this.parentNode.appendChild(this);
      });
    };
}


/** id of element which will hold HandsOnTable. */
const hoTableId = 'paths-table-ho';


/**
 * Arguments passed to template :
 * @param selectedFeatures  catenation of features within all brushed regions
 * @param selectedBlock block selected via axis brush, or via click in dataset explorer or view panel, or adding the block.
 * @param visible true when the tab containing the paths-table is selected.
 * value is : mapview .get('layout.right.tab') === 'paths',
 * This enables paths-table to provide continuous display of pathsCount in the tab,
 * even while the table is not displayed.
 * The paths-table component could be split into a calculation component and a display component.
 * The calculation is parameterised by user selections and actions so a service doesn't seem suited.
 *
 * @desc inputs from template
 * @param blockColumn true means show the block name:scope in a column instead of as a row.
 *
 * @desc attributes
 * @param loading true indicates the requestAllPaths() API request is in progress.
 */
export default Component.extend({
  flowsService: service('data/flows-collate'),
  pathsPro : service('data/paths-progressive'),
  axisBrush: service('data/axis-brush'),

  config,
  /** The value useHandsOnTable is a switch to select either HandsOnTable or
   * ember-contextual-table.   If licenseKey is given, use HandsOnTable.
   *
   * handsOnTableLicenseKey may be defined in the environment built into the app,
   * or it may be received from server runtime environment by getHoTLicenseKey(),
   * in which case this CP value is updated.
   * Check if reply to getHoTLicenseKey() is received and contains a key.
   */
  get useHandsOnTable() {
    return !!config.handsOnTableLicenseKey;
  },
  /** true enables display of the 'block' column for each end of the path. */
  blockColumn : true,
  /** true enables checkboxes to enable the following in the GUI  */
  devControls : false,
  /** true enables display of the brushedDomains in the table.  */
  showDomains : false,
  /** true enables display in the table of paths counts pre & post filter.   */
  showCounts : false,
  /** true filters out paths which do not have >=1 end in a brush. */
  onlyBrushedAxes : true,

  classNames: ['paths-table', 'right-panel-paths', 'h-100'],

  didInsertElement() {
    this._super(...arguments);

    if (! this.get('useHandsOnTable')) {
      $(".contextual-data-table", this.element).colResizable({
        liveDrag:true,
        draggingClass:"dragging"
      });
    }

    /** trigger the initial display of tableData.length (pathsCount) in tab.
     * Another approach would be to yield this from the template, and in
     * mapview.hbs ember-wormhole the count into span.badge (in button-tab paths
     * Paths).
     */
    later(() => this.get('tableData.length'), 2000);
  },

  willDestroyElement() {
    /*  clear display of paths count so that if it changes while right panel is
     *  closed, tab doesn't display old count when re-opened.  (possibly the count display
     *  would be refreshed anyway, so this may not be essential).  */
    this.sendUpdatePathsCount('');
    this.destroyHoTable();

    this._super(...arguments);
  },

  didReceiveAttrs() {
    this._super(...arguments);

    if (trace)
      dLog('didReceiveAttrs', this.get('block.id'), this);
  },

  didRender() {
    this._super.apply(this, arguments);

    if (trace)
      dLog(fileName + " : didRender()");
    this.manageHoTable();
  },

  /** Create & destroy the HandsOnTable as indicated by .visible (layout.right.tab === 'paths')
   * The sibling panel manage-features also has a HandsOnTable, and there seems
   * to be a clash if they coexist.

   * The paths-table component exists permanently so that it can provide
   * tableData.length for display in the tab via updatePathsCount().
   */
  manageHoTable : observer('visible', function() {
    let useHandsOnTable = this.get('useHandsOnTable');
    if (useHandsOnTable) {
      let
        visible = this.get('visible'),
      table = this.get('table');

      dLog('manageHoTable', visible, table, this);
      /* If the paths-table component was split into a calculation component and
       * a display component, then these 2 parts would go into the
       * didInsertElement() and willDestroyElement() of the display component.
       */
      if (visible && ! table) {
        /* Using run.later() here prevents an overlap in time between the
         * HandsOnTable-s of Features and Paths tables, when switching from
         * Features to Paths.
         */
        later(() => {
          if (! this.get('table')) {
            this.set('table', this.createHoTable(this.get('tableData')));
          }
        });
      }
      if (! visible && table) {
        this.destroyHoTable();
      }
    }
  }),

  destroyHoTable() {
    let table = this.get('table');
    dLog('destroyHoTable', table);
    if (table) {
      if (! table.isDestroyed) {
        table.destroy();
      }
      this.set('table', null);
    }
  },


  /*--------------------------------------------------------------------------*/

  actions: {

    selectionChanged: function(selA) {
      dLog("selectionChanged in components/panel/paths-table", selA);
      for (let i=0; i<selA.length; i++) {
        dLog(selA[i].feature, selA[i].position);
      }
    },
    requestAllPaths() {
      this.requestAllPaths();
    },
    showData(d)
    {
      this.showData(d);
    },
  },

  sendUpdatePathsCount(pathsCount) {
    once(() => {
      if (! this.isDestroying) {
        this.updatePathsCount(pathsCount);
      }
    });
  },


  /*--------------------------------------------------------------------------*/

  /** Reduce the selectedFeatures value to a structure grouped by block.
   *
   * The form of the input selectedFeatures is an array of :
   * e.g. : {Chromosome: "myMap:1A.1", Feature: "myMarkerA", Position: "12.3"}
   */
  selectedFeaturesByBlock : computed(
    'selectedFeatures.[]',
    function () {

    let selectedFeatures = this.get('selectedFeatures');
    /** map selectedFeatures to a hash by block (dataset name and scope).
     * selectedFeatures should be e.g. a WeakSet by feature id, not name.
     */
    let selectedFeaturesByBlock = selectedFeatures ?
      selectedFeatures.reduce(function(result, feature) {
        if (feature.Chromosome) {
          if (! result[feature.Chromosome])
            result[feature.Chromosome] = {};
          result[feature.Chromosome][feature.Feature] = feature;
        }
        return result;
      }, {}) : {};
      return selectedFeaturesByBlock;
    }),


  /*--------------------------------------------------------------------------*/

  /** Store a mapping from the text of the Block cells to the block-adj of the
   * path of the row.
   * This is used to lookup block-adj from the row data, by toggleSyntenyFilter().
   */
  blockLabelsToBlockAdjs() {
    const
    blockLabelToBlockAdj = (this.blockLabelToBlockAdj ||= {}),
    blockAdjs = this.get('flowsService.blockAdjs');
    blockAdjs?.forEach((blockAdj) => {
      let
      blocks = blockAdj.get('blocks'),
      blockAdjLabel = blocks.map((block) => block.get('datasetNameAndScope'))
        .join('_');
      blockLabelToBlockAdj[blockAdjLabel] = blockAdj;
    });
  },

  //----------------------------------------------------------------------------

  /**
   * also in utils/paths-filter.js @see pathInDomain()
   */
  filterPaths(pathsResultField) {

    let selectedBlock = this.get('selectedBlock');
    let selectedFeaturesByBlock = this.get('selectedFeaturesByBlock');
    let axisBrush = this.get('axisBrush');
    /** true means show the block name:scope in a column instead of as a row. */
    let blockColumn = this.get('blockColumn');
    /** true means if the position is an interval, also show the end of the interval.  */
    let showInterval = this.get('showInterval');
    let devControls = this.get('devControls');
    /** true means show the brushed domains in the table. This may be omitted, although it
     * seems important to know if the axis was brushed and what the region
     * was.  */
    let showDomains = this.get('showDomains');
    /** true means show counts of paths before and after filtering in the table.  */
    let showCounts = this.get('showCounts');
    let onlyBrushedAxes = this.get('onlyBrushedAxes');


    let
      blockAdjs = this.get('flowsService.blockAdjs'),
    tableData = ! blockAdjs ? [] : blockAdjs.reduce(function (result, blockAdj) {
      // components/panel/manage-settings.js:14:        return feature.Block === selectedBlock.id
      if (! selectedBlock || blockAdj.adjacentTo(selectedBlock)) {
        /** Prepare a row with a pair of values to add to the table */
        function setEndpoint(row, i, block, feature, position) {
          if (block)
            row['block' + i] = block;
          row['feature' + i] = feature;
          if (showInterval && position.length) {
            row['position' + i] = position[0];
            row['positionEnd' + i] = position[1];
          }
          else
            row['position' + i] = position;
          return row;
        };
        let blocks = blockAdj.get('blocks'),
          blocksById = blocks.reduce((r, b) => { r[b.get('id')] = b; return r; }, {});
        let blockIndex = blockAdj.get('blockIndex');
        if (devControls && ! blockColumn) {
          /** push the names of the 2 adjacent blocks, as an interleaved title row in the table.
           * This may be a useful feature for some users, but for now is only
           * enabled as a development check.
           */
          let
          namesFlat = blocks.reduce(
            (rowHash, b, i) =>
              setEndpoint(rowHash, i, undefined, b.get('datasetId.id'), b.get('scope')), {});
          // blank row to separate from previous blockAdj
          result.push({'feature0': '_'});
          result.push(namesFlat);
        }
        if (showDomains) {
          /** Add to the table the brushed domain of the 2 blocks. */
          let brushedDomains = blocks.reduce((rowHash, b, i) => {
            let ab = axisBrush.brushOfBlock(b),
            brushedDomain = ab && ab.get('brushedDomain');
            if (brushedDomain) {
              setEndpoint(rowHash, i, undefined, undefined, brushedDomain);
            }
            return rowHash;
          }, {});
          result.push(brushedDomains);
        }

        let resultElts = blockAdj.get(pathsResultField);
        if (resultElts) {
        if (resultElts.length)
          if (showCounts)
            result.push(setEndpoint({}, 0, undefined, 'Paths loaded', resultElts.length));
          let outCount = 0;
          resultElts.forEach((resultElt) => {
            /** for each end of the path, if the endpoint is in a brushed block,
             * filter out if the endpoint is not in the (brushed)
             * selectedFeatures.
             */

            let
              pathsResultTypeName = pathsResultField.replace(/Filtered$/, ''),
              pathsResultType = pathsResultTypeFor(pathsResultTypeName, resultElt);


            /** accumulate names for table, not used if out is true. */
            let path = {};
            /** Check one endpoint of the given path resultElt
             * @param resultElt one row (path) of the paths result
             * @param i 0 or 1 to select either endpoint of the path resultElt
             * @param path  array to accumulate path endpoint details in text form for table output
             * @return { axisBrushed : axis is brushed,
             * out : axis is brushed and path endpoint is not in the brush (i.e. not in selectedFeatures)
             * }
             */
            function filterOut(resultElt, i, path) {
              let
                blockId = pathsResultType.pathBlock(resultElt, i),
              /** each end may have multiple features - should generate the
               * cross-product as is done in block-adj.c : pathsOfFeature()
               */
              features = pathsResultType.blocksFeatures(resultElt, i),
              feature = features[0],
              featureGet = featureGetFn(feature),
              block = featureGetBlock(feature, blocksById),
              /** selected features are grouped by data block name.  */
              chrName = block.get('brushName'),
              selectedFeaturesOfBlock = selectedFeaturesByBlock[chrName],
              featureName = featureGet('name'),
              /** if the axis is brushed but there are no features in this block
               * within the brush, then selectedFeaturesOfBlock will be
               * undefined (empty).  If ! onlyBrushedAxes and the axis is not
               * brushed then no filter is applied on this endpoint.
               */
              isBrushed = !!axisBrush.brushOfBlock(block),
              /** out means path end is excluded from a brush, i.e. there is a
               * brush on the axis of the path end, and the path end is not in it.
               * (the requirement was changed after commit a6e884c, and
               * onlyBrushedAxes was added).
               */
              out = selectedFeaturesOfBlock ?
                /* endpoint feature is not in selectedFeaturesOfBlock */
                ! selectedFeaturesOfBlock[featureName]
                /* end axis is brushed, yet feature is not selected, so it is out. */
                : isBrushed;
              {
                let value = featureGet('value');
                let i = blockIndex.get(block);
                path['block' + i] = block.get('datasetNameAndScope');
                if (value.length) {
                  path['position' + i] = value[0];
                  path['positionEnd' + i] = value[1];
                }
                else
                  path['position' + i] = '' + value;
                path['feature' + i] = featureName;
              }
              return {axisBrushed : isBrushed, out};
            }
            /** Considering the axes of each end of the path : 
             * . one brushed : show paths with an end in the brush
             * . both brushed : show paths with ends in both brushes
             * . neither brushed : don't show
             *
             * Evaluate both because they populate path, and path is in if
             * either end is in a brush, but out if both ends are not in a brush
             * on its axis. */
            let ends = [0, 1].map((i) => filterOut(resultElt, i, path)),
            out = (ends[0].out || ends[1].out) || (onlyBrushedAxes ? (! ends[0].axisBrushed && ! ends[1].axisBrushed) : false);
            if (! out) {
              result.push(path);
              outCount++;
            }
          });
          if (showCounts)
            result.push(setEndpoint({}, 0, undefined, 'Filtered Count', outCount));
        }
      }
      return result;
    }, []);

    dLog('filterPaths',  tableData.length, blockAdjs);
    return tableData;
  },

  /** Map the paths (direct and by-alias) for each block-adj bounding
   * selectedBlock into an array formatted for display in the table (either
   * ember-contextual-table or HandsOnTable).
   */
  tableData : computed(
    'pathsResultFiltered.[]',
    'pathsAliasesResultFiltered.[]',
    'selectedBlock',
    'selectedFeaturesByBlock.@each',
    'blockColumn',
    'showInterval',
    'showDomains',
    'showCounts',
    'onlyBrushedAxes',
    function () {
      let tableData = this.filterPaths('pathsResultFiltered');
      if (tableData.length < 20)
        dLog('tableData', tableData);
      let tableDataAliases = this.filterPaths('pathsAliasesResultFiltered');
      if (tableDataAliases.length < 20)
        dLog('tableDataAliases', tableDataAliases);
      let data = concatOpt(tableData, tableDataAliases);
      this.sendUpdatePathsCount(data.length);
      this.blockLabelsToBlockAdjs();
      return data;
    }),

  /** From columnFields, select those columns which are enabled.
   * The blockColumn flag enables the 'block' column.
   */
  activeFields :  computed('blockColumn', 'showInterval', function () {
    let activeFields = columnFields.slice(this.get('blockColumn') ? 0 : 1);
    if (! this.get('showInterval'))
      activeFields.pop(); // pop off : positionEnd
    return activeFields;
  }),
  /** Generate the names of values in a row.  */
  rowValues : computed('activeFields', function () {
    let activeFields = this.get('activeFields');
    let rowValues =
    [0, 1].reduce(function (result, end) {
      activeFields.reduce(function (result, fieldName) {
        result.push(fieldName + end);
        return result;
      }, result);
      return result;
    }, []);
    return rowValues;
  }),
  /** Generate the column headings row.
   */
  headerRow : computed('rowValues', function () {
    let headerRow = this.get('rowValues').map((fieldName) => capitalize(fieldName));
    dLog('headerRow', headerRow);
    return headerRow;
  }),
  /** Map from tableData to the data form used by the csv export / download.
   */
  csvExportData : computed('tableData', 'blockColumn', function () {
    let activeFields = this.get('activeFields');
    /** column header text does not contain punctuation, but wrapping with
     * quotes may help clarify to Xl that it is text.
     */
    let headerRow = this.get('headerRow').map((name) => '"' + name + '"');

    let data = this.get('tableData').map((d, i) => {
      let da =
      [0, 1].reduce(function (result, end) {
        activeFields.reduce(function (result, fieldName) {
          // if undefined, push '' for a blank cell.
          let v = d[fieldName + end],
          outVal = (v === undefined) ? '' : ((typeof v !== "string") ? v: format(fieldName, v));
          /** Format some table cell values : wrap text values with double-quotes;
           * If the position field is an interval it will present here as a
           * string containing the start&end locations of the interval,
           * separated by a comma - change the comma to a semi-colon.
           *
           * With the addition of showInterval, intervals won't be expressed as
           * strings containing comma, so most of this will be not needed, can
           * be reduced to just the quoting.
           *
           * @param fieldName one of columnFields[]
           * @param v is type "string" and is not undefined.
           */
          function format (fieldName, v) {
            let
              /** wrap text fields with double-quotes, and also position with comma - i.e. intervals 'from,to'.  */
              quote = (fieldName === 'block') || (fieldName === 'feature') || (v.indexOf(',') > -1),
            /** If position value is an interval, it will appear at this point as 'number,number'.
             * What to use for interval separator ?  There is a convention of using
             * '-' for intervals in genome data, but that may cause problems in a
             * csv - Excel may evaluate it as minus.   In a tsv ',' would be ok.
             * For now use ':'. */
            v1 = v.replace(/,/, ':'),
            outVal = quote ? '"' + v1 + '"' : v1;
            return outVal;
          }
          result.push(outVal);
          return result;
        }, result);
        return result;
      }, []);
      if (i === 0)
        dLog('csvExportData', d, da);
      return da;
    });
    data.unshift(headerRow);
    return data;
  }),

  /** Convert each element of the array tableData from name:value hash/object to
   * an array, with 1 element per column.
   * Added for hoTable, but not required as HO also accepts a name:value hash,
   * as an alternative to an array per row.
   */
  tableDataArray : computed('tableData.[]', function () {
    let activeFields = this.get('activeFields');
    /** this could be used in csvExportData() - it also uses an array for each row. */
    let data = this.get('tableData').map(function (d, i) {
      let da =
      [0, 1].reduce(function (result, end) {
        activeFields.reduce(function (result, fieldName) {
          // if undefined, push '' for a blank cell.
          let v = d[fieldName + end],
          outVal = v ? v : '';
          result.push(outVal);
          return result;
        }, result);
        return result;
      }, []);

      if (trace && (i === 0))
        dLog('tableDataArray', d, da);
      return da;
    });
    return data;
  }),


  /*--------------------------------------------------------------------------*/

  /** Send API request for the block-adj-s displayed in the table, with
   * fullDensity=true, i.e. not limited by GUI path densityFactor / nSamples /
   * nFeatures setings.
   */
  requestAllPaths() {
    dLog('requestAllPaths', this);

    let selectedBlock = this.get('selectedBlock');
    let loadingPromises = [];

    let pathsPro = this.get('pathsPro');
    pathsPro.set('fullDensity', true);

    let
      blockAdjs = this.get('flowsService.blockAdjs');
    blockAdjs?.forEach(function (blockAdj) {
      if (! selectedBlock || blockAdj.adjacentTo(selectedBlock)) {
        let p = blockAdj.call_taskGetPaths();
        loadingPromises.push(p);
      }
    });
    pathsPro.set('fullDensity', false);

    /* set .loading true while API requests are in progress. */
    if (loadingPromises.length) {
      let all = allSettled(loadingPromises);
      this.set('loading', true);
      all.then(() => this.set('loading', false));
    }

  },
  /*--------------------------------------------------------------------------*/

  /**
   * @param data array of [block, feature, position, block, feature, position].
   * see columnFields, activeFields.
   */
  showData : function(data)
  {
    if (trace && data.length < 20)
      dLog("showData", data);
    let table = this.get('table');
    if (table && ! table.isDestroyed)
    {
      table.loadData(data);
    }
  },

  /** for HO table configuration.   */
  columns : computed('rowValues', function () {
    let columns = this.get('rowValues').map((name) => {
      let options = { data : name};
      if (name.match(/^position/)) {
        options.type = 'numeric';
        options.numericFormat = {
          pattern: '0,0.*'
        };
      }
      else
        options.type = 'text';
      return options;
    });
    return columns;
  }),

  /** for HO table configuration. */
  colTypes : {
      block    : { width : 100, header : '<span title = "e.g. chromosome or linkage group">Block</span>'},
      feature  : { width : 135, header : '<span title = "e.g. marker / gene">Feature</span>'},
      position : { width :  60, header : 'Position'},
      positionEnd : { width : 60, header : 'Position End'}
    },
  /** for HO table configuration.
   *
   * colTypeNames and colHeaders could also be used for generating
   * filterableColumn / sortableColumn in the template, although for the current
   * number of columns it probably would not reduce the code size.
   */
  colTypeNames : computed('rowValues', function () {
    let colTypeNames = this.get('rowValues').map((name) => {
      return name.replace(/[01]$/, '');
    });
    return colTypeNames;
  }),
  /** for HO table configuration. */
  colHeaders : computed('colTypeNames', function () {
    let colTypes = this.get('colTypes'),
    colHeaders = this.get('colTypeNames').map((name) => colTypes[name].header);
   return colHeaders;
  }),
  /** for HO table configuration.
   * HO column settings (columns, colHeaders, colWidths) could be combined into
   * a single CP, but the widths will change depending on window resize,
   * independent of columns changing.
   */
  colWidths : computed('colTypeNames', function () {
    let colTypes = this.get('colTypes'),
     colWidths =  this.get('colTypeNames').map((name) => colTypes[name].width);
    return colWidths;
  }),

  createHoTable: function(data) {
    /** copied from table-brushed.js */
    var that = this;
    dLog("createHoTable", this);

    let tableDiv = $('#' + hoTableId)[0];

    const contextMenu = {
      items: {
        "toggleSyntenyFilter": {
          name: 'Toggle synteny filter',
          callback: this.toggleSyntenyFilter.bind(this),  // (name, range, event) => 
        },
      },
    };

    dLog("tableDiv", tableDiv);
    var table = new Handsontable(tableDiv, {
      data: data || [['', '', '']],
      minRows: 1,
      rowHeaders: true,
      columns: this.get('columns'),
      colHeaders: this.get('colHeaders'),
      headerTooltips: true,
      /** in table-brushed.js colWidths and stretchH are controlled by
       * autoColumnWidth and stretchHorizontal respectively.
       * Those values are effectively both true in paths-table.
      colWidths: this.get('colWidths'),
      */
      stretchH : 'all',
      height: '100%',
      manualRowResize: true,
      manualColumnResize: true,
      manualRowMove: true,
      // manualColumnMove: true,
      copyPaste: {
        /** increase the limit on copy/paste.  default is 1000 rows. */
        rowsLimit: 10000
      },
      // disable editing, refn: https://stackoverflow.com/a/40801002
      readOnly: true, // make table cells read-only
      contextMenu,
      comments: false, // prevent editing of comments

      sortIndicator: true,
      multiColumnSorting: true,
      /* see comment re. handsOnTableLicenseKey in frontend/config/environment.js */
      licenseKey: config.handsOnTableLicenseKey
    });

    $('#' + hoTableId).on('mouseleave', function(e) {
      that.highlightFeature();
    }).on("mouseover", function(e) {
      if (e.target.tagName == "TD") {
        var tr = e.target.parentNode;
        /** determine which half of the table the hovered cell is in, the left or right,
         * and identify the feature cell in this row, in that half of the table. */
        let row = Array.from(e.target.parentElement.childNodes),
        colIndex = row.indexOf(e.target),
        featureIndex = (colIndex > (1 + 2)) * (1 + 2) + (1 + 1),
        featureNode = tr.childNodes[featureIndex];
        if (featureNode) {
          var feature_name = $(featureNode).text();
          if (feature_name && feature_name.length && (feature_name.indexOf(" ") == -1)) {
            that.highlightFeature(feature_name);
            return;
          }
        }
      }
      // that.highlightFeature();
    });
    return table;
  },


  onDataChange: observer('tableData', function () {
    let data = this.get('tableData'),
    me = this,
    table = this.get('table');
    if (table && ! table.isDestroyed)
    {
      if (trace)
        dLog(fileName, "onDataChange", table, data.length);
      // me.send('showData', data);
      debounce(() => ! table.isDestroyed && table.updateSettings({data:data}), 500);
    }
  }),

  onColumnsChange : observer('columns', 'colHeaders', 'colWidths', function ()  {
    let table = this.get('table');
    if (table && ! table.isDestroyed) {
      let colSettings = {
        columns: this.get('columns'),
        colHeaders: this.get('colHeaders'),
        colWidths: this.get('colWidths')
      };
      table.updateSettings(colSettings);
    }
  }),

  /** Related : axis-table.js : highlightFeature{,1}() */
  highlightFeature: function(feature) {
    d3.selectAll("g.axis-outer > circle")
      .attr("r", 2)
      .style("fill", "red")
      .style("stroke", "red");
    if (feature) {
      /** see also handleFeatureCircleMouseOver(). */
      d3.selectAll("g.axis-outer > circle." + eltClassName(feature))
        .attr("r", 5)
        .style("fill", "yellow")
        .style("stroke", "black")
        .moveToFront();
    }
  },

  toggleSyntenyFilter(name, range, event) {
    const
    fnName = 'toggleSyntenyFilter',
    row = range[0].start.row,
    // related : getRowAttribute()
    blockLabels = [0, 3].map((col) => this.table.getData(row, col, row, col)[0][0]),
    /** matching format in blockLabelsToBlockAdjs() */
    blockAdjLabel = blockLabels.join('_'),
    blockAdj = this.blockLabelToBlockAdj[blockAdjLabel];
    console.log(fnName, row, blockAdj?.blockAdjId, blockAdj?.filterPathSynteny);
    if (blockAdj) {
      // initial value of blockAdj.filterPathSynteny is true
      blockAdj.toggleProperty('filterPathSynteny');
    }
  },

});
