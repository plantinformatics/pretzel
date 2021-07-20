import EmberObject, { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import { inject as service } from '@ember/service';

import componentLayout from '../../utils/draw/component-layout';

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** QTL track width plus spacing  */
const blockWidth = 15; 

/*----------------------------------------------------------------------------*/

/** allocate horizontal space for blocks within axis-2d. In the allocated width
 * either axis-track or axis-charts featuresCounts will be positioned.
 *
 * @param dataBlocks=dataBlocks
 */
export default Component.extend({
  blockService: service('data/block'),
  queryParams: service('query-params'),
  urlOptions : alias('queryParams.urlOptions'),
  axisZoom: service('data/axis-zoom'),


  /** The allocated block space is used for either axis-tracks or axis-charts
   * (featuresCounts). This name is used to identify the allocated space. */
  className : "trackCharts",

  init() {
    this._super(...arguments);

    this.set('centre', componentLayout.create({
      blocks : this.get('blocks'),
      trackWidth : this.get('trackWidth'),
      className : this.get('className'),
      childWidths : this.get('childWidths.centre')
    }));
    /** this may be used if there is a call for fixed-width tracks for QTLs, otherwise not needed.  */
    this.set('right', componentLayout.create(
      {
        blocks : this.get('blocks'),
        trackWidth : 15,
        className : 'qtl',
        childWidths : this.get('childWidths.right')
      }));
  },


  blocks : alias('dataBlocks'),

  centre : undefined,
  right : undefined,

  allocatedWidthBlocks : alias('centre.allocatedWidthBlocks'),
  allocatedWidth : alias('centre.allocatedWidth'),
  widthsById : alias('centre.widthsById'),
  allocatedWidthForBlock(blockId) { return this.centre.allocatedWidthForBlock(blockId); },

  /*--------------------------------------------------------------------------*/

  /** Request block featuresForAxis, driven by changes of the data
   * blocks or the axis view (axis limits or zoomedDomain).
   */
  featuresForBlocksRequestEffect : computed(
    'blocks.[]',
    'blocks.@each.featuresForAxis',
    // axis1d.domain also reflects zoomedDomain
    'axis1d.axis.limits.{0,1}',
    'axis1d.{zoomedDomainDebounced,zoomedDomainThrottled}.{0,1}',
    function () {
      let
      blocks = this.get('blocks');
      dLog('featuresForBlocksRequestEffect',
        this.get('blocks').mapBy('id'),
        this.get('axis1d.axis.limits'),
        this.get('axis1d.zoomedDomainDebounced')
      );
      let
      /** featuresForAxis() uses getBlockFeaturesInterval(), which is also used by 
       * models/axis-brush.js */
      blockFeatures = blocks.forEach((b) => this.block_get_featuresForAxis(b) );
      /* no return value - result is displayed by axis-track : showTrackBlocks() with data
       * collated by tracksTree(), and axis-charts : featureCountBlocks() and drawChart(). */
    }),
  /** For most blocks - simply request featuresForAxis.
   * For HighDensity blocks, i.e. featuresCountIncludingZoom is large,
   * and currentZoomPanIsWheel, delay the request until the zoom/pan is finished.
   */
  block_get_featuresForAxis (b) {
    let featuresInScope = b.get('featuresCountIncludingZoom');
    /** blockFeaturesCounts for 10M features is currently about 1min,
     * which is not very useful because the bins from the initial
     * (zoomed-out) request are still an appropriate size, so there is
     * no benefit from a large-scale request, only delay, and the user
     * will likely have zoomed somewhere else by the time of the
     * response, so delay the request until featuresInScope < 5e5
     * which will give ~3sec response.
     */
    if (featuresInScope > 5e5) {
      dLog('featuresCountIncludingZoom', b.id, featuresInScope, 'featuresFor', 'skip');
    } else if (this.get('axisZoom.currentZoomPanIsWheel') &&
        (featuresInScope > 1e4)) {
      dLog('featuresCountIncludingZoom', b.id, featuresInScope, 'featuresFor');
      let
      axis1d = this.get('axis1d'),
      endOfZoom = axis1d.get('nextEndOfDomainDebounced');
      if (! endOfZoom) {
        b.get('featuresForAxis');
      } else {
        endOfZoom.then(() => {
          console.log('featuresForBlocksRequestEffect endOfZoom', b.id);
          b.get('featuresForAxis');
        });
      } } else {
        b.get('featuresForAxis');
      }
  }

  /*--------------------------------------------------------------------------*/

});

