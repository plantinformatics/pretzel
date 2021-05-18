import { computed } from '@ember/object';
import Evented from '@ember/object/evented';
import Service, { inject as service } from '@ember/service';

let trace_axisBrush = 0;
const dLog = console.debug;

const typeName = 'axis-brush';

export default Service.extend(Evented, {
  blockService: service('data/block'),
  store: service(),

  /** look up axis-brush object instances in the store.
   * @return all instances.
   */
  all: computed(function() {
    let records = this.get('store').peekAll(typeName);
    if (trace_axisBrush)
      dLog('all', records);
    return records;
  }),

  /** Collate a list of the axes which are brushed.
   * @return reference blocks of the brushed axes.
   */
  brushedAxes: computed(
    'blockService.viewed',
    'all.[]',
    'all.@each.brushedDomain',
    // 'all.@each.block.isViewed',
    function() {
      if (trace_axisBrush)
        dLog('brushedAxes', this);
      const fnName = 'brushedAxes';
      let records = this.get('all');
      if (trace_axisBrush > 1)
        records.map(function (a) { dLog(fnName, a, a.get('brushedDomain')); } );
      if (trace_axisBrush)
        dLog('viewed Blocks', records);
      let blocks = records.filter(function (ab) {
        return ab.get('block.isViewed') && ab.get('brushedDomain'); } );
      blocks = blocks.toArray(); // Array.from(blocks);
      if (trace_axisBrush)
        dLog(fnName, blocks);

      return blocks;
    }),
  brushesByBlock : computed('brushedAxes.[]', function () {
    let brushesByBlock = this.get('brushedAxes').reduce(function (result, ab) {
      result[ab.get('block.id')] = ab;
      return result; }, {} );
    if (trace_axisBrush)
      dLog('brushesByBlock', brushesByBlock);
    return brushesByBlock;
  }),
  /** Lookup brushedAxes for the given block, or its referenceBlock.
   */
  brushOfBlock(block) {
    let brushesByBlock = this.get('brushesByBlock'),
    brush = brushesByBlock[block.get('id')];
    let referenceBlock;
    if (! brush && (referenceBlock = block.get('referenceBlock'))) {
      brush = brushesByBlock[referenceBlock.get('id')];
    }
    if (trace_axisBrush > 1)
      dLog('brushOfBlock', brush, brushesByBlock, referenceBlock);
    return brush;
  }

});
