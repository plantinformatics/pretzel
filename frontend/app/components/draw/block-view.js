import EmberObject, { computed, observer } from '@ember/object';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import { inject as service } from '@ember/service';

import { ensureBlockFeatures } from '../../utils/feature-lookup';
import { subInterval } from '../../utils/draw/zoomPanCalcs';
import { intervalSize, intervalOverlapCoverage }  from '../../utils/interval-calcs';
import { binEvenLengthRound } from '../../utils/draw/interval-bins';
import { featuresCountsResultsSansOverlap } from '../../utils/draw/featuresCountsResults';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/


/** Collate chartable feature and featuresCounts data for .block, guided by the zoomedDomain.
 *
 * @param block	a block returned by viewedChartable()
 * @param axis  axisComponent;   parent axis-2d component
 * @param axisID  axisID
 * @param featuresByBlock
 * @param blocksData  map to receive feature data
 */
export default Component.extend({
  blockService: service('data/block'),
  queryParams: service('query-params'),

  urlOptions : alias('queryParams.urlOptions'),


  /** Store results of requests in .blocksData
   * conceptually: .blocksData[dataTypeName] = featuresData
   * e.g. .blocksData.featureCountData = 
   */
  setBlockFeaturesData(dataTypeName, featuresData){
    let blocksData = this.get('blocksData'),
    typeData = blocksData.get(dataTypeName) || (blocksData.set(dataTypeName, EmberObject.create())),
    blockId = this.get('block.id');
    typeData.set(blockId, featuresData);
    this.parentView.incrementProperty('blocksDataCount');
  },

  /** If the block contains chartable data, collate it into .blocksData.blockData, for axis-charts.
   * @return undefined
   */
  blockFeaturesEffect : observer(
    'block', 'block.featuresLengthThrottled',
    // 'axis.axis1d.domainChanged',
    'axis.axis1d.blocksDomain',
    'axis.axis1d.{zoomedDomainThrottled,zoomedDomainDebounced}.{0,1}',
    function () {
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
  featuresCounts : computed(
    'block', 'block.featuresCountsInZoom.[]',
    'block.featuresCounts',
    // 'axis.axis1d.domainChanged',
    'axis.axis1d.blocksDomain',
    'axis.axis1d.{zoomedDomainThrottled,zoomedDomainDebounced}.{0,1}',
    // featuresCountsNBins is used in selectFeaturesCountsResults()
    'blockService.featuresCountsNBins',
    function () {
    let featuresCountsInZoom = this.get('block.featuresCountsInZoom');
    let featuresCounts;
    if (featuresCountsInZoom.length === 0) {
      featuresCounts = [];
    } else if (featuresCountsInZoom.length === 1) {
      featuresCounts = featuresCountsInZoom[0].result;
    } else {
      /** first draft : concat all results.
       * later : interval tree to choose the best resolution in each result domain.
       * i.e. for each result : foreach each result in overlaps : choose result
       * with smaller bins & add to tree {result, overlap domain [from,to] index};
       * read from tree | catenate result sections
       */
      let selectedResults = this.selectFeaturesCountsResults(featuresCountsInZoom);
      featuresCounts = [].concat.apply([], selectedResults.mapBy('result'));
    }
    // If the only result has binSize too large, don't display it.
    if (featuresCounts && featuresCounts.length &&
        (! this.get('block.domain') ||
         (this.get('block').pxSize2(featuresCounts[0].binSize || featuresCounts[0].idWidth[0]) < 200))) {
      /** recognise the data format : $bucketAuto ._id contains .min and .max, whereas $bucket ._id is a single value.
       * @see featureCountAutoDataExample, featureCountDataExample 
       */
      let id = featuresCounts[0]._id,
      /** id.min may be 0 */
      dataTypeName = (id.min !== undefined) ? 'featureCountAutoData' : 'featureCountData';
      this.setBlockFeaturesData(dataTypeName, featuresCounts);
      dLog('featuresCounts', featuresCounts.length, this.axis.axis1d.zoomedDomainThrottled);
    }

    return featuresCounts;
  }),

  /** filter out bins < 1px because there is (e.g. in the HC genes) lots of
   * space between the non-empty bins (for small bins, e.g. < 20kb),
   * and when they are <~1px the bin rectangles are visible and not the space,
   * so many thin bins appear like a solid bar, giving an inflated impression of
   * the feature density.
   */
  selectFeaturesCountsResults(featuresCountsInZoom) {
    /** based on similar calc in models/block.js:featuresForAxis(), factored
     * to a block.pxSize(interval). */
    let
    binSizes = featuresCountsInZoom.mapBy('binSize'),
    domain = this.get('block').getDomain(),
    yRange = this.get('block').getRange(),
    /** bin size of each result, in pixels as currently viewed on screen. */
    binSizesPx = binSizes.map((binSize) => this.get('block').pxSize(binSize, yRange, domain));
    let nBins = this.get('blockService.featuresCountsNBins'),
    requestedSize = yRange / nBins,
    lengthRounded = binEvenLengthRound(domain, nBins),

    /** results with bins smaller than this are not displayed. */
    pxThreshold = requestedSize;
    let
    /** filter out a result which has binSize Px < threshold and is a subset of another result domain
     * and that other result has binSize closer to lengthRounded
     */
    betterResults = 
      binSizesPx.map(
        (binSizePx, i) => {
          let
          fcI = featuresCountsInZoom[i],
          betterResult =
            (binSizesPx[i] < pxThreshold) &&
            featuresCountsInZoom.find((fc, j) => {
              let found;
              // equiv : (fc !== fcI)
              if (j !== i) {
                let betterBinSize =
                    ((fc.binSize !== fcI.binSize) &&
                     (Math.abs(lengthRounded - fc.binSize) <  Math.abs(lengthRounded - fcI.binSize)));
                // if the domains are equal, that is considered a match.
                found = subInterval(featuresCountsInZoom[i].domain, fc.domain) && betterBinSize;
              }
              return found;
            });
          return betterResult;
        }),
    selectedResults = featuresCountsInZoom
      .filter((fc, i) => !betterResults[i]);
    if (! this.get('urlOptions.fcLevels')) {
      /** show only a single featuresCounts result at a time. */
      selectedResults = selectedResults
        /** augment with .coverage for sort. This value depends on current domain.  */
        .map((fc) => { fc.coverage = intervalOverlapCoverage(fc.domain, domain) ; return fc; })
        /** filter out bins > 100px. */
        .filter((f) => { return this.get('block').pxSize(f.binSize, yRange, domain) < 100; })
        // prefer results which cover more of the (current zoomed) domain
        /* want any coverage which is > 1, prefering larger coverage.
         * Related : featureCountResultCoverage(), smallestOver1I / largestUnder1I in featureCountInZoom().
         * sort in decreasing order of .coverage
         * If .coverage is equal, sort in increasing order of .binSize
         */
        .sort((a,b) => (a.coverage >= 1 && b.coverage >= 1) ? (a.binSize - b.binSize) : b.coverage - a.coverage)
        // choose the result with the smallest binSize  (this is now incorporated into the above sort)
        // .sortBy('binSize')
        .slice(0,1);
    } else {
      selectedResults = featuresCountsResultsSansOverlap(selectedResults, lengthRounded);
    }
    return selectedResults;
  },

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

