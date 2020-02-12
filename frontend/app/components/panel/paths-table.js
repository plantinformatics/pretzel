import Ember from 'ember';
const { inject: { service } } = Ember;


import PathData from '../draw/path-data';
import { pathsResultTypes } from '../../utils/paths-api';


const dLog = console.debug;

export default Ember.Component.extend({
  flowsService: service('data/flows-collate'),

  didReceiveAttrs() {
    this._super(...arguments);

    dLog('didReceiveAttrs', this.get('block.id'));
  },

  /*--------------------------------------------------------------------------*/

  actions: {

    selectionChanged: function(selA) {
      dLog("selectionChanged in components/panel/paths-table", selA);
      for (let i=0; i<selA.length; i++) {
        dLog(selA[i].feature, selA[i].position);
      }
    },
  },

  /*--------------------------------------------------------------------------*/

  /**
   * also in utils/paths-filter.js @see pathInDomain()
   */
  filterPaths(pathsResultField) {

    let selectedBlock = this.get('selectedBlock');
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

    if (false) {
    /**   form is e.g. : {Chromosome: "myMap:1A.1", Feature: "myMarkerA", Position: "0"} */
    let chrName = "", // e.g. "myMap:1A.1",
    position = "", // e.g. "12.3",
    result =
      {Chromosome: chrName, Feature: featureName, Position: position};
    }


    let
      blockAdjs = this.get('flowsService.blockAdjs'),
    tableData = blockAdjs.reduce(function (result, blockAdj) {
      // components/panel/manage-settings.js:14:        return feature.Block === selectedBlock.id
      if (! selectedBlock || blockAdj.adjacentTo(selectedBlock)) {
        /** push the names of the 2 adjacent blocks, as an interleaved title row in the table. */
        let blocks = blockAdj.get('blocks'),
        blocksById = blocks.reduce((r, b) => { r[b.get('id')] = b; return r; }, {}),
        namesFlat = blocks.reduce((rowHash, b, i) => {
          rowHash['feature' + i] = b.get('datasetId.id');
          rowHash['position' + i] = b.get('scope');
          return rowHash;
        }, {});
        result.push(namesFlat);

        let resultElts = blockAdj.get(pathsResultField);
        if (resultElts) {
          resultElts.forEach((resultElt) => {
            /** for each end of the path, if the endpoint is in a brushed block,
             * filter out if the endpoint is not in the (brushed)
             * selectedFeatures.
             */

            /** for the given block, generate the name format which is used in
             * selectedFeatures.Chromosome
             */
            function blockDatasetNameAndScope(block) {
              return block.get('datasetId.id') + ':' + block.get('scope');
            }
            let
              pathsResultType = Object.values(pathsResultTypes).find((prt) => prt.fieldName === pathsResultField);

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
              featureGet = feature.get ? (field) => feature.get(field) : (field) => feature[field], 
              block1 = featureGet('blockId'),
              block = block1.get ? block1 : blocksById[block1],
              chrName = blockDatasetNameAndScope(block),
              selectedFeaturesOfBlock = selectedFeaturesByBlock[chrName],
              featureName = featureGet('name'),
              out = selectedFeaturesOfBlock ?
                /* endpoint feature is not in selectedFeaturesOfBlock */
                ! selectedFeaturesOfBlock[featureName]
                : false;
              if (! out) {
                let value = featureGet('value');
                path['position' + i] = '' + value;
                path['feature' + i] = featureName;
              }
              return out;
            }
            let out = filterOut(resultElt, 0, path) || filterOut(resultElt, 1, path);
            if (! out) {
              result.push(path);
            }
          });
        }
      }
      return result;
    }, []);

    dLog('filterPaths',  tableData, blockAdjs);
    return tableData;
  },

  tableDataAliases : Ember.computed(
    'pathsAliasesResult.[]', 'selectedFeatures.[]',
    function () {
      let tableData = this.filterPaths('pathsAliasesResult');
      dLog('tableData', tableData);
      return tableData;
    }),
  tableData : Ember.computed(function () {
    let tableData = this.filterPaths('pathsResult');
    dLog('tableData', tableData);
    return tableData;
  }),

  /*--------------------------------------------------------------------------*/

});
