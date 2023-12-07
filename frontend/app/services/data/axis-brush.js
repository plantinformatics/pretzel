import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Evented from '@ember/object/evented';
import Service, { inject as service } from '@ember/service';

let trace_axisBrush = 0;
const dLog = console.debug;

const typeName = 'axis-brush';

export default Service.extend(Evented, {
  blockService: service('data/block'),
  pathsProgressive : service('data/paths-progressive'),

  filePath : 'services/data/axis-brush.js',

  /** count of brushHelper() calls. */
  brushCount : 0,

  /** look up axis-brush object instances.
   * @return all instances.
   */
  all: alias('pathsProgressive.axisBrushObjects'),

  /** Collate a list of the axes which are brushed.
   * @return reference blocks of the brushed axes.
   */
  brushedAxes: computed(
    'blockService.viewed',
    'all.[]',
    'all.@each.brushedDomain',
    /* literal form of alias all, which is not effective perhaps because brushedDomain array ref doesn't change.
     * .@each.brushedDomain.{0,1} is not supported [deprecation id: ember-metal.computed-deep-each]
    'pathsProgressive.axisBrushObjects.@each.brushedDomain.{0,1}',
    */
    'brushCount',
    // 'all.@each.block.isViewed',
    function() {
      const fnName = 'brushedAxes';
      if (trace_axisBrush)
        dLog(fnName, this);
      let records = this.get('all');
      if (trace_axisBrush > 1)
        records.map(function (a) { dLog(fnName, a, a.get('brushedDomain')); } );
      if (trace_axisBrush)
        dLog(fnName, 'viewed Blocks', records);
      let blocks = records.filter(function (ab) {
        return ab.get('block_.isViewed') && ab.get('brushedDomain'); } );
      blocks = blocks.toArray(); // Array.from(blocks);

      const
      previousName = fnName + '_Previous',
      previous = this.get(previousName),
      unchanged = (blocks.length === previous?.length) &&
        ! blocks.find((b, i) => b.id !== previous[i].id);
      if (trace_axisBrush)
        dLog(fnName, blocks, unchanged);
      if (unchanged) {
        blocks = previous;
      } else {
        this.set(previousName, blocks);
      }

      return blocks;
    }),
  brushesByBlock : computed('brushedAxes.[]', function () {
    let brushesByBlock = this.get('brushedAxes').reduce(function (result, ab) {
      result[ab.get('block_.id')] = ab;
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
