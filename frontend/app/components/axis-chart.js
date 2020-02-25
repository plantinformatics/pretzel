import Ember from 'ember';
const { inject: { service } } = Ember;

import InAxis from './in-axis';
import { className, AxisCharts, setupFrame, setupChart, drawChart, Chart1, blockData, parsedData } from '../utils/draw/chart1';
import { DataConfig, dataConfigs } from '../utils/data-types';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;


/*----------------------------------------------------------------------------*/


/* global d3 */

export default Ember.Component.extend({

  didRender() {
    this.draw();
  },
  draw() {

  },




});
