import { on } from '@ember/object/evented';
import { bind } from '@ember/runloop';
import Mixin from '@ember/object/mixin';
import { inject as service } from '@ember/service';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';

import { task } from 'ember-concurrency';

// import these from @ember/runloop instead of lodash
import { debounce, throttle } from '@ember/runloop'; // 'lodash/function';

import { debounce as lodash_debounce, throttle as lodash_throttle } from 'lodash/function';

import { Stacked } from '../utils/stacks';
import { updateDomain } from '../utils/stacksLayout';
import VLinePosition from '../models/vline-position';

const dLog = console.debug;
const trace = 0;

/** Mixed-into axis-1d to describe the axis position.
 *
 * Adds these attributes, which map part of the axis' domain to the SVG position :
 *   currentPosition  : vline-position
 *   lastDrawn  : vline-position
 *   zoomed : boolean
 */
export default Mixin.create({
  store: service('store'),
  controls : service(),

  controlsView : alias('controls.controls.view'),

  /** true if currentPosition.yDomain is a subset of the axis domain.  */
  zoomed : false,

  /** The position of the axis line segment is recorded as 2 values : the position
   * when pathUpdate_() was last called, and the current position, which will be different
   * if the user is dragging the axis.
   */
  currentPosition : undefined,
  lastDrawn : undefined,

  init_1 : on('init', function() {
    let store = this.get('store');
    this.set('currentPosition', store.createRecord('vline-position'));
    this.set('lastDrawn', store.createRecord('vline-position'));
    this._super(...arguments);
  }),


  /* updateDomain() and setDomain() moved here from utils/stacks.js
   * originally attributes of Stacked.prototype.
   */

  /** Set the domain of the current position using domainCalc() of Block / Axis (Stacked).
   */
  updateDomain_unused()
  {
    let axisS=this.get('axisS');
    if (! axisS) {
      /** This replicates the role of axis-1d.js:axisS();  this will be solved
       * when Stacked is created and owned by axis-1d.
       * (also : now using ensureAxis() in data/block.js : axesBlocks())
       */
      let axisName = this.get('axis.id');
      axisS = Stacked.getAxis(axisName);
      if (axisS) {
        this.set('axisS', axisS);
        dLog('axis-1d:updateDomain', this, axisName, axisS);
      }
    }
    if (axisS) {
      let y = axisS.getY(), ys = axisS.ys;
      updateDomain(axisS.y, axisS.ys, axisS);
      let domain = axisS.y.domain();
      this.setDomain(domain);
    }
  },
  /** Set the domain of the current position to the given domain
   */
  setDomain(domain)
  {
    if (this.get('isDestroyed') || this.get('isDestroying'))
      return;

    /* Update of domain of scales (this.getY() and this.ys) is already done in draw-map: zoom(),
     * whereas this.updateDomain() above uses stacksLayout : updateDomain().
     */
    let
      axisPosition = this.get('currentPosition');
    if (trace > 2) 
      dLog('setDomain', this, 'domain', domain, axisPosition);
    axisPosition.set('yDomain', domain);
    debounce(this, this.setDomainDebounced, domain, this.get('controlsView.debounceTime'));
    // lodash-specific arg : {maxWait : 1000})
    /* use lodash_throttle() because it has a trailing edge option (default true).
     * Without this, the last (few) zoom events may be dropped, and e.g. if
     * zooming out, paths which should come into view won't.
     */
    this.setDomainThrottled(domain);
  },
  setDomainDebounced(domain) {
    this.set('currentPosition.yDomainDebounced', domain);
  },
  setDomainThrottled(domain) {
    this.set('currentPosition.yDomainThrottled', domain);
  },
  setDomainThrottled : computed('controls.view.throttleTime', function () {
    let
    throttled = lodash_throttle(
      function currentPosition_setDomain (domain) {
        this.set('currentPosition.yDomainThrottled', domain);
      }, this.get('controls.view.throttleTime'));
    dLog('currentPosition_setDomain', this.get('controls.view.throttleTime'));
    return throttled;
  }),


  /** Set the zoomed of the current position to the given value
   */
  setZoomed(zoomed)
  {
    // dLog('setZoomed', this, 'zoomed', zoomed);
    // possibly .zoomed will move into .currentPosition
    this.set('zoomed', zoomed);
  }

});
