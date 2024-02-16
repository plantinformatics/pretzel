
// const d3 = await import("d3");

/** from 83655c77 2019Jan06
(replace-regexp ".*\\('d3-.+'\\);" "  \\1,")
 */
const d3Packages = [
  'd3-array',
  'd3-axis',
  'd3-brush',
  'd3-chord',
  'd3-collection',
  'd3-color',
  'd3-contour',
  'd3-dispatch',
  'd3-drag',
  'd3-dsv',
  'd3-ease',
  'd3-fetch',
  'd3-force',
  'd3-format',
  'd3-geo',
  'd3-hierarchy',
  'd3-interpolate',
  'd3-path',
  'd3-polygon',
  'd3-quadtree',
  'd3-random',
  'd3-scale',
  'd3-scale-chromatic',
  'd3-selection',
  'd3-selection-multi',
  'd3-shape',
  'd3-time',
  'd3-time-format',
  'd3-timer',
  'd3-tip',
  'd3-transition',
  'd3-voronoi',
  'd3-zoom',
];

/*
const packagesP = d3Packages.map(import);
const d3 = await Promise.all(packagesP).then(d3 => Object.assign({}, ...d3));
*/

export { d3Packages };

// (replace-regexp "^\+" "")

// (replace-regexp "^  \\(d3-.+\\)," "import * as \\1 from '\\1';")
// (replace-string " d3-" " d3_")
/*
import * as d3_array from 'd3-array';
import * as d3_axis from 'd3-axis';
import * as d3_brush from 'd3-brush';
import * as d3_chord from 'd3-chord';
import * as d3_collection from 'd3-collection';
import * as d3_color from 'd3-color';
import * as d3_contour from 'd3-contour';
import * as d3_dispatch from 'd3-dispatch';
import * as d3_drag from 'd3-drag';
import * as d3_dsv from 'd3-dsv';
import * as d3_ease from 'd3-ease';
import * as d3_fetch from 'd3-fetch';
import * as d3_force from 'd3-force';
import * as d3_format from 'd3-format';
import * as d3_geo from 'd3-geo';
import * as d3_hierarchy from 'd3-hierarchy';
import * as d3_interpolate from 'd3-interpolate';
import * as d3_path from 'd3-path';
import * as d3_polygon from 'd3-polygon';
import * as d3_quadtree from 'd3-quadtree';
import * as d3_random from 'd3-random';
import * as d3_scale from 'd3-scale';
import * as d3_scale_chromatic from 'd3-scale-chromatic';
import * as d3_selection from 'd3-selection';
  // d3_selection-multi,
import * as d3_shape from 'd3-shape';
import * as d3_time from 'd3-time';
import * as d3_time_format from 'd3-time-format';
import * as d3_timer from 'd3-timer';
import * as d3_tip from 'd3-tip';
import * as d3_transition from 'd3-transition';
import * as d3_voronoi from 'd3-voronoi';
import * as d3_zoom from 'd3-zoom';
*/

// console.log('d3_array', d3_array);

/* global require */
// var d3 = require("d3");
  // (replace-regexp "require(\"\\(.+\\)\")" "\\1")
  // (replace-string "  d3-" "  d3_")
/*
var d3 = Object.assign(
  {},
  d3_array,
  d3_axis,
  d3_brush,
  d3_chord,
  d3_collection,
  d3_color,
  d3_contour,
  d3_dispatch,
  d3_drag,
  d3_dsv,
  d3_ease,
  d3_fetch,
  d3_force,
  d3_format,
  d3_geo,
  d3_hierarchy,
  d3_interpolate,
  d3_path,
  d3_polygon,
  d3_quadtree,
  d3_random,
  d3_scale,
  d3_scale_chromatic,
  d3_selection,
  // d3-selection-multi,
  d3_shape,
  d3_time,
  d3_time_format,
  d3_timer,
  d3_tip,
  d3_transition,
  d3_voronoi,
  d3_zoom
);
*/

// import d3 from 'd3';
import * as d3 from 'd3';

if (! window.d3) {
  window.d3 = d3;
  console.log('d3-initialise-global.js', 'app.js', d3);
} else {
  Object.assign(window.d3, d3);
}
if (! d3.divgrid && window.d3_divgrid) {
  d3.divgrid = window.d3_divgrid;
  console.log('d3_divgrid', window.d3_divgrid);
}
