import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Model, { attr, belongsTo } from '@ember-data/model';

const ObjName = 'axis-brush';

const dLog = console.debug;

export default Model.extend({

  pathsP : service('data/paths-progressive'),
  blockService: service('data/block'),

  block: belongsTo('block', { inverse: null }),
  blockId: attr('string'),
  // brushedDomain : DS.attr(),
  // featuresResult : DS.attr(),

  zoomCounter : 0,

  get block_() {
    /** axis-brush and block-adj will change from model to Object so they can
     * reference blocks from any store.  this.block and block-adj.block{0,1}
     * can't reference any blocks because they are in default store, so
     * ab.get('block.isViewed') or ab.get('block.id') cannot work;
     * (this may only affect blocks from secondary servers?).
     */
    let block = this.block;
    if (block?.id === undefined) {
      const blockId = this.id || this.blockId;
      block = this.blockService.viewedById[blockId];
    }
    return block;
  },

  /**
   * Depending on zoomCounter is just a stand-in for depending on the domain of block,
   * which is part of changing the axes (Stacked) to Ember components, and the dependent keys can be e.g. block.axis.domain.
   */
  features : computed('blockId', 'zoomCounter', 'brushedDomain.[0]', 'brushedDomain.[1]', function () {
    let blockId = this.get('blockId'),
    id = this.get('id');
    if (blockId === undefined) {
      blockId = this.id;
    }
    let
      features = this.get('pathsP').getBlockFeaturesInterval(blockId);
    let me = this;
    features.then(function (result) {
      console.log(ObjName, ' features', result?.length, id, me);
    }, function (err) {
      console.log(ObjName, ' features reject', err);
    }
    );
    return features;
  })


});
