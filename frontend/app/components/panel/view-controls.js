import Ember from 'ember';

import { tabActive, inputRangeValue, expRange  } from '../../utils/domElements';


/* global d3 */

export default Ember.Component.extend({
  tagName: 'div',
  // attributes
  // classes

  feed: Ember.inject.service(),

  /** This will change to a value,
   * controls.view.pathControlActiveDensity
   */
  pathDensity : 12.5,
  /** ditto, 
   * controls.view.pathControlActiveSample
   */
  pathSample : 100,

  pathControlActiveDensity : Ember.computed('pathDensityActive', 'pathDensity', function () {
    let active = this.get('pathDensityActive'),
     pathDensity = this.get('pathDensity'),
      density = active && expRange(pathDensity, 100, 100, 1024);
    if (density) {
      let digits = Math.log10(density),
      decimals =  (digits > 2) ? 0 : ((digits > 1) ? 1 : 2);
      density = density.toFixed(decimals);
    }
    let value = inputRangeValue('range-pathDensity');
    Ember.run.next(function () {
      let value2 = inputRangeValue('range-pathDensity');
      if (value !== value2)
        console.log('range-pathDensity',  value);
    });

    console.log('pathControlActiveDensity', pathDensity, density);
    return density;
   }),

  pathControlActiveSample : Ember.computed('pathSampleActive', 'pathSample', function () {
    let active = this.get('pathSampleActive'),
     pathSample = this.get('pathSample'),
     sample = active && expRange(pathSample, 100, 100, 1024);
    if (sample) {
      sample = sample.toFixed();
    }
    let value = inputRangeValue('range-pathSample');
    Ember.run.next(function () {
      let value2 = inputRangeValue('range-pathSample');
      if (value !== value2)
        console.log('range-pathSample',  value);
    });
    console.log('pathControlActiveSample', pathSample, sample);
    return sample;
   }),


  didInsertElement() {
    console.log("components/draw-controls didInsertElement()", this.drawActions);
    this.drawActions.trigger("drawControlsLife", true);
    // initially 'Paths - Density' tab is active.
    this.send('pathTabActive', 'density');
    this.set('controls.view', this);
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
