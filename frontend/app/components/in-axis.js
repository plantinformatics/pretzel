import Ember from 'ember';

import { eltWidthResizable, noShiftKeyfilter } from '../utils/domElements';

/* global d3 */

export default Ember.Component.extend({


  didInsertElement : function() {
    /* grandparent component - listen for resize and zoom events.
     * possibly these events will move from axis-2d to axis-accordion.
     * This event handling will move to in-axis, since it is shared by all children of axis-2d/axis-accordion.
     */
    let axisComponent = this.get("axis");
    console.log("components/in-axis didInsertElement()", axisComponent, axisComponent.apID);
    axisComponent.on('resized', this, 'resized');
    axisComponent.on('zoomed', this, 'zoomed');
  },
  willDestroyElement : function() {
    let axisComponent = this.get("axis");
    // console.log(axisComponent);
    axisComponent.off('resized', this, 'resized');
    axisComponent.off('zoomed', this, 'zoomed');
  },


  didRender() {
    console.log("components/in-axis didRender()");
  },

  /** @param [apID, t] */
  redrawOnce(apID_t) {
    console.log("redrawOnce", apID_t);
    // -  redraw if apID matches this axis
    // possibly use transition t for redraw 
    let redraw = this.get('redraw');
    if (redraw)
      redraw.apply(this, apID_t);
  },
  redrawDebounced(apID_t) {
    Ember.run.debounce(this, this.redrawOnce, apID_t, 1000);
  },

  /*--------------------------------------------------------------------------*/

  getRanges()
  {
    // initial version supports only 1 split axis; next identify axis by APid (and possibly stack id)
    // <g class="axis-use">
    let gAxis = d3.select("g.axis-use"),
    /** relative to the transform of parent g.ap */
    bbox = gAxis.node().getBBox(),
    yrange = [bbox.y, bbox.height];
    if (bbox.x < 0)
    {
      console.log("x < 0", bbox);
      bbox.x = 0;
    }

    let
      oa = this.get('data'),
    apID = gAxis.node().parentElement.__data__,
    yAxis = oa.y[apID], // this.get('y')
    yDomain = [yAxis.invert(yrange[0]), yAxis.invert(yrange[1])],
    pxSize = (yDomain[1] - yDomain[0]) / bbox.height,
    result =
      {
        apID : apID,
        gAxis : gAxis,
        bbox : bbox,
        yAxis : yAxis,
        yDomain : yDomain,
        pxSize : pxSize
      };
    return result;
  },

  /*--------------------------------------------------------------------------*/


  width : undefined,
  resized : function(prevSize, currentSize) {
    console.log("resized in components/in-axis", this, prevSize, currentSize);
    // resize g.chart and clip by * currentSize / prevSize, 
    let width =  this.get('width');
    width = width
      ? width * currentSize / prevSize
      : currentSize / 1 /* or number of subComponents */;
    console.log("resized from width", this.get('width'), "to", width);
    this.set('width', width);
    this.redrawDebounced();
  },
  zoomed : function(apID_t) {
    console.log("zoomed in components/in-axis", this, apID_t);
    this.redrawDebounced(apID_t);
  },

  paste: function(event) {
    console.log("components/in-axis paste", event, this, event.target);

    let cb = event.originalEvent.clipboardData;

    if (false)
      for (let i=0; i<cb.types.length; i++)
    {
        console.log(i, cb.types[i], cb.getData(cb.types[i]));
      };
    let i = cb.types.indexOf("text/plain"), textPlain = cb.getData(cb.types[i]),
    className = this.get('className'),
    inputElt=Ember.$('.' + className + '.pasteData')
    // inputElt = event.target
    ;
    /* multiple subcomponents of the same type not supported yet - clashes here in paste selector,
     * and in output target addressing.
     */
    if (inputElt.length !== 1)
      console.log("inputElt", inputElt, className, this);
    Ember.run.later(function() { inputElt.empty(); } );

    let pasteProcess = this.get('pasteProcess');
    if (pasteProcess)
      pasteProcess.apply(this, [textPlain]);
    return false;
  },

});
