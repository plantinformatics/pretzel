import EmberObject, { computed } from '@ember/object';
import { next } from '@ember/runloop';


/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** indexes into the result of allocatedWidthBlocks. */
const Index_block = 0, Index_startOffset = 1, Index_endOffset = 2;

/*----------------------------------------------------------------------------*/

/**
 * @param data : array of (qtl data) blocks
*/
export default EmberObject.extend({


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

});

