import EmberObject, { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { A as Ember_A } from '@ember/array';
import { later } from '@ember/runloop';

import { removePunctuation, ApiServerAttributes } from './api-server';
import { Germinate } from '../../utils/data/germinate';
import { reduceInSeries } from '../../utils/common/promises';

/** For the prototype, add the BrAPIWrap methods to ApiServerGerminate, as there is no name clash.
 * Probably BrAPIWrap will become the parent class of ApiServerGerminate.
 */
// import BrAPIWrap from '../../utils/data/brapi-genotype';
import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
console.log('vcfGenotypeBrapi', vcfGenotypeBrapi);
const /*import {*/
  BrAPIWrap
/*}*/ = vcfGenotypeBrapi.brapiGenotype;
/** imports from vcfGenotypeBrapi.* have values which are Getters, which are not
 * suitable for .extend() so copy values to a plain javascript object.
 */
const {...BrAPIWrapObj} = BrAPIWrap;


//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/** components/service/api-server-germinate extends
 *  components/service/api-server
 * It overrides these functions :
 *   blockFeatureTraits()
 *   blockFeatureOntologies()
 *   getVersion()
 *   getDatasets()
 * and adds :
 *   viewDatasetP()
 */
export default EmberObject.extend(ApiServerAttributes, BrAPIWrapObj, {

  componentClassName : 'ApiServerGerminate',

  //----------------------------------------------------------------------------
  /** override some methods of ApiServerAttributes */
  init() {
    this._super(...arguments);

    const groups = {groupsInOwnNone : []};
    this.set('groups', EmberObject.create(groups));
    /* .germinateInstance is set by ServerLogin()
    this.germinate = new Germinate(); */
    dLog('germinate', this);
    if (window.PretzelFrontend) {
      window.PretzelFrontend.apiServerGerminate = this;
    }
  },
  willDestroy() {
    this._super(...arguments);
  },

  //----------------------------------------------------------------------------

  get blockFeatureTraits() { return []; },
  get blockFeatureOntologies() { return []; },

  getVersion : function () { return ''; },
  /** generate a view dataset for each Germinate dataset, with a block for each
   * linkageGroup.
   */
  getDatasets : function () {
    BrAPIWrap.setFrameworkFunctions({Ember_A, later});
    const
    fnName = 'getDatasets',
    germinate = this.germinateInstance,
    /** @param previousDatasetObj is not used
     * @param dataset name data of one map from germinate /maps result
     */
    datasetLinkageGroupsFn = (previousDatasetObj, dataset) =>
          germinate.linkagegroups(dataset.mapDbId)
            .then(linkageGroups =>
              this.viewDatasetP(this.store, dataset, linkageGroups.result.data))
            .catch(error => dLog(fnName, error)),
    datasetsP = germinate.maps()
      .then(datasets => reduceInSeries(datasets.result.data, datasetLinkageGroupsFn)
      )
      .catch(error => dLog(fnName, error));
    return datasetsP;
  },
  /** Create view datasets in store which reference the Germinate datasets
   */
  viewDatasetP : function(store, germinateDataset, linkageGroups) {
    const
    fnName = 'viewDatasetP',
    datasetId = germinateDataset.mapDbId + '_' + germinateDataset.mapName,
    apiServers = this.get('apiServers'),
    /** Record the created datasets and blocks in id2Server, as in :
     * services/data/dataset.js : taskGetList() : datasets.forEach()
     */
    id2Server = apiServers.get('id2Server'),
    datasetsBlocks = this.datasetsBlocks || this.set("datasetsBlocks", Ember_A()),
    linkageGroup2block = linkageGroup => {
      const
      name = linkageGroup.linkageGroupName,
      chrMap = this.chrMapping?.findBy('0', name),
      scope = chrMap?.[1] || name,
      blockAttributes = {
        name : scope,
        id : germinateDataset.mapDbId + '_' + name,
        scope,
        /* To link block to dataset, included the datasetId attribute here, but got :
         * ... is not a record instantiated by @ember-data/store
         * Solution used is to link dataset and block in blocksFinish() :
         * ... block.set('datasetId', dataset);
         * ... dataset.blocks.pushObjects(blocks);
         */
        // datasetId,
        featureCount : linkageGroup.markerCount,
        /** linkageGroupName is used for /chromosome/ path param in API call. */
        _meta : {linkageGroupName : linkageGroup.linkageGroupName},
      },
      block = store.createRecord('block', blockAttributes);
      return block;
    },

    createDataset = () => {
      const
      /** Use .mapName for .id as well as .name, because dataset.id (not
       * .displayName) is used in gtDatasetTabs which doesn't have space for
       * long displayName-s; .id is also displayed in :
       * Datasets to filter, Variant Intervals, ..., datasetsClasses
       */
      name = germinateDataset.mapName,
      datasetAttributes = {
        name,
        id : datasetId,
        parentName : this.parentName,
        // type, _meta.type ?
        tags : ['view', 'Genotype', 'Germinate'],
        _meta : {
          displayName : germinateDataset.mapName,
          paths : false, germinate : germinateDataset},
        // namespace
        blocks : [],
      };
      const dataset = store.createRecord('dataset', datasetAttributes);
      return dataset;
    };

    const
    dataset = createDataset();

    const blocksFinish = (dataset, blocks) => {
      blocks.forEach(block => {
        id2Server[block.get('id')] = this;
        block.set('mapName', germinateDataset.mapName);
      });

      blocks.forEach(block => {
        if (! block.get('datasetId.id')) {
          dLog(fnName, block.scope, 'set datasetId', dataset.id);
          block.set('datasetId', dataset);
        }
      });
      dataset.blocks.pushObjects(blocks);
    };

    const
    blocks = linkageGroups.map(linkageGroup2block);
    blocksFinish(dataset, blocks);

    const shareDataset = (dataset) => {
      id2Server[dataset.get('id')] = this;
      id2Server[dataset.get('genotypeId')] = this;
      if (! datasetsBlocks.findBy('name', dataset.name)) {
        datasetsBlocks.push(dataset);
        later(() => {
          apiServers.incrementProperty('datasetsBlocksRefresh');
          apiServers.trigger('receivedDatasets', datasetsBlocks);
        });
      }
    };

    shareDataset(dataset);
    const datasetP = Promise.resolve(dataset);

    return datasetP;
  },

  // : computed(function),
  featuresCountAllTaskInstance () {
    return [];
  },

  //----------------------------------------------------------------------------


});
