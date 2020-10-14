import Ember from 'ember';

const { inject: { service } } = Ember;

const dLog = console.debug;


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
   * @return [[startOffset, endOffset], ...],   parallel to this.blocks[]
   */
  allocatedWidth : Ember.computed('blocks.[]', function () {
    let
    blocks = this.get('blocks'),
    trackWidth = this.get('trackWidth'),
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

