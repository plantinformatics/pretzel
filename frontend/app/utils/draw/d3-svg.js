/*----------------------------------------------------------------------------*/

/** Used for d3 attributes whose value is the datum. */
function I(d) { /* console.log(this, d); */ return d; };
/* Usage e.g. (d3.selectAll().data(array) ... .text(I)
 * Moved here from draw-map.js;
 * The equivalent function is also defined in :
 *   components/axis-ld.js
 *   components/axis-tracks.js
 *   services/auth.js
 */

/*----------------------------------------------------------------------------*/

/**
 * Based on Dustin Larimer’s  http://bl.ocks.org/dustinlarimer/5888271
 */
let markerDefinitions = [
  { name: 'arrow',     path: 'M 0,0 m -5,-5 L 5,0 L -5,5 Z', size : 10, viewbox: '-5 -5 10 10',   fill: 'black' },
  { name: 'fat_arrow', path: 'M 0,0 m -5,-5 L 5,0 L -5,5 Z', size : 5,  viewbox: '-10 -10 20 20', fill : 'blue' }
];

/** Append <defs> to <svg>, with the definitions in markerDefinitions, e.g. an arrow.
 * No effect if this has already been done.
 * @param svg d3 selection of <svg> into which the <defs> should be appended.
 */
function ensureSvgDefs(svg)
{
  let defs = svg.selectAll('defs')
    .data([1])
    .enter()
    .append('svg:defs');

  var marker = defs.selectAll('marker')
    .data(markerDefinitions)
    .enter()
    .append('svg:marker')
    .attr('id', function(d){ return 'marker_' + d.name; })
    .attr('markerHeight', function(d){ return d.size; })
    .attr('markerWidth', function(d){ return d.size; })
    // .attr('markerUnits', 'userSpaceOnUse')  // default strokeWidth
    .attr('orient', 'auto')
    .attr('refX', 0)
    .attr('refY', 0)
    .attr('viewBox', function(d){ return d.viewbox; })
    .append('svg:path')
    .attr('d', function(d){ return d.path; })
    .attr('fill', function(d){ return d.fill; });

  return defs;
}

export { I, ensureSvgDefs };
