import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';

const { inject: { service } } = Ember;

export default DS.Model.extend({

  pathsP : service('data/paths-progressive'),

  block0: DS.attr('string'), // belongsTo('block'),
  block1: DS.attr('string'), // belongsTo('block'),
  'paths-result' : DS.attr(),

  // range: attr(),
  paths : Ember.computed('blockId0', 'blockId1', function () {
    let
      // getPathsProgressive() expects an array of 2 (string) blockIds.
      paths = this.get('pathsP').getPathsProgressive([this.get('blockId0'), this.get('blockId1')]);
    paths.then(function (result) {
      console.log('block-adj paths', result.length);
    });
    return paths;
  })


});
