import InAxis from './in-axis';

const className = "ld", classNameSub = "ldRow";

/*----------------------------------------------------------------------------*/

function TriangleLattice(parentG, options, domain)
{
  this.parentG = parentG;
  this.options = options;

  let
  colorScale = d3.scaleLinear().domain(domain)
    .interpolate(d3.interpolateHcl)
    .range([d3.rgb("#007AFF"), d3.rgb('#FFF500')]);
  this.colorScale = colorScale;
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
}

function ldOfFeature(featureName, i, g)
{
  console.log("ldOfFeature", featureName, i, g);
  /** to be replaced by a triangular matrix of LD,
   * indexed by [featureName1, featureName2]. */
  let values = featureName.split(""),
  data = [];
  for (let j = 0; j <= i; j++)
  {
    let value = values[j].charCodeAt(0);
    data.push({parentIndex : i, value : value});
  }
  return data;
}

/** width, height */
const cellSize = [15, 15];

function latticePositionX(d, i, g) { return d.parentIndex * cellSize[0]; }
function latticePositionY(d, i, g) { return i * cellSize[1]; }
function latticeCellWidth(d, i, g) { return cellSize[0]; }
function latticeCellHeight(d, i, g) { return cellSize[1]; }


/** Calculate (initial / default) thresholdValue so that the proportion of the
 * data which is > thresholdValue is thresholdProportion */
TriangleLattice.prototype.thresholdProportion =  0.5;
TriangleLattice.prototype.cellColor =
  function() {
    let me = this;
    return function (d, i, g)
    {
      let color = me.colorScale(d.value);
      return color;
    };
  };

/**
 * @param draw  array of feature names
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
    .data(ldOfFeature),
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
    .attr("width", latticeCellWidth)
    .attr("fill", this.cellColor())
  ;
  rx.remove();

}

/*----------------------------------------------------------------------------*/


/* global d3 */

export default InAxis.extend({


  /*
  didRender() {
    this._super.apply(this, arguments);
    console.log("components/axis-ld didRender()");
  },
  */

  redraw   : function(axisID, t) {
    this.set('className', className);
    let data = className, // this.get(className),
    layoutAndDrawLd = this.get('layoutAndDrawLd');
    console.log("redraw", this, (data === undefined) || data.length, axisID, t);
    if (data)
      layoutAndDrawLd.apply(this, [data]);
  },

  /** Convert input text to an array.
   * @param tableText text string, TSV, rows separated by \n and/or \r.
   * First row contains a header with column names; these are the feature names.  
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
    axisID = this.parentView.axis.axisID, // axis.
    /** first stage : all features;  later  just the zoomed or brushed features. */
    featureNames = d3.keys(oa.z[axisID]),
    data = featureNames,
    margin = {top: 110, right: 20, bottom: 40, left: 20},
    ranges = this.getRanges(margin);
    console.log("layoutAndDrawLd", ld, oa, axis);
    let resizedWidth = this.get('width');
    if (resizedWidth)
      ranges.bbox.width = resizedWidth;

    let g = 
      this.commonFrame(ranges.gAxis, ranges),
    gl = this.group(g, "lattice"),
    domain = [' '.charCodeAt(0), 'z'.charCodeAt(0)],
    l = new TriangleLattice(gl, ranges, domain);
    l.draw(data);
    this.set('lattice', l);
  },


});
