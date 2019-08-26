import Ember from 'ember';
const { inject: { service } } = Ember;
import { task } from 'ember-concurrency';

const { Mixin } = Ember;

import { Stacked } from '../utils/stacks';
import { updateDomain } from '../utils/stacksLayout';
import VLinePosition from '../models/vline-position';


/** Mixed-into axis-1d to describe the axis position.
 *
 * Adds these attributes, which map part of the axis' domain to the SVG position :
 *   currentPosition  : vline-position
 *   lastDrawn  : vline-position
 *   zoomed : boolean
 */
export default Mixin.create({
  store: Ember.inject.service('store'),

  /** true if currentPosition.yDomain is a subset of the axis domain.  */
  zoomed : false,

  /** The position of the axis line segment is recorded as 2 values : the position
   * when pathUpdate_() was last called, and the current position, which will be different
   * if the user is dragging the axis.
   */
  currentPosition : undefined,
  lastDrawn : undefined,

  init() {
    let store = this.get('store');
    this.set('currentPosition', store.createRecord('vline-position'));
    this.set('lastDrawn', store.createRecord('vline-position'));
    this._super(...arguments);
  },


  /* updateDomain() and setDomain() moved here from utils/stacks.js
   * originally attributes of Stacked.prototype.
   */

  /** Set the domain of the current position using domainCalc() of Block / Axis (Stacked).
   */
  updateDomain()
  {
    let axisS=this.get('axisS');
    if (! axisS) {
      /** This replicates the role of axis-1d.js:axisS();  this will be solved
       * when Stacked is created and owned by axis-1d.
       */
      let axisName = this.get('axis.id');
      axisS = Stacked.getAxis(axisName);
      if (axisS) {
        this.set('axisS', axisS);
        console.log('axis-1d:updateDomain', this, axisName, axisS);
      }
    }
    if (axisS) {
      let y = axisS.getY(), ys = axisS.ys;
      updateDomain(axisS.y, axisS.ys, axisS);
      let domain = axisS.y.domain(),
      axisPosition = this.get('currentPosition');
      console.log('updateDomain', this, /*y, ys,*/ 'domain', domain, axisPosition);
      axisPosition.set('yDomain', domain);
    }
  },
  /** Set the domain of the current position to the given domain
   */
  setDomain(domain)
  {
    /* Update of domain of scales (this.getY() and this.ys) is already done in draw-map: zoom(),
     * whereas this.updateDomain() above uses stacksLayout : updateDomain().
     */
    let
      axisPosition = this.get('currentPosition');
    console.log('setDomain', this, 'domain', domain, axisPosition);
    axisPosition.set('yDomain', domain);
  },
  /** Set the zoomed of the current position to the given value
   */
  setZoomed(zoomed)
  {
    // console.log('setZoomed', this, 'zoomed', zoomed);
    // possibly .zoomed will move into .currentPosition
    this.set('zoomed', zoomed);
  }

});
