import Ember from 'ember';

const { inject: { service } } = Ember;

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
export default Ember.Component.extend({
  blockService: service('data/block'),
  queryParams: service('query-params'),
  urlOptions : Ember.computed.alias('queryParams.urlOptions'),

  /** The allocated block space is used for either axis-tracks or axis-charts
   * (featuresCounts). This name is used to identify the allocated space. */
  className : "trackCharts",

  init() {
    this._super(...arguments);
  },


  blocks : Ember.computed.alias('dataBlocks'),

  /** Allocate fixed-width horizontal space for each block.
   * @return [[block, startOffset, endOffset], ...],
   */
  allocatedWidthBlocks : Ember.computed('blocks.[]', function () {
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
    Ember.run.next(() => childWidths.set(this.get('className'), [width, width]));

    return aw;
  }),
  /** as for allocatedWidthBlocks, without the block.
   * @return [[startOffset, endOffset], ...],   parallel to this.blocks[]
   */
  allocatedWidth : Ember.computed('allocatedWidthBlocks.[]', function () {
    let aw = this.get('allocatedWidthBlocks').map((bi) => bi.slice(Index_startOffset));
    return aw;
  }),
  /**
   * @return symbolic array (hash) which maps from blockId to allocatedWidth for that block
   * [blockId] -> array of [startOffset, width].
   */
  widthsById: Ember.computed(
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
  featuresForBlocksRequestEffect : Ember.computed(
    'blocks.[]',
    // axis1d.domain also reflects zoomedDomain
    'axis1d.axis.limits.{0,1}', 'axis1d.zoomedDomainDebounced.{0,1}',
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
      blockFeatures = blocks.map(function (b) { return b.get('featuresForAxis'); } );
      /* no return value - result is displayed by axis-track : showTrackBlocks() with data
       * collated by tracksTree(), and axis-charts : featureCountBlocks() and drawChart(). */
    }),

  /*--------------------------------------------------------------------------*/

});

