/*global d3 */

/*----------------------------------------------------------------------------*/
/** Define a d3 scale, similar to d3.scalePoint and d3.scaleBand,
 * with variable bandwidth.
* The bandwidths are defined by calling widths().
*  
*/

/* based on the framework from d3-scale/src/band.js */

function variableBands() {
  var scale = d3.scalePoint(),
   combinedScale = CombinedScale,

      widths = [],
      count = 0, widthSum = 0,
      widthOffsets,

      domain = scale.domain,
      ordinalRange = scale.range,

      trace_scale = false;

  function rescale() {
    /* widths[] are measured in the range space (pixels),
     * so calculate space between (axis) widths.
     */
    widthOffsets = widths.map(
      function(width)
      {
        count++;
        let widthSumPrev = widthSum;
        widthSum += width;
        return widthSumPrev;
      }
    );

    if (trace_scale)
    console.log("variableBands rescale", widthOffsets, count, widthSum);

    return combinedScale;
  }

  function CombinedScale(x) {
    /** assuming here that domain is [0 .. n-1], which is correct in stacks.js, but
     * for other uses, could index widthOffsets[] with domain values. */
    let scaleX = scale(x),
    widthOffsetX = widthOffsets[x], // could do : || 0
    scaled = scaleX !== undefined && widthOffsetX !== undefined ? scaleX + widthOffsetX : undefined; 
    if (trace_scale)
      console.log("CombinedScale(", x, ")", scaleX, widthOffsetX, scaled);
    return scaled; 
  }

  scale.widths = function(_) {
    if (trace_scale)
      console.log("scale.widths", _);
    return arguments.length ? (widths = _, rescale()) : widths.slice();
  };

  combinedScale.scale = scale;

  combinedScale.domain =
    function (_) {
      return arguments.length
        ? ( console.log("combinedScale.domain", _), scale.domain(_))
        : scale.domain(); };

  combinedScale.range =
    function(_) {
      return arguments.length
        ? ( console.log("combinedScale.range", _), scale.range(_))
        : scale.range();
    };

  combinedScale.rangeRound = scale.rangeRound;
  combinedScale.bandwidth = scale.bandwidth;
  combinedScale.step = scale.step;
  combinedScale.round = scale.round;
  combinedScale.padding = scale.padding;
  combinedScale.paddingInner = scale.paddingInner;
  combinedScale.paddingOuter = scale.paddingOuter;
  combinedScale.align = scale.align;

  return rescale();
}


export { variableBands };
