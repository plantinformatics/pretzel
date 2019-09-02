import Ember from 'ember';
import DS from 'ember-data';

/** VLinePosition
 * Position of a vertical line segment, e.g. an axis (Stacked) or a Stack of axes.
 * @param     y : domain, range, x : offset
 */
export default DS.Model.extend({

  // VLinePosition, containing setValues() and toString(), split to here from stacks.js

  setValues : function(yDomain, yRange, xOffset) {
    this.set('yDomain', yDomain);
    this.set('yRange', yRange);
    this.set('xOffset', xOffset);
  },
  toString() {
    // console.log('VLinePosition : toString()', this);
    return "VLinePosition:" + (this.yDomain || '') + ',' + (this.yRange || '') + ',' + (this.xOffset || '');
  }

});
