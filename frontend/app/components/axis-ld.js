import Ember from 'ember';

import InAxis from './in-axis';

const className = "ld", classNameSub = "ldRow";

/*----------------------------------------------------------------------------*/

function TriangleLattice(parentG, options)
{
  this.parentG = parentG;
  this.options = options;
}
function I(d) { return d; }
/** Add one <g> per name given in data.
 * Very similar to in-axis.js:group() (on which it was based); (maybe factorise ?)
 */
function  groups(g, groupClassNames)
  {
      let gs = g
        .selectAll("g > g")
        .data(groupClassNames),
      gsa = gs
        .enter()
        .append("g")
        .attr("class", I),
      resultG = gsa.merge(gs);
    return resultG;
};

function ldOfMarker(markerName, i, g)
{
  console.log("ldOfMarker", markerName, i, g);
  /** to be replaced by a triangular matrix of LD,
   * indexed by [markerName1, markerName2]. */
  let data = markerName.split("");
  return data;
}

/** width, height */
const cellSize = [15, 15];

function latticePositionX(d, i, g) { return i * cellSize[0]; }
function latticePositionY(d, i, g) { return i * cellSize[1]; }
function latticeCellWidth(d, i, g) { return cellSize[0]; }
function latticeCellHeight(d, i, g) { return cellSize[1]; }


/** Calculate (initial / default) thresholdValue so that the proportion of the
 * data which is > thresholdValue is thresholdProportion */
TriangleLattice.prototype.thresholdProportion =  0.5;
/**
 * @param draw  array of marker names
*/
TriangleLattice.prototype.draw =  function (data)
{
  let
    options = this.options,
    g = this.parentG
  // combine with margin translate ( in-axis)
  // also skew to adjust width
    .attr("transform", "rotate(45)"),
  // could change signature to .call(groups)
  gs = groups(g, data),
  rs = gs
    .selectAll("rect")
    .data(ldOfMarker),
  re =  rs.enter(), rx = rs.exit();
  let ra = re
    .append("rect");
  ra
    .attr("class", "ld")
  /*.each(configureChartHover)*/;
  ra
    .merge(rs)
    .transition().duration(1500)
    .attr("x", latticePositionX)
    .attr("y", latticePositionY)
    .attr("height", latticeCellHeight)
    .attr("width", latticeCellWidth);
  rx.remove();

}

/*----------------------------------------------------------------------------*/


/* global d3 */

export default InAxis.extend({


  didRender() {
    console.log("components/axis-ld didRender()");
  },

  redraw   : function(apID, t) {
    this.set('className', className);
    let data = className, // this.get(className),
    layoutAndDrawLd = this.get('layoutAndDrawLd');
    console.log("redraw", this, (data === undefined) || data.length, apID, t);
    if (data)
      layoutAndDrawLd.apply(this, [data]);
  },

  /** Convert input text to an array.
   * @param tableText text string, TSV, rows separated by \n and/or \r.
   * First row contains a header with column names; these are the marker names.  
   */
  parseTextData(tableText)
  {
    let values = d3.tsvParse(tableText);
    console.log("parseTextData values.length", values.length);
    return values;
  },


  layoutAndDrawLd(ld)
  {
    let
    oa = this.get('data'),
    axis= this.get("axis"),
    apID = this.parentView.axis.apID, // axis.
    /** first stage : all markers;  later  just the zoomed or brushed markers. */
    markerNames = d3.keys(oa.z[apID]),
    data = markerNames,
    margin = {top: 10, right: 20, bottom: 40, left: 20},
    ranges = this.getRanges(margin);
    console.log("layoutAndDrawLd", ld, oa, axis);
    let resizedWidth = this.get('width');
    if (resizedWidth)
      ranges.bbox.width = resizedWidth;

    let g = 
      this.commonFrame(ranges.gAxis, ranges),
    gl = this.group(g, "lattice"),
    l = new TriangleLattice(gl, ranges);
    l.draw(data);
  },


});
