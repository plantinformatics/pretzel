import Ember from 'ember';
import Service from '@ember/service';
const { inject: { service } } = Ember;

let trace_axisBrush = 1;

const typeName = 'axis-brush';

export default Service.extend(Ember.Evented, {
  blockService: service('data/block'),
  store: service(),

  /** @return block records */
  all: Ember.computed(function() {
    let records = this.get('store').peekAll(typeName);
    if (trace_axisBrush)
      console.log('all', records);
    return records;
  }),

  brushedAxes: Ember.computed(
    'blockService.viewed',
    'all.[]',
    'all.@each.brushedDomain',
    // 'all.@each.block.isViewed',
    function() {
      console.log('brushedAxes', this);
      const fnName = 'brushedAxes';
      let records = this.get('all');
      // if (trace_axisBrush > 1)
        records.map(function (a) { console.log(fnName, a, a.get('brushedDomain')); } );
      if (trace_axisBrush)
        console.log('viewed Blocks', records);
      let blocks = records.filter(function (ab) {
        return ab.get('block.isViewed') && ab.get('brushedDomain'); } );
      blocks = blocks.toArray(); // Array.from(blocks);
      if (trace_axisBrush)
        console.log(fnName, blocks);

      return blocks;
    })

});
