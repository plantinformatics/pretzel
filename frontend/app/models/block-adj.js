import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';

const { inject: { service } } = Ember;

import { /*stacks,*/ Stacked } from '../utils/stacks';


export default DS.Model.extend({

  pathsPro : service('data/paths-progressive'),
  flowsService: service('data/flows-collate'),

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

  blockAdjId : Ember.computed('blockId0', 'blockId1', function () {
    let
    blockAdjId = [this.get('blockId0'), this.get('blockId1')];
    return blockAdjId;
  }),

  /*--------------------------------------------------------------------------*/
  /* CFs based on axes could be moved to a component, e.g. draw/ stacks-view or block-adj */

  /** Result is, for each blockID in blockAdjId,  the axis on which the block is displayed.
   * Will need to add dependency on stacks component, because block can be un-viewed then re-viewed.
   */
  axes :  Ember.computed('blockAdjId', function () {
    let
      blockAdjId = this.get('blockAdjId'),
    axes = blockAdjId.map(function (blockId) {
      return Stacked.getAxis(blockId);
    });
    console.log('axes', blockAdjId, axes);
    return axes;
  }),

  /** Result is, for each blockID in blockAdjId,  the interval params of the axis on which the block is displayed.
   * @see axes()
   */
  axisDimensions :  Ember.computed('axes', 'zoomCounter', function () {
    let 
      axes = this.get('axes'),
      intervals =
      axes.map(function (axis) {
        /** axes() needs to be recalculated after a block is adopted;
         * can depend on axes[*].axis1d.axisStackChanged ...
         */
        if (axis.stack.axes[0] !== axis) {
          axis = Stacked.getAxis(axis.axisName);
        }
      return axis.axisDimensions();
      });
    return intervals;
  }),

  /** Result is true if the domains of the axes of this blockAdj have changed
   * since intervalParams was noted.
   */
  domainChange :  Ember.computed('axisDimensions', 'intervalParams', function () {
      let intervals = this.get('intervalParams'),
    intervalsAxes = this.get('axisDimensions'),
      domainsDiffer = function ()
      {
        let
        domainChanges = [0, 1].map(function (i) {
          let d = intervals.axes[i].domain,
          d2 = intervalsAxes[i].domain,
          /** u === 1 means one domain is defined and the other is not, i.e. change is true.
           * Only evaluate d[] and d2[] if both domains are defined, i.e. u === 2. */
          u = (d === undefined) + (d2 === undefined),
          change = (u === 1) ||
            ((u === 0) && ((d[0] !== d2[0]) || (d[1] !== d2[1])));
          return change;
        });
        let change = domainChanges[0] || domainChanges[1];
        console.log('domainChange', intervals, intervalsAxes, domainChanges, change);
        return change;
      },
      domainChange = ! intervals || domainsDiffer();
    return domainChange;
  }),




  /**
   * Depending on zoomCounter is just a stand-in for depending on the domain of each block,
   * which is part of changing the axes (Stacked) to Ember components, and the dependent keys can be e.g. block0.axis.domain.
   */
  paths : Ember.computed('blockId0', 'blockId1', 'zoomCounter', function () {
    let blockAdjId = this.get('blockAdjId'),
    id = this.get('id');
    if (blockAdjId[0] === undefined)
      blockAdjId = this.id.split('_');

    let flowsService = this.get('flowsService'),
    flows = flowsService.get('flows');

    let me = this;
    let result;

    if (flows.direct.visible) {
      let
        // getPathsProgressive() expects an array of 2 (string) blockIds.
        paths = this.get('pathsPro').getPathsProgressive(this, blockAdjId);
      paths.then(
        function (result) {
          console.log('block-adj paths', result.length, me.get('pathsResult'), id, me);
        }, function (err) {
          console.log('block-adj paths reject', err);
        }
      );
      result = paths;
    }

    if (flows.alias.visible) {
      let
        // getPathsProgressive() expects an array of 2 (string) blockIds.
        pathsAliases = this.get('pathsPro').getPathsAliasesProgressive(this, blockAdjId);
      pathsAliases.then(
        function (result) {
          console.log('block-adj pathsAliases', result && result.length, me.get('pathsAliasesResult'), id, me);
        }, function (err) {
          console.log('block-adj pathsResult reject', err);
        }
      );
      if (result === undefined)
        result = pathsAliases;
    }

    return result;
  })

  /*--------------------------------------------------------------------------*/

});
