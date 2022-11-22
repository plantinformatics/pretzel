import {
  bind,
} from '@ember/runloop';

//------------------------------------------------------------------------------

/* global d3 */

//------------------------------------------------------------------------------

import {
  yAxisTitleTransform,
}  from './axis';

import {
  Stacked,
  Block,
  stacks,
} from '../stacks';

import {
  dragTransitionTime,
} from '../stacks-drag';


import { AxisTitleBlocksServers } from './axisTitleBlocksServers_tspan';
import { axisFontSize, AxisTitleLayout } from './axisTitleLayout';


//------------------------------------------------------------------------------

/** enable display of multiple lines in axis title : for each data block :
 * name, block colour, feature counts, server colour; this is moving into axis
 * menu, replacing utils/draw/axisTitleBlocksServers{,_tspan}.js.
 * in commits be2660da .. 221f86fa.
 */
const axisTitle_dataBlocks = false;

//------------------------------------------------------------------------------

function AxisTitle(oa) {
  const result = {
    // axisTitle,
    axisTitleFamily,
    axisName2Blocks,
    updateAxisTitles,
    updateAxisTitleSize,
    
  };

  function axisTitle(chrID)
  {
    let cn=oa.
      cmName[chrID];
    // console.log(".axis text", chrID, cn);
    return cn.mapName + " " + cn.chrName;
  }


  /** true if any axes have children.  used to get extra Y space at top for multi-level axis title.
   * later can calculate this, roughly : oa.stacks.axesP.reduce(function (haveChildren, a) { return haveChildren || oa.stacks.axesP[a].blocks.length; } )
   * The maximum value of that can be used as the value of Viewport:calc(): axisNameRows.
   */
  let someAxesHaveChildBlocks = true;

  /** Update the axis title, including the block sub-titles.
   * If ! axisTitle_dataBlocks, don't show the data block sub-titles, only the first line;
   * this is selected in axisName2Blocks().
   *
   * From the number of block sub-titles, calculate 'y' : move title up to
   * allow for more block sub-titles.
   * Create / update a <tspan> for each block, including the parent / reference block.
   * Configure a hover menu for each <tspan>, either axis (parent) or subtitle (data block).
   *
   * @param axisTitleS  d3 selection of the <text> within g.axis-all
   * In usage, axisTitleS is a selection of either a single axis, or all axes.
   */
  function axisTitleFamily(axisTitleS) {
    if (axisTitle_dataBlocks) {
      axisTitleS
      // .text(axisTitle /*String*/)
      // shift upwards if >1 line of text
        .each(function (d) {
          let axis = Stacked.getAxis(d),
          length = axis && axis.blocks.length;
          if (length && length > 1)
          {
            /** -2 * axisFontSize is the default for a single row. */
            let y = '-' + (length+1) * (1.3 * axisFontSize);
            d3.select(this)
              .attr('y', y + 'px');
          }
        })
      ;
    }


    const me = oa.eventBus;
    let apiServers = me.get('apiServers');
    const axisApi = oa.axisApi;
    let axisTitleBlocksServers = new AxisTitleBlocksServers(oa.svgContainer, oa.axisTitleLayout, apiServers);
    let subTitleS =
      axisTitleS.selectAll("tspan.blockTitle")
    /** @return type Block[]. blocks of axisName.
     * first block is parent, remainder are data (non-reference) */
      .data(axisName2Blocks, (block) => block.getId()),
    subTitleE = subTitleS
      .enter()
      .append("tspan")
      .attr('class', 'blockTitle');
    if (axisTitle_dataBlocks) {
      subTitleE.each(AxisTitleBlocksServers.prototype.prependTspan);
    }
    subTitleS.exit()
      // .each(AxisTitleBlocksServers.prototype.remove1)  // enable if axisTitle_dataBlocks
      .remove();
    let subTitleM =
    subTitleE.merge(subTitleS)
      .text(function (block) { return block.titleText(); })
      .attr('x', '0px')
      /* The tspan.blockServer is only displayed when there are multiple api servers.
       * If the tspan.blockServer was not rendered, then this (tspan.blockTitle) should have the dy.
       * It is simpler to hide/show tspan.blockServer with css rather than
       * re-render when the number of api servers changes, but to produce a
       * clean svg export for publication it may be worth doing that.
       * .attr('dy',  function (d, i) { return "" + (i ? 1.5 : 0)  + "em"; })
       */
      .style('stroke', Block.axisTitleColour)
      .style('fill', Block.axisTitleColour)
      .style('opacity', function (block, i) { return (i > 0) && ! block.visible ? 0.5 : undefined; } )
      .each(configureAxisTitleMenus)
    ;
    function configureAxisTitleMenus(block, i) {
      /** until ae114cf5, distinct menus were offered for the reference
       * block (first line of title) and the data blocks (subsequent lines).
       * Now each line has onclick for the same menu (showMenu -> axis-menu).
       * So this could be changed to use a single listener, on the parent <text>.
       */
      let menuFn = true // (i == 0)
        ? axisApi.configureAxisTitleMenu
        : axisApi.configureAxisSubTitleMenu;
      menuFn.apply(this, arguments);
    }

    if (axisTitle_dataBlocks) {
      axisTitleS.call(AxisTitleBlocksServers.prototype.render.bind(axisTitleBlocksServers));
    }
  };

  function axisName2Blocks (axisName) {
    let axis = Stacked.getAxis(axisName);
    // equiv : axis.children(true, false)
    return axis ? (axisTitle_dataBlocks ? axis.blocks : [axis.blocks[0]]) : [];
  }


  function updateAxisTitles()
  {
    let axisTitleS = oa.svgContainer.selectAll("g.axis-all > text");
    axisTitleFamily(axisTitleS);
  }

  /** Called when the width available to each axis changes,
   * i.e. when collateO() is called.
   * Calculate the size and layout of axis titles.
   * Based on that layout, apply text-anchor and transform to the <text>,
   * and adjust svg viewBox and padding-top.
   * @param axisTitleS  d3 selection of g.axis-all, for one or more axes;
   * if undefined then g.axis-all is selected for all axes.
   */
  function updateAxisTitleSize(axisTitleS)
  {
    if (! stacks.length)
      return;
    if (! axisTitleS)
      axisTitleS = oa.svgContainer.selectAll("g.axis-all")
      .transition().duration(dragTransitionTime)
    ;

    oa.vc.calc(oa);
    const vc = oa.vc;
    // vc.calc() calculates .axisXRange, which is used here.
    console.log('vc.axisXRange', vc.axisXRange, axisTitleS.nodes(), stacks.length);
    let axisXRange = vc.axisXRange;
    /** axisXRange[] already allows for 1/2 title space either side, so use length-1.
     * stacks.length is > 0 here */
    let nStackAdjs = stacks.length > 1 ? stacks.length-1 : 1;
    let axisSpacing = (axisXRange[1]-axisXRange[0])/nStackAdjs;
    let titleLength = Block.titleTextMax(),
    /** char width in px, ie. convert em to px.  Approx -	better to measure this. */
    em2Px = 7,
    titlePx = titleLength ? titleLength * em2Px : 0;
    let titleText = vc.titleText || (vc.titleText = {});

    oa.vc.axisHeaderTextLen = titlePx;
    oa.axisTitleLayout.calc(axisSpacing, titlePx);


    // applied to all axes consistently, not just appended axis.
    // Update elements' class and transform when verticalTitle changes value.

    // also incorporate extendedWidth() / getAxisExtendedWidth() in the
    // calculation, perhaps integrated in xScaleExtend()
    let axisTitleA =
      axisTitleS.selectAll("g.axis-all > text");
    axisTitleA
      // this attr does not change, can be done for just axisG
      .style("text-anchor", oa.axisTitleLayout.verticalTitle ? "start" : undefined)
      .attr("transform", yAxisTitleTransform(oa.axisTitleLayout));

    let t =
    oa.svgRoot
      .transition().duration(dragTransitionTime)
      .attr("viewBox", oa.vc.viewBox.bind(oa.vc))
    ;

    if (axisTitle_dataBlocks) {
      const me = oa.eventBus;
      let axisTitleBlocksServers = new AxisTitleBlocksServers(oa.svgContainer, oa.axisTitleLayout, me.get('apiServers'));
      t.on('end', () => axisTitleBlocksServers.position(axisTitleS));
    }

    /** showZoomResetButtonXPosn() is called in axis-1d and axis-2d,
     * ideally the call will be only in axis-1d, but for now this
     * picks up some cases not covered.  */
    let 
    axisIds = axisTitleS.nodes().mapBy('__data__'),
    axes1 = axisIds.map((axisId) => oa.axes[axisId]);
    axes1.forEach(
      (a) => a && a.axis1d && bind(a.axis1d, a.axis1d.showZoomResetButtonXPosn)());
  }

  return result;
}

//------------------------------------------------------------------------------

export {
  AxisTitle,
};
