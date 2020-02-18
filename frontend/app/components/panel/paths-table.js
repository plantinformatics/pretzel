import Ember from 'ember';
const { inject: { service } } = Ember;

/* global d3 Handsontable */


import PathData from '../draw/path-data';
import { pathsResultTypes, pathsApiResultType, pathsResultTypeFor, featureGetFn, featureGetBlock } from '../../utils/paths-api';
import { eltClassName } from '../../utils/domElements';


const dLog = console.debug;
const trace = 0;
/** for trace */
const fileName = 'panel/paths-table.js';

const columnFields = ['block', 'feature', 'position'];
const columnFieldsCap = columnFields.map((s) => s.capitalize());

var capitalize = (string) => {
  return string[0].toUpperCase() + string.slice(1);
};

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

/** Switch to select either HandsOnTable or ember-contextual-table. */
const useHandsOnTable = true;
/** id of element which will hold HandsOnTable. */
const hoTableId = 'paths-table-ho';


/**
 * Arguments passed to template :
 * @param selectedFeatures  catenation of features within all brushed regions
 * @param selectedBlock block selected via axis brush, or via click in dataset explorer or view panel, or adding the block.
 *
 * @desc inputs from template
 * @param blockColumn true means show the block name:scope in a column instead of as a row.
 *
 * @desc attributes
 * @param loading true indicates the requestAllPaths() API request is in progress.
 */
