import Ember from 'ember';

import AxisEvents from '../../utils/draw/axis-events';

/* global d3 */

const dLog = console.debug;

/** AxisEvents is commented out here - not currently required because axis-1d.js
 * registers for events using AxisEvents, filtering by matching axisID.
 * Planning to use AxisEvents here and propagate to just those matching axes.
 */
export default Ember.Component.extend(Ember.Evented, /*AxisEvents,*/ {

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
