import Ember from 'ember';

const { inject: { service } } = Ember;

const dLog = console.debug;


/** width of track <rect>s
 * Copied from axis-tracks.
 */
let trackWidth = 10;

/** allocate horizontal space for blocks within axis-2d. In the allocated width
 * either axis-track or axis-charts featuresCounts will be positioned.
 *
 * @param chartBlocks=viewedChartable 
 * @param trackBlocksR=dataBlocks
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

    let trackWidthOption = this.get('urlOptions.trackWidth');
    if (trackWidthOption) {
      dLog('init', 'from urlOptions, setting trackWidth', trackWidthOption, ', was', trackWidth);
      trackWidth = trackWidthOption;
    }
  },


  /** Combine chartBlocks and trackBlocksR, i.e. union.
   */
  blocks : Ember.computed.union('chartBlocks', 'trackBlocksR'),

  /** Allocate fixed-width horizontal space for each block.
   * @return [[startOffset, endOffset], ...],   parallel to this.blocks[]
   */
  allocatedWidth : Ember.computed('blocks.[]', function () {
    let
    blocks = this.get('blocks'),
    aw = blocks.map((block, i) => [
      i * trackWidth * 2,
      (i+1) * trackWidth * 2]);

    let width = aw.length ? aw[aw.length-1][1] : 0;
    dLog('allocatedWidth', aw, width);
    let childWidths = this.get('childWidths');
    // [min, max] width
    Ember.run.next(() => childWidths.set(this.get('className'), [width, width]));

    return aw;
  })

});

