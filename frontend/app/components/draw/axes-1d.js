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

  menuAxis : computed.alias('drawMap.menuAxis'),

  /*--------------------------------------------------------------------------*/

  init() {
    this._super(...arguments);

    this.get('block').set('axes1d', this);
  },

  /*--------------------------------------------------------------------------*/

  /** @return the axis-1d components, which are child components of this
   * component, distinguished by having a .axis attribute.  */
  axis1dArray : computed('childViews.@each.isDestroying', function () {
    let axes1d = this.get('childViews')
        .filter((a1) => ! a1.isDestroying && a1.axis);
    dLog('axis1dArray', axes1d);
    return axes1d;
  }),

  /*--------------------------------------------------------------------------*/

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
