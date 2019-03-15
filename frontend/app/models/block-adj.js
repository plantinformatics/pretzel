import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';

const { inject: { service } } = Ember;

export default DS.Model.extend({

  pathsP : service('data/paths-progressive'),

  block0: DS.belongsTo('block', { inverse: null }),
  block1: DS.belongsTo('block', { inverse: null }),
  blockId0: DS.attr('string'), // belongsTo('block'),
  blockId1: DS.attr('string'), // belongsTo('block'),
  'pathsResult' : DS.attr(),

  zoomCounter : 0,
  // range: attr(),
  /**
   * Depending on zoomCounter is just a stand-in for depending on the domain of each block,
   * which is part of changing the axes (Stacked) to Ember components, and the dependendt keys can be e.g. block0.axis.domain.
   */
  paths : Ember.computed('blockId0', 'blockId1', 'zoomCounter', function () {
    let
      // getPathsProgressive() expects an array of 2 (string) blockIds.
      paths = this.get('pathsP').getPathsProgressive([this.get('blockId0'), this.get('blockId1')]);
    paths.then(function (result) {
      console.log('block-adj paths', result.length);
    });
    return paths;
  })


});
