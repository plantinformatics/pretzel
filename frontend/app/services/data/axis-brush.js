import Ember from 'ember';
import Service from '@ember/service';
const { inject: { service } } = Ember;

let trace_axisBrush = 0;
const dLog = console.debug;

const typeName = 'axis-brush';

export default Service.extend(Ember.Evented, {
  blockService: service('data/block'),
  store: service(),

  /** look up axis-brush object instances in the store.
   * @return all instances.
   */
  all: Ember.computed(function() {
    let records = this.get('store').peekAll(typeName);
    if (trace_axisBrush)
      dLog('all', records);
    return records;
  }),

  /** Collate a list of the axes which are brushed.
   * @return reference blocks of the brushed axes.
   */
  brushedAxes: Ember.computed(
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
    })

});
