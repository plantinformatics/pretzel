import Component from '@ember/component';
import { inject as service } from '@ember/service';

import InAxis from './in-axis';
import {
  className,
  AxisCharts,
  setupFrame,
  setupChart,
  drawChart,
  Chart1,
  blockData,
  parsedData
} from '../utils/draw/chart1';
import { DataConfig, dataConfigs } from '../utils/data-types';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;


/*----------------------------------------------------------------------------*/


/* global d3 */

export default Component.extend({

  didRender() {
    this._super.apply(this, arguments);

    this.draw();
  },
  draw() {

  },




});
