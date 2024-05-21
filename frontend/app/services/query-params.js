import EmberObject, { computed } from '@ember/object';
import Evented from '@ember/object/evented';
import Service from '@ember/service';

// const { inject: { service } } = Ember;

// import { queryParam } from 'ember-query-params-service';

import { parseOptions } from '../utils/common/strings';

/* global d3 */



export default Service.extend(Evented, {
  // block: service('data/block'),

  params : EmberObject.create({}),

  /*--------------------------------------------------------------------------*/

  /** Parse params.options.
   */
  urlOptions : computed(function () {
    /** No dependency is given because params will change, but these options aren't
     * changeable at runtime by user action (although such could be added later).
     */
    let options_param = this.get('params.options'), options;
    if (options_param && (options = parseOptions(options_param)))
    {
      // alpha enables new features which are not yet robust.
      /* splitAxes (distinct from splitAxes1) enables buttons in axis-2d.hbs for :
       *  addTracks, addChart, addLd, addTable
       * axis-tracks and axis-charts are now implemented and enabled by default (splitAxes1).
       */
      options.splitAxes |= options.alpha;
    }
    else
      options = {};
    /* splitAxes1 is now enabled by default. */
    if (! options.hasOwnProperty('splitAxes1'))
      options.splitAxes1 = true;
    /* featuresCounts is now enabled by default. */
    if (! options.hasOwnProperty('featuresCounts'))
      options.featuresCounts = true;
    /* Germinate is now enabled by default. */
    if (! options.hasOwnProperty('Germinate'))
      options.Germinate = true;
    
    return options;
  }),
  urlOptionsEffect: computed('urlOptions', function () {
    let options = this.get('urlOptions');
    if (options)
      this.optionsToDom(options);
    // enable to see the results of parseOptions() on screen.
    // return JSON.stringify(options);
  }),
  optionsToDom(options) {
      /** In addition to the options which are added as body classes in the
       * following statement, the other supported options are :
       *   splitAxes  (enables buttons for extended axis and dot-plot in configureAxisTitleMenu())
       */
      d3.select('body')
        // alpha enables alpha features e.g. extended/split-axes, dot plot,
        .classed("alpha", options.alpha)
        // chartOptions enables (left panel : view) "Chart Options"
        .classed("chartOptions", options.chartOptions)
        .classed("gotoFeature", options.gotoFeature)
        .classed("devel", options.devel) // enables some trace areas
        .classed("axis2dResizer", options.axis2dResizer)
        .classed('allInitially', options.allInitially)
      ;
  },

  /*--------------------------------------------------------------------------*/

});
