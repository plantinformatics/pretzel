import {
  later,
  bind,
} from '@ember/runloop';


//------------------------------------------------------------------------------

/* global d3 */

//------------------------------------------------------------------------------

import config from '../../config/environment';

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

const trace = 0;

const dLog = console.debug;

//------------------------------------------------------------------------------

function AxisTitle(oa) {
  const result = {
    // axisTitle,
    axisTitleFamily,
    axis1d2BlockViews,
    updateAxisTitles,
    updateAxisTitleSize,
    
  };

  /** not used */
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
   * this is selected in axis1d2BlockViews().
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
        .each(function (axis1d) {
          const
          length = axis1d.viewedBlocks.length;
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
    const
    subTitleS =
      axisTitleS.selectAll("tspan.blockTitle")
    /** @return type Block[]. blocks of axisName.
     * first block is parent, remainder are data (non-reference) */
      .data(axis1d2BlockViews, (block) => block.getId()),
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
    const
    subTitleM =
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
       *
       * configureAxisTitleMenu() and configureAxisSubTitleMenu() implemented
       * the axis title menu via (Bootstrap) .popover(); this was replaced by
       * components/draw/axis-menu.{js,hbs} in c4a39538..cb6c75b5 and the
       * popover configuration is dropped after bf4ceded.
       */
      let
      menuFn = configureAxisTitleMenu;
      menuFn.apply(this, arguments);
    }

    if (axisTitle_dataBlocks) {
      axisTitleS.call(AxisTitleBlocksServers.prototype.render.bind(axisTitleBlocksServers));
    }
  };

  //----------------------------------------------------------------------------

  /** Setup click action to show Axis title menu.
   * @see based on similar configurejQueryTooltip()
   */
  function  configureAxisTitleMenu(block) {
    const me = oa.eventBus;
    let options = me.get('urlOptions'),
    /** the __data__ of the element triggering the menu was axisName, but is
     * now block; the axis and stack lookups below could now go more directly
     * via block. */
    axisName = block.axisName,
    /** PerpendicularAxis */
    dotPlot = options && options.dotPlot,
    /** The first stage of split axes is enabled by options.splitAxes1,
     * the remainder by options.splitAxes.
     * In development, splitAxes1 is enabled by default; in production it is disabled by default. 
     */
    splitAxes1 = options && options.splitAxes1 || (config.environment !== 'production');
    if (trace)
    console.log("configureAxisTitleMenu", axisName, this, this.outerHTML);
      let node_ = this;
      let showMenuFn = me.functionHandle('showMenu', showMenu);
    /** originally used hover event, showing .popover() menu. */
    node_.onclick = showMenuFn;
    /** Even though showMenuFn is constant, jQuery.on does : handlers.push(handleObj)
     * each call, perhaps it avoids duplicate registrations only when selector
     * is passed.
     * So node_.onclick is used instead of :
      $(node_)
      .on('click', showMenuFn);
      */
    /** @param e DOM event */
    function showMenu(e) {
      let block = this.__data__;
      if (block.axis.blocks[0] !== block) {
        dLog('showMenu', 'data block', block, block.axis.blocks);
        block = block.axis.blocks[0];
      }
      /** defined when called via jQuery.on(click) */
      let jQueryEventInfo = e.originalEvent && [e.originalEvent.path, e.originalEvent.srcElement, e.handleObj.type];
      dLog('showMenu', this, axisName, this.__data__, this.parentElement, this.parentElement.parentElement,
           e, jQueryEventInfo);
      me.sendAction('selectBlock', block.block);

      /** If the axis-menu is already displayed on a different axis,
       * reposition it to align with the axis of the clicked block title.
       */
      if (me.get('menuAxis') && (me.get('menuAxis') !== block)) {
        me.set('menuAxis', undefined);
        later(() => me.set('menuAxis', block));
      } else {
        me.set('menuAxis', block);
      }
      return false; /* for preventDefault(), stopPropagation() */
    }
  }

  //----------------------------------------------------------------------------

  function axis1d2BlockViews (axis1d) {
    const
    // .blockViews[0].block is .referenceBlock.
    blockViews =
      ! axis1d ? [] :
      axis1d.isDestroying ? [] :
      (axisTitle_dataBlocks ? axis1d.blockViews : axis1d.blockViews.slice(0,1));
    return blockViews;
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
    const stacks = oa.axisApi.stacksView.stacks;
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
    const
    // equivalent : BlockAxisView.titleTextMax()
    titleLength = Block.titleTextMax(),
    /** char width in px, ie. convert em to px.  Approx -	better to measure this. */
    em2Px = 7,
    titlePx = titleLength ? titleLength * em2Px : 0;
    let titleText = vc.titleText || (vc.titleText = {});

    if (titlePx) {
      oa.vc.axisHeaderTextLen = titlePx;
    }
    oa.axisTitleLayout.calc(axisSpacing, titlePx);


    // applied to all axes consistently, not just appended axis.
    // Update elements' class and transform when verticalTitle changes value.

    // also incorporate extendedWidth() / getAxisExtendedWidth() in the
    // calculation, perhaps integrated in xScaleExtend()
    const
    axisTitleA =
      axisTitleS.selectAll("g.axis-all > text");
    axisTitleA
      // this attr does not change, can be done for just axisG
      .style("text-anchor", oa.axisTitleLayout.verticalTitle ? "start" : undefined)
      .attr("transform", yAxisTitleTransform(oa.axisTitleLayout));

    let
    t =
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
    const 
    axis1ds = axisTitleS.nodes().mapBy('__data__');
    axis1ds.forEach(
      (axis1d) => axis1d.showZoomResetButtonXPosn());
  }

  return result;
}

//------------------------------------------------------------------------------

export {
  AxisTitle,
};
