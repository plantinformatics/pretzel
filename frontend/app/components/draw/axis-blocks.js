import { next } from '@ember/runloop';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Component from '@ember/component';
import { inject as service } from '@ember/service';

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** indexes into the result of allocatedWidthBlocks. */
const Index_block = 0, Index_startOffset = 1, Index_endOffset = 2;

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
  },


  blocks : alias('dataBlocks'),

  /** Allocate fixed-width horizontal space for each block.
   * @return [[block, startOffset, endOffset], ...],
   */
  allocatedWidthBlocks : computed('blocks.[]', function () {
    let
    blocks = this.get('blocks'),
    /** trackWidth is actually the <rect> width for tracks.  Add trackWidth (10px) for spacing */
    trackWidth = this.get('trackWidth') * 3,
    aw = blocks.map((block, i) => [
      block,
      i * trackWidth,
      (i+1) * trackWidth]);

    let width = aw.length ? aw[aw.length-1][Index_endOffset] : 0;
    dLog('allocatedWidthBlocks', aw, width);
    let childWidths = this.get('childWidths');
    // [min, max] width
    next(() => childWidths.set(this.get('className'), [width, width]));

    return aw;
  }),
  /** as for allocatedWidthBlocks, without the block.
   * @return [[startOffset, endOffset], ...],   parallel to this.blocks[]
   */
  allocatedWidth : computed('allocatedWidthBlocks.[]', function () {
    let aw = this.get('allocatedWidthBlocks').map((bi) => bi.slice(Index_startOffset));
    return aw;
  }),
  /**
   * @return symbolic array (hash) which maps from blockId to allocatedWidth for that block
   * [blockId] -> array of [startOffset, width].
   */
  widthsById: computed(
    'allocatedWidthBlocks.[]',
    function() {
      let byId = this.get('allocatedWidthBlocks').reduce((r, b) => {
        r[b[Index_block].get('id')] = b.slice(Index_startOffset); return r;
      }, {});
      return byId;
    }),
  /** Lookup  */
  allocatedWidthForBlock(blockId) {
    let
    /** [blockId] -> array of [startOffset, width]. */
    blocksWidths = this.get('widthsById'),
    aw = blocksWidths[blockId];
    return aw;
  },

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

