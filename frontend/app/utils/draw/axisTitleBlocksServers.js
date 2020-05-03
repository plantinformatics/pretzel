import Ember from 'ember';
import { inject as service } from '@ember/service';


import { lookupService } from '../configuration';
import { dragTransitionTime } from '../stacks-drag';

/* global d3 */

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** access service to map server name to colour. */
let apiServers;

/** copied from draw-map */
/** font-size of y axis ticks */
const axisFontSize = 12;

/*----------------------------------------------------------------------------*/

/** Contain functions which implement the display of a circle for each block in
 * the axis title, using colour to identify the server (store) of the block.
 *
 * This is just a namespace so far - no state.
 * Can be moved to become a part of a axis title component, or used as a library.
 * related : ./axisTitleLayout.js
 */
class AxisTitleBlocksServers {
  // perhaps add construct (svgContainer, axisTitleLayout) ...

};
let axisTitleLayout;

/** if multiple api-servers, show a colour circle to indicate the server of the block.
 *
 * @param axisTitleS  selection of title <text> for a number of axis (may be 1) -  g.axis-all > text.
 * if undefined, default is svgContainer.selectAll("g.axis-all > text")
 */
AxisTitleBlocksServers.prototype.render = function (axisTitleS, svgContainer, axisTitleLayout_, thisObject) {
  if (! axisTitleS)
    axisTitleS = svgContainer.selectAll("g.axis-all");
  if (! axisTitleLayout) axisTitleLayout = axisTitleLayout_;
  if (thisObject && ! apiServers) {
    apiServers = lookupService(thisObject, "service:api-servers");
  }

  let
    /** go up one level to add <g.titleServers> to the <g.axis-all>,
     * i.e. sibling to <text>, which can only contain <tspan>.
     */
    pg = d3.selectAll(axisTitleS.nodes().mapBy('parentElement')),
  gS = pg.selectAll('g.servers')
  // only draw AxisTitleBlocksServers if there is >1 server
    .data(apiServers.serversLength < 2 ? [] : axisTitleS.data()),
  gA = gS.enter()
    .append('g')
    .attr('class', 'servers'),
  gX = gS.exit().remove(),
  gM = gS.merge(gA);

  let
    aS = pg, // d3.selectAll('g.axis-all'),
  cS = AxisTitleBlocksServers.prototype.select(axisTitleS);
  dLog('AxisTitleBlocksServers cS.data()', cS.data().mapBy('__data__'), cS.enter().data());

  let
    /* cS = gM.selectAll('circle')
     .data(axisName2Blocks, (block) => block.getId()), */
    /** set in css : r, stroke-width */
    cE = cS
    .enter()
    .append('circle')
  // class server of <circle> is not currently required, could be added.
  // .attr('class', 'server')
  // tspan.__data__ is (stacks.js:) Block
    .attr('id', (tspan) => 'atss-' + tspan.__data__.getId())
    .attr("class", (tspan) => tspan.__data__.block.store.name)
    .attr('stroke', (tspan) => apiServers.lookupServerName(tspan.__data__.block.store.name).get('colour'))
  ;
  cS.exit().remove();
  let cM =
    cE.merge(cS)
  // equiv in <tspan> : .text("\u25CF") // solid circle. https://www.fileformat.info/info/unicode/char/25cf/index.htm
    .style('fill', (tspan) => tspan.__data__.axisTitleColour()) // block.store.name ordinal category scale
    .each(positionToTextBBox)
  ;
  /* text is positioned by updateAxisTitleSize() using a transition with
   * .duration(dragTransitionTime), so probably bbox updates after that, so
   * recalc after a delay.
   */
  Ember.run.later(() => cM.each(positionToTextBBox), dragTransitionTime + 100);

};

AxisTitleBlocksServers.prototype.select = function (axisTitleS, svgContainer)
{
  if (! axisTitleS)
    axisTitleS = svgContainer.selectAll("g.axis-all");
  else if (axisTitleS.selection) {
    axisTitleS = axisTitleS.selection();
  }
  let
    pg = d3.selectAll(axisTitleS.nodes().mapBy('parentElement')),
  t2 = pg.selectAll('g.axis-all > text > tspan'),
  b = d3.selectAll(t2._parents),
  t2g = t2._groups.map((n) => Array.from(n)).flat(),
  cS = b.selectAll('g.axis-all > g.servers')
    .data(pg.data())
    .selectAll('g.servers > circle')  // .server
    .data(t2g) // tried : (d,i) => t2._groups[i]
  ;
  return cS;
};
/** Position the circle left of the axis title text.
 * @param tspan corresponding block name text <tspan>
 * @param i index of block name within axis title
 * @desc called with d3 signature (d, i, g) this is DOM element.
 */
function positionToTextBBox(tspan, i) {
  /** currently chromium returns the bbox of the parent <text>, not the <tspan>,
   * so calculate cy by offsetting proportional to i.
   * refn : https://bugs.chromium.org/p/chromium/issues/detail?id=349835
   * https://stackoverflow.com/questions/22218456/how-to-get-the-position-and-width-of-a-tspan-element
   *
   * Using the bbox of the parent text means the circles are aligned vertically,
   * which is probably better.
   * Part of the motive for using <tspan> as the data of <circle> was to enable access
   * to the bbox of each <tspan>;  it would be sufficient instead to enclose
   * <text> with this function, which might have avoid the complexity of
   * .select().
   * The tspan reference is also used to lookup the server (store) name.
   */
  let bbox = tspan.getBBox();
  d3.select(this)
    .transition().duration(dragTransitionTime / 2)
    .attr('cx', bbox.x - (axisTitleLayout.verticalTitle ? 60 : 15))
    .attr('cy', bbox.y  + i * 1.5 * axisFontSize);
}

AxisTitleBlocksServers.prototype.position =     function(axisTitleS, svgContainer, axisTitleLayout_) {
  if (! axisTitleLayout) axisTitleLayout = axisTitleLayout_;
  let cS = AxisTitleBlocksServers.prototype.select(axisTitleS, svgContainer);
  cS.each(positionToTextBBox);
};

export { AxisTitleBlocksServers };