export default Ember.Component.extend({
  flowsService: service('data/flows-collate'),
  pathsPro : service('data/paths-progressive'),
  axisBrush: service('data/axis-brush'),

  useHandsOnTable : useHandsOnTable,
  /** true enables display of the 'block' column for each end of the path. */
  blockColumn : true,
  /** true enables display of the brushedDomains in the table.  */
  showDomains : false,

  classNames: ['paths-table'],

  didReceiveAttrs() {
    this._super(...arguments);

    if (trace)
      dLog('didReceiveAttrs', this.get('block.id'), this);
  },

  didRender() {
    if (trace)
      dLog(fileName + " : didRender()");
    if (useHandsOnTable && ! this.get('table')) {
      this.set('table', this.createHoTable(this.get('tableData')));
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
    }
  },

  /*--------------------------------------------------------------------------*/

  /** Reduce the selectedFeatures value to a structure grouped by block.
   *
   * The form of the input selectedFeatures is an array of :
   * e.g. : {Chromosome: "myMap:1A.1", Feature: "myMarkerA", Position: "12.3"}
   */
  selectedFeaturesByBlock : Ember.computed(
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

  /**
   * also in utils/paths-filter.js @see pathInDomain()
   */
  filterPaths(pathsResultField) {

    let selectedBlock = this.get('selectedBlock');
    let selectedFeaturesByBlock = this.get('selectedFeaturesByBlock');
    let axisBrush = this.get('axisBrush');
    /** true means show the block name:scope in a column instead of as a row. */
    let blockColumn = this.get('blockColumn');
    /** true means show the brushed domains in the table. This may be omitted, although it
     * seems important to know if the axis was brushed and what the region
     * was.  */
    let showDomains = this.get('showDomains');
    /** true means show counts of paths before and after filtering in the table.  */
    let showCounts = this.get('showCounts');


    let
      blockAdjs = this.get('flowsService.blockAdjs'),
    tableData = blockAdjs.reduce(function (result, blockAdj) {
      // components/panel/manage-settings.js:14:        return feature.Block === selectedBlock.id
      if (! selectedBlock || blockAdj.adjacentTo(selectedBlock)) {
        /** Prepare a row with a pair of values to add to the table */
        function setEndpoint(row, i, block, feature, position) {
          if (block)
            row['block' + i] = block;
          row['feature' + i] = feature;
          row['position' + i] = position;
          return row;
        };
        let blocks = blockAdj.get('blocks'),
          blocksById = blocks.reduce((r, b) => { r[b.get('id')] = b; return r; }, {});
        let blockIndex = blockAdj.get('blockIndex');
        if (! blockColumn) {
          /** push the names of the 2 adjacent blocks, as an interleaved title row in the table. */
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
              setEndpoint(rowHash, i, undefined, brushedDomain[0], brushedDomain[1]);
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
             * @return true if the endpoint is in selectedFeatures, or its block is not brushed.
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
              /** brushes are identified by the referenceBlock (axisName). */
              chrName = block.get('brushName'),
              selectedFeaturesOfBlock = selectedFeaturesByBlock[chrName],
              featureName = featureGet('name'),
              /** if the axis is brushed but there are no features in this block
               * within the brush, then selectedFeaturesOfBlock will be
               * undefined (empty).  If the axis is not brushed then no filter
               * is applied on this endpoint.
               */
              isBrushed = !!axisBrush.brushOfBlock(block),
              out = selectedFeaturesOfBlock ?
                /* endpoint feature is not in selectedFeaturesOfBlock */
                ! selectedFeaturesOfBlock[featureName]
                : isBrushed;
              if (! out) {
                let value = featureGet('value');
                let i = blockIndex.get(block);
                path['block' + i] = block.get('datasetNameAndScope');
                path['position' + i] = '' + value;
                path['feature' + i] = featureName;
              }
              return out;
            }
            let out = filterOut(resultElt, 0, path) || filterOut(resultElt, 1, path);
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
  tableData : Ember.computed(
    'pathsResultFiltered.[]',
    'pathsAliasesResultFiltered.[]',
    'selectedBlock',
    'selectedFeaturesByBlock.@each',
    'blockColumn',
    'showDomains',
    'showCounts',
    function () {
      let tableData = this.filterPaths('pathsResultFiltered');
      if (tableData.length < 20)
        dLog('tableData', tableData);
      let tableDataAliases = this.filterPaths('pathsAliasesResultFiltered');
      if (tableDataAliases.length < 20)
        dLog('tableDataAliases', tableDataAliases);
      let data = 
        (tableDataAliases.length && tableData.length) ?
        tableDataAliases.concat(tableData)
        : (tableData.length ? tableData : tableDataAliases)
      ;
      return data;
    }),

  /** From columnFields, select those columns which are enabled.
   * The blockColumn flag enables the 'block' column.
   */
  activeFields :  Ember.computed('blockColumn',  function () {
    let activeFields = columnFields.slice(this.get('blockColumn') ? 0 : 1);
    return activeFields;
  }),
  /** Map from tableData to the data form used by the csv export / download.
   */
  csvExportData : Ember.computed('tableData', 'blockColumn', function () {
    let activeFields = this.get('activeFields');
    let headerRow =
    [0, 1].reduce(function (result, end) {
      activeFields.reduce(function (result, fieldName) {
        let columnHeading = capitalize(fieldName);
        result.push('"' + columnHeading + end + '"');
        return result;
      }, result);
      return result;
    }, []);
    dLog('csvExportData', headerRow);

    let data = this.get('tableData').map((d, i) => {
      let da =
      [0, 1].reduce(function (result, end) {
        activeFields.reduce(function (result, fieldName) {
          // if undefined, push '' for a blank cell.
          let v = d[fieldName + end],
          /** wrap text fields with double-quotes, and also position with comma - i.e. intervals 'from,to'.  */
          quote = (fieldName === 'block') || (fieldName === 'feature') || (v.indexOf(',') > -1),
          /** If position value is an interval, it will appear at this point as 'number,number'.
           * What to use for interval separator ?  There is a convention of using
           * '-' for intervals in genome data, but that may cause problems in a
           * csv - Excel may evaluate it as minus.   In a tsv ',' would be ok.
           * For now use ':'. */
          v1 = v.replace(/,/, ':'),
          outVal = v1 ? ( quote ? '"' + v1 + '"' : v1) : '';
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
  tableDataArray : Ember.computed('tableData.[]', function () {
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
    blockAdjs.forEach(function (blockAdj) {
      if (! selectedBlock || blockAdj.adjacentTo(selectedBlock)) {
        let p = blockAdj.call_taskGetPaths();
        loadingPromises.push(p);
      }
    });
    pathsPro.set('fullDensity', false);

    /* set .loading true while API requests are in progress. */
    if (loadingPromises.length) {
      let all = Ember.RSVP.allSettled(loadingPromises);
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
    if (table)
    {
      table.loadData(data);
    }
  },

  createHoTable: function(data) {
    /** copied from table-brushed.js */
    var that = this;
    dLog("createHoTable", this);

    let tableDiv = Ember.$('#' + hoTableId)[0];
    dLog("tableDiv", tableDiv);
      var table = new Handsontable(tableDiv, {
        data: data || [['', '', '']],
        minRows: 1,
        rowHeaders: true,
        columns: [
          {
            data: 'block0',
            type: 'text'
          },
          {
            data: 'feature0',
            type: 'text'
          },
          {
            data: 'position0',
            type: 'numeric',
            numericFormat: {
              pattern: '0,0.*'
            }
          },
          {
            data: 'block1',
            type: 'text'
          },
          {
            data: 'feature1',
            type: 'text'
          },
          {
            data: 'position1',
            type: 'numeric',
            numericFormat: {
              pattern: '0,0.*'
            }
          }
        ],
        colHeaders: [
          '<span title = "e.g. chromosome or linkage group">Block</span>',
          '<span title = "e.g. marker / gene">Feature</span>',
          'Position',
          '<span title = "e.g. chromosome or linkage group">Block</span>',
          '<span title = "e.g. marker / gene">Feature</span>',
          'Position'
        ],
        headerTooltips: true,
        colWidths: [100, 135, 60, 100, 135, 60],
        height: 600,
        manualRowResize: true,
        manualColumnResize: true,
        manualRowMove: true,
        // manualColumnMove: true,
        copyPaste: {
          /** increase the limit on copy/paste.  default is 1000 rows. */
          rowsLimit: 10000
        },
        contextMenu: true,
        sortIndicator: true,
        columnSorting: {
          column: 2,
          sortOrder: true
        }
      });

    let $ = Ember.$;
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


  onSelectionChange: function () {
    let data = this.get('tableData'),
    me = this,
    table = this.get('table');
    if (table)
    {
      if (trace)
        dLog(fileName, "onSelectionChange", table, data.length);
      // me.send('showData', data);
      Ember.run.throttle(() => table.updateSettings({data:data}), 500);
    }
  }.observes('tableData'),

  highlightFeature: function(feature) {
    d3.selectAll("g.axis-outer > circle")
      .attr("r", 2)
      .style("fill", "red")
      .style("stroke", "red");
    if (feature) {
      /** see also handleFeatureCircleMouseOver(). */
      d3.selectAll("g.axis-outer > circle." + eltClassName(eltClassName(feature)))
        .attr("r", 5)
        .style("fill", "yellow")
        .style("stroke", "black")
        .moveToFront();
    }
  }

});
