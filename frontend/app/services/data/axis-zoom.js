import Service from '@ember/service';


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
  get axisTransitionTime() {
    const axisTransitionTime = 750;
    let time = this.currentZoomPanIsWheel ? axisTransitionTime / 10 : axisTransitionTime;
    // dLog('axisTransitionTime', time);
    return time;
  }
  


});
