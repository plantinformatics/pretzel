import Evented from '@ember/object/evented';
import Component from '@ember/component';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import AxisEvents from '../../utils/draw/axis-events';

/* global d3 */

const dLog = console.debug;

/** AxisEvents is commented out here - not currently required because axis-1d.js
 * registers for events using AxisEvents, filtering by matching axisID.
 * Planning to use AxisEvents here and propagate to just those matching axes.
 */
export default Component.extend(Evented, /*AxisEvents,*/ {
  block : service('data/block'),
  selected : service('data/selected'),

  menuAxis : computed.alias('drawMap.menuAxis'),

  /*--------------------------------------------------------------------------*/

  init() {
    this._super(...arguments);

    this.get('block').set('axes1d', this);
    this.set('axis1dArray', Ember.A());
  },

  /*--------------------------------------------------------------------------*/

  /** Maintain a list of child axis-1d components, .axis1dArray
   */
  axis1dExists(axis1d, exists) {
    let axis1dArray = this.get('axis1dArray');
    dLog('axis1dExists', axis1d, axis1dArray);
    let i = axis1dArray.indexOf(axis1d);
    if (exists && (i === -1)) {
      /** since (i === -1) here we can use pushObject(); addObject() can be
       * used without checking indexOf().  */
      axis1dArray.pushObject(axis1d);
      dLog('axis1dExists pushed', axis1d, axis1dArray);
    } else if (! exists && (i !== -1)) {
      axis1dArray.removeAt(i, 1);
      dLog('axis1dExists removed', axis1d, i, axis1dArray);
    }
  },

  /** @return the axis-1d components, which are child components of this
   * component, distinguished by having a .axis attribute.  */
  axis1dArrayCP : computed('axesP.[]', function () {
    let axes1d = this.get('childViews')
        .filter((a1) => ! a1.isDestroying && a1.axis);
    dLog('axis1dArray', axes1d);
    return axes1d;
  }),

  /*--------------------------------------------------------------------------*/

  /** Match axis-1d using dataset name and scope; this can match with axes of
   * any server.
   * @param datasetId block.get('datasetId.id')
   * @param scope block.get('scope')
   * @return axis-1d
   */
  datasetIdScope2axis1d(datasetId, scope) {
    const fnName = 'datasetIdScope2axis1d';
    let 
    axis1d = this.axis1dArray.find((a1) => {
      let
      a1Block = a1.axis,
      match = (a1.axis.get('datasetId.id') === datasetId) && 
        (a1Block.get('scope') === scope);
      return match;
    });
    dLog(fnName, datasetId, scope, axis1d);
    return axis1d;
  },

  // ---------------------------------------------------------------------------

  /** axes-1d receives axisStackChanged from draw-map and
   * (todo) propagates it to its children
   */
  axisStackChanged : function() {
    dLog("axisStackChanged in components/axes-1d");
  },

  /** @param [axisID, t] */
  zoomedAxis : function(axisID_t) {
    dLog("zoomedAxis in components/axes-1d", axisID_t);
  }

  /*--------------------------------------------------------------------------*/


});
