import { inject as service } from '@ember/service';


import { lookupService } from '../configuration';
import { dragTransitionTime } from '../stacks-drag';

/* global d3 */

const dLog = console.debug;

const trace = 0;

/*----------------------------------------------------------------------------*/

const tspanBlockServer_local = d3.local('tspanBlockServer');

/*----------------------------------------------------------------------------*/

/** copied from draw-map */
/** font-size of y axis ticks */
const axisFontSize = 12;

class AxisTitleBlocksServers {
  /** So far this object is just a closure to hold these 2 parameters,
   * but it can transition to a Component, after upgrading to Ember 3.
   */
  constructor (svgContainer, axisTitleLayout, apiServers) {
    this.svgContainer = svgContainer;
    this.axisTitleLayout = axisTitleLayout;
    this.apiServers = apiServers;
  }

}

/** if multiple api-servers, show a colour circle to indicate the server of the block.
 *
 * The fixed part of the render is already handled in prependTspan() / remove1(),
 * because it is easy to use .enter().append().each() and .exit().each().
 * This function handles updates.
 *
 * @param axisTitleS  selection of title <text> for a number of axis (may be 1) -  g.axis-all > text.
 * if undefined, default is svgContainer.selectAll("g.axis-all > text")
 */
AxisTitleBlocksServers.prototype.render = function (axisTitleS) {
  let 
    /** only render <tspan.blockServer> if there is >1 server */
    multipleServers = this.apiServers.get('serversLength') > 1,

  /** a row consists of : [ <tspan.blockServer> (optional)] <tspan.blockTitle>
   * The first <tspan> in each row requires a dy.
   */
  dySel = ['tspan.blockTitle', 'tspan.blockServer'],
  /** tspan.blockServer are displayed with font-size : 2em, so divide 1.5em / 2 in that case.
   */
  fontSizeFactor = [1, 2];
  /* use + to map multipleServers -> [0, 1].
   */
  axisTitleS.selectAll(dySel[+multipleServers])
    .attr('dy',  function (d, i) { return "" + (i ? 1.5/fontSizeFactor[+multipleServers] : 0)  + "em"; });
  axisTitleS.selectAll(dySel[+!multipleServers])
    .attr('dy',  undefined);

  axisTitleS.selectAll('tspan.blockServer')
    .style('fill', (d) => this.apiServers.lookupServerName(d.__data__.block.store.name).get('colour'))
    .attr('x', this.positionDig())
  ;

};


/**
 *
 * @param axisTitleS  selection of title <text> for a number of axes (may be 1) -  g.axis-all > text.
 * if undefined, default is svgContainer.selectAll("g.axis-all > text")
*/
AxisTitleBlocksServers.prototype.select = function (axisTitleS)
{
  if (! axisTitleS)
    axisTitleS = this.svgContainer.selectAll("g.axis-all > text");
  // if transition, convert to selection.
  else if (axisTitleS.selection) {
    axisTitleS = axisTitleS.selection();
  }

  let s = axisTitleS.selectAll('text > tspan.blockServer');

  return s;
};



/** Geneate a tspan for the given data, either a circle with colour to
 * identify the server (.blockServer), or the blockId text (.blockTitle).
 * @param block a (stacks) Block.
 * @param this  <tspan.blockTitle>
 * @desc calling signature is d3
 */
AxisTitleBlocksServers.prototype.prependTspan = function(block, i) {
  let
    tspanBlockTitle = this,
  elt = document.createElementNS("http://www.w3.org/2000/svg", 'tspan');
  elt.classList.add('blockServer');
  // solid circle. https://www.fileformat.info/info/unicode/char/25cf/index.htm
  elt.textContent = "\u25CF";
  tspanBlockTitle.insertAdjacentElement('beforeBegin', elt);
  // .insertAdjacentHTML('beforeBegin', '<tspan class="blockServer">\u25CF</tspan>');
  d3.select(elt)
    .datum(tspanBlockTitle)
  ;
  /** back-reference for .remove() */
  tspanBlockServer_local.set(tspanBlockTitle, elt);
  dLog('prependTspan', elt, this, block);
  return elt;
};

AxisTitleBlocksServers.prototype.positionTspan = function(tspanBlockTitle, elt) {
  let
  blockS = tspanBlockTitle .__data__;
  /* if block is unviewed, and this function is called before blockS is
   * destroyed (planning to change so blockS only exists while block.isViewed),
   * then blockS.axis can be undefined. */
  if (! blockS.axis) {
    return undefined;
  }
  let
  /** stackIndex > 0 corresponds to class .not_top on g.axis-outer */
  not_top = blockS.axis.stack.findIndex(blockS.axis.axisName) > 0,
  /** many cases, specified in app.scss, e.g .axis-outer.rightmost:not(.extended).not_top
   * So instead of using verticalTitle and not_top, look up the computed css value.
   */
  computedStyle = window.getComputedStyle(elt.parentElement),
  textAnchor = computedStyle.textAnchor,
  /** text-anchor is either start, end or middle.  */
  // textAnchorMiddle = ! this.axisTitleLayout.verticalTitle || not_top,
  titleLength = tspanBlockTitle.getComputedTextLength(),
  /* offset circle x by 1/2 title length if text-anchor: middle */ 
  position = 
    textAnchor === 'middle' ? -15 - titleLength / 2 :
    textAnchor === 'start' ? -15 :
    textAnchor === 'end' ? - 15 - titleLength :
    undefined;
  if (trace)
    dLog('positionTspan', position, textAnchor, titleLength, tspanBlockTitle.__data__, tspanBlockTitle, elt, this);
  return position;
};

/** Call positionTspan(), wrapped with a d3 calling signature.
 */
AxisTitleBlocksServers.prototype.positionDig = function() {
  let me = this;
  return function(d, i, g) {
    return me.positionTspan(d, this);
  };
};


AxisTitleBlocksServers.prototype.position =     function(event, axisTitleS) {
  /** circle select - the text in the tspan is a unicode circle */
  let cS = AxisTitleBlocksServers.prototype.select(axisTitleS);
  cS
    .attr('x', this.positionDig());
};


/** called when removing a <tspan.blockTitle>
 * Remove the corresponding <tspan.blockServer>
 * @param this  <tspan.blockTitle>
 * Called from d3.each().
 */
AxisTitleBlocksServers.prototype.remove1 = function () {
  let tbs = tspanBlockServer_local.get(this);
  dLog('remove left sibling', tbs, this);
  d3.select(tbs).remove();
};


export { AxisTitleBlocksServers };


  
