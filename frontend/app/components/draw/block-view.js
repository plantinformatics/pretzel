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
    typeData = blocksData[dataTypeName] || (blocksData[dataTypeName] = {}),
    blockId = this.get('block.id');
    typeData[blockId] = featuresData;
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
          // previous : .drawBlockFeatures0() -> drawBlockFeatures();
        }
      }
    }
  }),

  featuresCounts : Ember.computed('block', 'block.featuresCounts.[]', 'axis.axis1d.domainChanged', function () {
    let featuresCounts = this.get('block.featuresCounts');
    if (featuresCounts && featuresCounts.length)
      this.setBlockFeaturesData('featureCountData', featuresCounts);
      // previous : .drawBlockFeaturesCounts(featuresCounts);

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

