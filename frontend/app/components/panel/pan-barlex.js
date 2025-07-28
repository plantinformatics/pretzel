import Component from '@glimmer/component';

import { tracked } from '@glimmer/tracking';
import { computed, action } from '@ember/object';
import { inject as service } from '@ember/service';

import vcfGenotypeBrapi from '@plantinformatics/vcf-genotype-brapi';
const /*import */{
  fetchDotPlotData,
} = vcfGenotypeBrapi.ipkPanbarlex; /*from 'vcf-genotype-brapi'; */


const dLog = console.debug;

/** Recommended upper limit on interval length for dotplot request. */
const intervalLengthLimit = 5000;

//------------------------------------------------------------------------------

/** Provide access to PanBARLEX data and tools, via Web API.
 *
 * @param brushedDatasetsPanBARLEX an array of blocks for which
 * datasetId._meta.PanBARLEXName is defined, for the currently brushed axes.
 */
export default class PanBarlexComponent extends Component {
  @service('data/axis-brush') axisBrush;

  //----------------------------------------------------------------------------

  /** Result of getDotPlot().  Loading message is shown if this is defined and
   * .base64Image is not yet defined (by receiving the response).  */
  @tracked
  requestPromise;
  /** nullish or error message from getDotPlot(). For display in GUI.
   */
  @tracked
  errorMessage;

  //----------------------------------------------------------------------------

  constructor() {
    const fnName = 'constructor';
    super(...arguments);

    dLog('PanBARLEX', 'pan-barlex', fnName, this);
    if (window.PretzelFrontend) {
      window.PretzelFrontend.panBarlex = this;
    }
  }

  //----------------------------------------------------------------------------

  /** Calculate length of a brushedDomainInt interval.
   * Called from hbs for display in the table.
   */
  @action
  intervalLength(interval) {
    return interval[1] - interval[0];
  }

  /** If some of the brushed intervals are intervalLengthLimit, return a
   * message for display in the GUI.
   */
  @computed('args.brushedDatasetsPanBARLEX')
  get intervalLengthMessage() {
    const
    fnName = 'intervalLengthMessage',
    brushedAxes = this.args.brushedDatasetsPanBARLEX
      .filter(brushedAxis => this.intervalLength(brushedAxis.brushedDomainInt) > intervalLengthLimit)
      .map(ba => (
        ba.block.datasetId.id + ' ' + ba.block.scope + ' ' +
          ba.brushedDomainInt.join(',') + ' ' +
          this.intervalLength(ba.brushedDomainInt))),
    message = ! brushedAxes.length ? null :
      'The length of these intervals is longer than recommended for dotplot : ' +
      brushedAxes.join('; ');
    return message;
  }

  //----------------------------------------------------------------------------

  /** Send a request to IPK PanBARLEX for a dotplot image for the brushed axis
   * intervals.
   * @return promise yielding web API response
   */
  getDotPlot() {
    const
    fnName = 'getDotPlot',
    brushedAxes = this.args.brushedDatasetsPanBARLEX,
    intervals = brushedAxes.map(ba => {
      const
      block = ba.block,
      genotype = block.get('datasetId._meta.PanBARLEXName'),
      contig = block.get('scope'),
      [start, end] = ba.brushedDomainInt,
      interval = {genotype, contig, start, end};
      return interval;
    }),
    promise = fetchDotPlotData(intervals);
    this.requestPromise = promise;
    this.errorMessage = null;
    return promise;
  }
  /** Request dotplot and display the result.
   * Called via user button click in pan-barlex.hbs.
   */
  @action
  showDotPlot() {
    const fnName = 'showDotPlot';
    this.getDotPlot().then(response => {
      /** response is e.g. :
       * {"seq":{"id":"OUN333 chr1H 0-100","seq":"TAAACCCT..."},
       *  "id":"OUN333,chr1H:0-100","dotplotBase64":"..."}
       * Example error response :
       * {"seq":"","error":true,"errorMessage":"Start position can not be greater than end."}
      */
      dLog(fnName, response.seq, response.id, response.errorMessage);
      if (response.error) {
        this.errorMessage = response.errorMessage;
      } else {
        this.showImage(response.dotplotBase64);
      }
    });
  }
  /** PNG image for display in <img>, based on image received by getDotPlot().
   */
  @tracked base64Image;
  /** Display the given dotPlot image (which is a png) */
  showImage(base64ImageData) {
    const base64HrefString = 'data:image/png;base64,' + base64ImageData;
    this.base64Image = base64HrefString;
  }

  //----------------------------------------------------------------------------

}
