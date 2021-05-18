/*----------------------------------------------------------------------------*/

const trace = 0;

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

/** Ensure that g.groupName exists within parentG, and return a d3 selection of it.
 *
 * @param parentG d3 selection of <g> to contain added g.groupName
 * @param data for the created g(s). if undefined, inherit parentG.data()
 *
 * similar / related : 
 *   components/in-axis.js : group()
 *   components/draw/block-adj.js : drawGroup()
 *   utils/draw/chart1.js : Chart1.prototype.group()
 */
function selectGroup(parentG, groupName, data, keyFn, idFn, extraClassNames) {
  data ||= parentG.data();
  let classSelector = groupName,
      classNames = groupName;
  if (extraClassNames && extraClassNames.length) {
    classSelector += '.' + extraClassNames.join('.');
    classNames += ' ' + extraClassNames.join(' ');
  }
  /** based on in-axis.js : group() and axis-1d : showTickLocations(). */
  let
  gS = parentG
    .selectAll('g > g.' + classSelector)
    .data(data, keyFn),
  gSE = gS
    .enter()
    .append('g')
    .attr('class', classNames),
  resultG = gSE.merge(gS);
  if (idFn) {
    gSE.attr('id', idFn);
  }
  gS.exit().remove();
  return resultG;
};

/*----------------------------------------------------------------------------*/

/** based on draw/block-adj.js : pathPosition() 
 * Note comments there re. upgrade to d3 v4.
 */
function transitionEndPromise(transition) {
  let
  transitionEnd =
    new Promise(function(resolve, reject){
      transition
        .on('end', (d) => resolve(d))
        .on('interrupt', (d, i, g) => {
          resolve(d);
          if (trace > 2) {
            dLog('interrupt', d, i, g);
          };
        });
      // also handle 'cancel', when version update
    });
  return transitionEnd;
}


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

/*----------------------------------------------------------------------------*/

export { I, selectGroup, transitionEndPromise, ensureSvgDefs };
