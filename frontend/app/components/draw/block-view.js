import Ember from 'ember';
const { inject: { service } } = Ember;

import { ensureBlockFeatures } from '../../utils/feature-lookup';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/


/**
 * @param block	a block returned by viewedChartable()
 * @param axis  axisComponent;   parent axis-2d component
 * @param axisID  axisID
 * @param featuresByBlock
 * @param blocksData  map to receive feature data
 */
export default Ember.Component.extend({
  blockService: service('data/block'),

  setBlockFeaturesData(dataTypeName, featuresData){
    let blocksData = this.get('blocksData'),
    typeData = blocksData.get(dataTypeName) || (blocksData.set(dataTypeName, Ember.Object.create())),
    blockId = this.get('block.id');
    typeData.set(blockId, featuresData);
    this.parentView.incrementProperty('blocksDataCount');
  },

  blockFeatures : Ember.computed('block', 'block.features.[]', 'axis.axis1d.domainChanged', function () {
    if (this.get('block.isChartable')) {
      let features = this.get('block.features');
      let domain = this.get('axis.axis1d.domainChanged');
      console.log('blockFeatures', features.length, domain);
      if (features.length)  // -	should also handle drawing when .length changes to 0
      {
        if (features.hasOwnProperty('promise'))
          features = features.toArray();
        if (features[0] === undefined)
          dLog('blockFeatures', features.length, domain);
        else {
          let
            // f = features.toArray(),
            featuresA = features.map(function (f0) { return f0._internalModel.__data;});
          this.ensureBlockFeatures(featuresA);
          this.setBlockFeaturesData('blockData', featuresA);
        }
      }
    }
  }),

  /** Choose a result from block.featuresCountsInZoom and put it in blocksData.featureCount{,Auto}Data
   * to be read by axis-charts : featureCountBlocks etc and drawn.
   */
  featuresCounts : Ember.computed(
    'block', 'block.featuresCountsInZoom.[]', 'axis.axis1d.domainChanged',
    function () {
    let featuresCountsInZoom = this.get('block.featuresCountsInZoom');
    let featuresCounts;
    if (featuresCountsInZoom.length === 1) {
      featuresCounts = featuresCountsInZoom[0].result;
    } else {
      /** first draft : concat all results.
       * later : interval tree to choose the best resolution in each result domain.
       * i.e. for each result : foreach each result in overlaps : choose result
       * with smaller bins & add to tree {result, overlap domain [from,to] index};
       * read from tree | catenate result sections
       */
      featuresCounts = [].concat.apply([], featuresCountsInZoom.mapBy('result'));
    }
    if (featuresCounts && featuresCounts.length) {
      /** recognise the data format : $bucketAuto ._id contains .min and .max, whereas $bucket ._id is a single value.
       * @see featureCountAutoDataExample, featureCountDataExample 
       */
      let id = featuresCounts[0]._id,
      /** id.min may be 0 */
      dataTypeName = (id.min !== undefined) ? 'featureCountAutoData' : 'featureCountData';
      this.setBlockFeaturesData(dataTypeName, featuresCounts);
    }

    return featuresCounts;
  }),

// -	results -> blocksData

/** add features to featuresByBlock (oa.z)
 * @param features  array of just the feature attributes, without the relation to the parent block.
 */
  ensureBlockFeatures : function(features) {
    let
    axisID = this.get("axisID");

    ensureBlockFeatures(this.get('block.id'), features);

    // this.layoutAndDrawChart(fa, 'blockData');
  }


  /*--------------------------------------------------------------------------*/


});

