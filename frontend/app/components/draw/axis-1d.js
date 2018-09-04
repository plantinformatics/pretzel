import Ember from 'ember';

import { /* Block, Stacked, Stack,*/ stacks /*, xScaleExtend, axisRedrawText, axisId2Name*/ } from '../../utils/stacks';
import {  /* Axes, yAxisTextScale,  yAxisTicksScale,  yAxisBtnScale, yAxisTitleTransform, eltId,*/ axisEltId /*, eltIdAll, highlightId*/  }  from '../../utils/draw/axis';
import {DragTransition, dragTransitionTime, dragTransitionNew, dragTransition } from '../../utils/stacks-drag';


/* global d3 */


/*------------------------------------------------------------------------*/


/* showTickLocations() and configureHorizTickHover() are based on the
 * corresponding functions in draw-map.js
 * There is a lot of variation at all levels between this application and the
 * original - draft factoring (axisDomData.js) showed a blow-out of abstraction
 * and complexity even before all the differences were handled.
 */

const className = "horizTick";

/** filter : @return true if the given Block is configured to display ticks.
 * i.e. ! block.block.get('dataset').get('showPaths')
 */
function blockWithTicks(block)
{
  let showPaths = block.block.get('showPaths');
  // console.log('blockWithTicks', block.axisName, showPaths);
  return ! showPaths;
}


/** Draw horizontal ticks on the axes, at feature locations.
 * @param axis  Stacked
 * @param axisApi for lineHoriz
 */
function showTickLocations(axis, axisApi)
{
  let axisName = axis.axisName;

  let aS = d3.select("#" + axisEltId(axisName));
  if (!aS.empty())
  {

    let blocks = axis.blocks.filter(blockWithTicks);
    blocks.forEach(function (block) {
      let blockR = block.block,
      blockId = blockR.get('id'),
      features = blockR.get('features').toArray();

      let pS = aS.selectAll("path." + className)
        .data(features),
      pSE = pS.enter()
        .append("path")
        .attr("class", className);
      pSE
        .each(function (d) { return configureHorizTickHover.apply(this, [d, block, hoverTextFn]); });
      let pSM = pSE.merge(pS);

      /* update attr d in a transition if one was given.  */
      let p1 = // (t === undefined) ? pSM :
         pSM.transition()
         .duration(dragTransitionTime)
         .ease(d3.easeCubic);

      p1.attr("d", pathFn);

    });

  }

  function pathFn (feature) {
    // based on axisFeatureTick(ai, d)
    /** shiftRight moves right end of tick out of axis zone, so it can
     * receive hover events.
     */
    const xOffset = 25, shiftRight=5;
    let ak = axisName,
    value = feature.get('value'),
    tickY = value && value.length && value[0],
    sLine = axisApi.lineHoriz(ak, tickY, xOffset, shiftRight);
    return sLine;
  };

  /** eg: "scaffold23432:1A:1-534243" */
  function hoverTextFn (feature, block) {
    let
    value = feature.get('value'),
    range = value && (value.length ? ('' + value[0] + ' - ' + value[1]) : value),
    blockR = block.block,
    // feature.get('name') 
    blockDesc = blockR && (blockR.get('name') + " : " + blockR.get('scope')),
    text = blockDesc + " : " + range;
    return text;
  }
  // the code corresponding to hoverTextFn in the original is :
  // (location == "string") ? location :  "" + location;

}

/** Setup hover info text over scaffold horizTick-s.
 * @see based on similar configureAxisTitleMenu()
 */
function  configureHorizTickHover(d, block, hoverTextFn)
{
  // console.log("configureHorizTickHover", d, this, this.outerHTML);
  let text = hoverTextFn(d, block);
  let node_ = this;
  Ember.$(node_)
    .popover({
      trigger : "click hover",
      sticky: true,
      delay: {show: 200, hide: 3000},
      container: 'div#holder',
      placement : "auto right",
      // comment re. title versus content in @see draw-map.js: configureHorizTickHover() 
      content : text
    });
}

export default Ember.Component.extend({

  didInsertElement : function() {
  },
  didRender() {
    let block = this.get('axis'), blockId = block.get('id');
    let axisApi = this.get('drawMap.oa.axisApi');
    let oa = this.get('drawMap.oa');
    let axis = oa.axes[blockId];
    // console.log('axis-1d didRender', block, blockId, axis);

    showTickLocations(axis, axisApi);
  }


  
});

