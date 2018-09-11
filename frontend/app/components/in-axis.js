import Ember from 'ember';

import { eltWidthResizable, noShiftKeyfilter } from '../utils/domElements';

/* global d3 */

export default Ember.Component.extend({

  className : undefined,

  didInsertElement : function() {
    this._super(...arguments);
    /* grandparent component - listen for resize and zoom events.
     * possibly these events will move from axis-2d to axis-accordion.
     * This event handling will move to in-axis, since it is shared by all children of axis-2d/axis-accordion.
     */
    let axisComponent = this.get("axis");
    console.log("components/in-axis didInsertElement()", axisComponent, axisComponent.axisID);
    axisComponent.on('resized', this, 'resized');
    axisComponent.on('zoomed', this, 'zoomed');
  },
  willDestroyElement : function() {
    let axisComponent = this.get("axis");
    // console.log(axisComponent);
    axisComponent.off('resized', this, 'resized');
    axisComponent.off('zoomed', this, 'zoomed');
    this._super(...arguments);
  },


  didRender() {
    this._super(...arguments);
    console.log("components/in-axis didRender()");
  },

  /** @param [axisID, t] */
  redrawOnce(axisID_t) {
    console.log("redrawOnce", axisID_t);
    // -  redraw if axisID matches this axis
    // possibly use transition t for redraw 
    let redraw = this.get('redraw');
    if (redraw)
      redraw.apply(this, axisID_t);
  },
  redrawDebounced(axisID_t) {
    Ember.run.debounce(this, this.redrawOnce, axisID_t, 1000);
  },

  /*--------------------------------------------------------------------------*/

  getRanges(margin)
  {
    // initial version supports only 1 split axis; next identify axis by axisID (and possibly stack id)
    // <g class="axis-use">
    let gAxis = d3.select("g.axis-use"),
    /** relative to the transform of parent g.axis-outer */
    bbox = gAxis.node().getBBox(),
    yrange = [bbox.y, bbox.height];
    if (bbox.x < 0)
    {
      console.log("x < 0", bbox);
      bbox.x = 0;
    }

    let
            parentW = bbox.width,
      parentH = bbox.height,
      width = parentW - margin.left - margin.right,
      height = parentH - margin.top - margin.bottom;

    let
      oa = this.get('data'),
    axisID = gAxis.node().parentElement.__data__,
    yAxis = oa.y[axisID], // this.get('y')
    yDomain = [yAxis.invert(yrange[0]), yAxis.invert(yrange[1])],
    pxSize = (yDomain[1] - yDomain[0]) / bbox.height,
    result =
      {
        axisID : axisID,
        gAxis : gAxis,
        margin : margin,
        bbox : bbox,
        drawSize : [width, height],
        yAxis : yAxis,
        yDomain : yDomain,
        pxSize : pxSize
      };
    console.log("in-axis: getRanges", result);
    return result;
  },

  /** Create/manage the frame elements which are common to components mixed with
   * in-axis, i.e. sub-components of axis-2d / axis-accordion
 */
  commonFrame(gAxis, ranges)
  {
    let bbox = ranges.bbox;
    let className = this.get('className');
    // factored from axis-chart.js: layoutAndDrawChart()
    /** parent; contains a clipPath, g > rect, text.resizer.  */
    let gps =   gAxis
      .selectAll("g." + className)
      .data([1]),
    gp = gps
      .enter()
      .insert("g", ":first-child")
      .attr('class', className);
    // see @axis-chart:layoutAndDrawChart() for draft resizer code
    let gpa =
    gp // define the clipPath
      .append("clipPath")       // define a clip path
      .attr("id", "axis-clip") // give the clipPath an ID
      .append("rect"),          // shape it as a rect
    gprm = 
    gpa.merge(gps.selectAll("g > clipPath > rect"))
      .attr("x", bbox.x)
      .attr("y", bbox.y)
      .attr("width", bbox.width)
      .attr("height", bbox.height)
    ;
    gp.append("g")
      .attr("clip-path", "url(#axis-clip)"); // clip the rectangle

    let
      margin  = ranges.margin;

    let g = 
      gps.merge(gp).selectAll("g." + className+  " > g");
    g
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    return g;
  },

  /** Add a <g> to wrap some content. */
  group(g, groupClassName)
  {
      let gs = g
        .selectAll("g > g." + groupClassName)
        .data([1]), // or inherit g.datum(), or [groupClassName]
      gsa = gs
        .enter()
        .append("g")
        .attr("class", groupClassName),
      resultG = gsa.merge(gs);
    return resultG;
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
  zoomed : function(axisID_t) {
    console.log("zoomed in components/in-axis", this, axisID_t);
    this.redrawDebounced(axisID_t);
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
