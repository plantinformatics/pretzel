import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';

const { inject: { service } } = Ember;

export default DS.Model.extend({

  pathsP : service('data/paths-progressive'),

  /** id is blockAdjId[0] + '_' + blockAdjId[1], as per.  serializers/block-adj.js : extractId()
   * and utils/draw/stacksAxes : blockAdjKeyFn()
   */

  block0: DS.belongsTo('block', { inverse: null }),
  block1: DS.belongsTo('block', { inverse: null }),
  blockId0: DS.attr('string'), // belongsTo('block'),
  blockId1: DS.attr('string'), // belongsTo('block'),
  pathsResult : DS.attr(),

  zoomCounter : 0,
  // range: attr(),
  /**
   * Depending on zoomCounter is just a stand-in for depending on the domain of each block,
   * which is part of changing the axes (Stacked) to Ember components, and the dependendt keys can be e.g. block0.axis.domain.
   */
  paths : Ember.computed('blockId0', 'blockId1', 'zoomCounter', function () {
    let blockAdjId = [this.get('blockId0'), this.get('blockId1')],
    id = this.get('id');
    if (blockAdjId[0] === undefined)
      blockAdjId = this.id.split('_');
    let
      // getPathsProgressive() expects an array of 2 (string) blockIds.
      paths = this.get('pathsP').getPathsProgressive(blockAdjId);
    let me = this;
    paths.then(function (result) {
      console.log('block-adj paths', result.length, me.get('pathsResult'), id, me);
    }, function (err) {
      console.log('block-adj paths reject', err);
    }
    );
    return paths;
  })


});
