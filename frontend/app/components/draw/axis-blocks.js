import Ember from 'ember';


const { inject: { service } } = Ember;

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

  allocatedWidth : Ember.computed('blocks.[]', function () {
    let blocks = this.get('blocks'),
	t2 = 2
	aw = blocks.map((blockId, i) => [
	  i * trackWidth * 2,
	  (i+1) * trackWidth * 2]);
    return aw;
  })

});

