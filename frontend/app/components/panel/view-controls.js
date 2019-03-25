import Ember from 'ember';

import {
  tabActive, inputRangeValue,
  expRangeBase, expRange, expRangeInitial
} from '../../utils/domElements';

import { toBool } from '../../utils/common/strings';

/* global d3 */

export default Ember.Component.extend({
  tagName: 'div',
  // attributes
  // classes

  feed: Ember.inject.service(),

  /** may be set via URL param - @see readParsedOptions(). */
  pathsViaStream : true,

  /** This slider value is mapped via an exponential (computed) function and
   * available as :
   * controls.view.pathControlActiveDensity
   *
   * Calculation of initial / default value :
   * Some explanation in see comment in @expRange()
   * and @see updateSbSizeThresh() (draw-map.js)
   */
  pathDensity : expRangeInitial(1, expRangeBase(100/2, 100)),
  /** ditto, 
   * controls.view.pathControlActiveSample
   */
  pathSample : expRangeInitial(50, expRangeBase(100, 1024)),

  pathControlActiveDensity : Ember.computed('pathDensityActive', 'pathDensity', function () {
    let active = this.get('pathDensityActive'),
     pathDensity = this.get('pathDensity'),
      density = active && expRange(pathDensity, 100/2, 100);
    if (density) {
      let digits = Math.log10(density),
      decimals =  (digits > 2) ? 0 : ((digits > 1) ? 1 : 2);
      density = density.toFixed(decimals);
    }
    let value = inputRangeValue('range-pathDensity');
    Ember.run.next(function () {
      let value2 = inputRangeValue('range-pathDensity');
      if (value !== value2)
        console.log('range-pathDensity',  value, value2);
    });

    console.log('pathControlActiveDensity', pathDensity, density);
    return density;
   }),

  pathControlActiveSample : Ember.computed('pathSampleActive', 'pathSample', function () {
    let active = this.get('pathSampleActive'),
     pathSample = this.get('pathSample'),
     sample = active && expRange(pathSample, 100, 1024);
    if (sample) {
      sample = sample.toFixed();
    }
    let value = inputRangeValue('range-pathSample');
    Ember.run.next(function () {
      let value2 = inputRangeValue('range-pathSample');
      if (value !== value2)
        console.log('range-pathSample',  value, value2);
    });
    console.log('pathControlActiveSample', pathSample, sample);
    return sample;
   }),


  didInsertElement() {
    console.log("components/draw-controls didInsertElement()", this.drawActions);
    this._super(...arguments);

    this.drawActions.trigger("drawControlsLife", true);
    // initially 'Paths - Density' tab is active.
    this.send('pathTabActive', 'density');
    this.readParsedOptions();
    this.set('controls.view', this);
  },
  readParsedOptions() {
    /** this can be passed in from model.params.parsedOptions and then access pathsViaStream as 
     * this.get('parsedOptions.pathsViaStream');
     */
    let parsedOptions = this.drawActions.model.params.parsedOptions;

    /** default to true if not given as URL query param e.g. options=pathsViaStream=false  */
    let pathsViaStream = parsedOptions.pathsViaStream;
      // this.get('parsedOptions.pathsViaStream');
    if (pathsViaStream !== undefined)
      this.set('pathsViaStream', toBool(pathsViaStream));
  },
  willDestroyElement() {
    console.log("components/draw-controls willDestroyElement()");
    this.drawActions.trigger("drawControlsLife", false);
  },

  actions : {
    pathTabActive : function(tabName) {
      let active;
      active = tabName === 'density';
      console.log('pathDensityActive', active, tabName);
      this.set('pathDensityActive', active);

      active = tabName === 'sample';
      console.log('pathSampleActive', active);
      this.set('pathSampleActive', active);
    },

    flipRegion : function () {
      this.get('feed').trigger('flipRegion', undefined);
    },

    clearScaffoldColours  : function () {
      console.log("clearScaffoldColours", "selected-markers.js");
      this.get('feed').trigger('clearScaffoldColours');
    },

    resetZooms : function () {
      this.get('feed').trigger('resetZooms');
    },

  },

});
