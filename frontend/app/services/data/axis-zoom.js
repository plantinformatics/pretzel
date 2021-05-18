import Service from '@ember/service';

/* global d3 */

const dLog = console.debug;

const axisTransitionTime = 750;

export default Service.extend({

  /**
   * set via e.g.
   *   this.set('axisZoom.zoomPan', {isWheelEvent, timeStamp});
   */
  zoomPan : undefined,

  get currentZoomPanIsWheel() {
    let isCurrent;
    if (this.zoomPan && this.zoomPan.isWheelEvent) {
      let
      documentTimeline = new window.DocumentTimeline(),
      timeSince = documentTimeline.currentTime - this.zoomPan.timeStamp;
      isCurrent = timeSince < 1000;
      // dLog('currentZoomPanIsWheel', timeSince, isCurrent);
    }
    return isCurrent;
  },
  /** @return a shorter transition time while currentZoomPanIsWheel.
   * @desc Trialling selectionToTransition() instead of this.
   */
  get axisTransitionTime() {
    let time = this.currentZoomPanIsWheel ? axisTransitionTime / 10 : axisTransitionTime;
    // dLog('axisTransitionTime', time);
    return time;
  },
  /** @return selection as-is if currentZoomPanIsWheel, otherwise return
   * selection.transition()...
   *
   * @desc When the user is using the mouse-wheel to zoom/pan, d3 will provide
   * events as fast as requestAnimationFrame so instead of using transitions,
   * simply update directly using the selection.
   */
  selectionToTransition(selection) {
    // dLog('selectionToTransition', this.currentZoomPanIsWheel, selection.node());
    return this.currentZoomPanIsWheel ? selection :
      selection
      .transition()
      .duration(axisTransitionTime)
      .ease(d3.easeCubic);
  }
  


});
